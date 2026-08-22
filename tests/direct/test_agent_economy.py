# NOTE: this gltest-direct version only allows ONE gl.Contract subclass to be
# defined per test process (a module-level `__known_contract__` singleton in
# the vendored GenVM stdlib), so AgentRegistry and AgentTask can never both be
# deployed in the same direct-mode test - any AgentTask path that cross-calls
# into a real registry (place_bid, close_bidding_and_assign with bids, and
# everything downstream of those) is validated live on Studionet instead, the
# same way TaskFactory/TaskVerifier's cross-contract release_funds was.

import glob
import re
import sys
from pathlib import Path

import pytest

NOW = 1_700_000_000
FAKE_ADDR = "0x0000000000000000000000000000000000000000"


def _ensure_genlayer_importable():
    try:
        import genlayer.py.types  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    candidates = glob.glob(
        str(Path.home() / ".cache/gltest-direct/extracted/*/py-lib-genlayer-std/*/genlayer")
    )
    assert candidates, "Could not locate the vendored genlayer package for direct-mode tests"
    sys.path.insert(0, str(Path(candidates[0]).parent))


def _addr_str(raw_bytes):
    _ensure_genlayer_importable()
    from genlayer.py.types import Address
    return str(Address(raw_bytes))


def _warp_now(direct_vm):
    direct_vm.warp("2023-11-14T22:13:20Z")  # NOW


def _register(direct_vm, registry, agent, capabilities="Backend"):
    direct_vm.sender = agent
    direct_vm.value = 10**18
    registry.register_agent(capabilities)
    direct_vm.value = 0


def _deploy_task(direct_vm, direct_deploy, requester, deadline=NOW + 86400, capability="Backend", budget=10):
    _warp_now(direct_vm)
    direct_vm.sender = requester
    return direct_deploy(
        "contracts/agent_task.py",
        _addr_str(requester), FAKE_ADDR, FAKE_ADDR,
        "Title", "Description", "Criteria", capability, budget, deadline,
    )


# ---- AgentRegistry (standalone) ----

def test_register_agent_requires_min_stake(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    direct_vm.value = int(0.5 * 10**18)
    with pytest.raises(AssertionError, match=re.escape("Stake must be at least 1 GEN")):
        registry.register_agent("Backend")
    direct_vm.value = 0


def test_register_agent_succeeds_and_dedupes(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    _register(direct_vm, registry, direct_alice, "Backend, Research")

    info = registry.get_agent(_addr_str(direct_alice))
    assert info["active"] is True
    assert info["reputation"] == 100
    assert info["stake"] == 10**18
    assert info["active_tasks"] == 0

    direct_vm.sender = direct_alice
    with pytest.raises(AssertionError, match=re.escape("Already registered")):
        registry.register_agent("Backend")


def test_deactivate_refunds_when_no_active_tasks(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    _register(direct_vm, registry, direct_alice, "Backend")

    direct_vm.sender = direct_alice
    registry.deactivate_agent()
    info = registry.get_agent(_addr_str(direct_alice))
    assert info["active"] is False
    assert info["stake"] == 0


def test_set_task_factory_only_once_by_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")

    direct_vm.sender = direct_bob
    with pytest.raises(AssertionError, match=re.escape("Only the deployer can set the task factory")):
        registry.set_task_factory(FAKE_ADDR)

    direct_vm.sender = direct_alice
    registry.set_task_factory(FAKE_ADDR)
    with pytest.raises(AssertionError, match=re.escape("Task factory already set")):
        registry.set_task_factory(FAKE_ADDR)


# ---- AgentTask (standalone - only paths that never cross-call the registry) ----

def test_deploy_rejects_past_deadline(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    with pytest.raises(AssertionError, match=re.escape("Deadline must be in the future")):
        direct_deploy(
            "contracts/agent_task.py",
            _addr_str(direct_alice), FAKE_ADDR, FAKE_ADDR,
            "Title", "Description", "Criteria", "Backend", 10, NOW - 1,
        )


def test_no_bids_expires(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.warp("2023-11-14T22:15:25Z")  # past the 120s bidding window
    task.close_bidding_and_assign()
    assert task.get_task_state()["status"] == "expired"


def test_close_bidding_too_early_reverts(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    with pytest.raises(AssertionError, match=re.escape("Bidding window still open")):
        task.close_bidding_and_assign()


def test_cancel_while_open_then_blocked(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    task.cancel_task()
    assert task.get_task_state()["status"] == "cancelled"
    with pytest.raises(AssertionError, match=re.escape("Can only cancel before bidding closes")):
        task.cancel_task()


def test_cancel_only_by_requester(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    with pytest.raises(AssertionError, match=re.escape("Only the requester can cancel")):
        task.cancel_task()


def test_check_timeout_requires_assigned_status(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice, deadline=NOW + 300)
    direct_vm.warp("2023-11-14T22:18:21Z")  # past deadline, but never assigned
    with pytest.raises(AssertionError, match=re.escape("Task is not awaiting a submission")):
        task.check_timeout()
