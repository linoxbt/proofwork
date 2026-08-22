# NOTE: this gltest-direct version only allows ONE gl.Contract subclass to be
# defined per test process (a module-level `__known_contract__` singleton in
# the vendored GenVM stdlib), so AgentRegistry and AgentTask can never both be
# deployed in the same direct-mode test - any AgentTask path that cross-calls
# into a real registry (place_bid, close_bidding_and_assign with bids, and
# everything downstream of those) is validated live on Studionet instead, the
# same way TaskFactory/TaskVerifier's cross-contract release_funds was.

import glob
import json
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
        "", 0,
    )


# ---- AgentRegistry (standalone) ----

def test_register_agent_requires_min_stake(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    direct_vm.value = int(0.5 * 10**18)
    with pytest.raises(AssertionError, match=re.escape("Stake below the minimum")):
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


def test_go_offline_then_withdraw_refunds_stake(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    _register(direct_vm, registry, direct_alice, "Backend")

    direct_vm.sender = direct_alice
    with pytest.raises(AssertionError, match=re.escape("Go offline before withdrawing")):
        registry.withdraw_stake()

    registry.go_offline()
    info = registry.get_agent(_addr_str(direct_alice))
    assert info["active"] is False
    assert info["stake"] == 10**18  # stake stays locked after go_offline alone

    registry.withdraw_stake()
    info = registry.get_agent(_addr_str(direct_alice))
    assert info["stake"] == 0


def test_restake_comes_back_online(direct_vm, direct_deploy, direct_alice):
    _warp_now(direct_vm)
    direct_vm.sender = direct_alice
    registry = direct_deploy("contracts/agent_registry.py")
    _register(direct_vm, registry, direct_alice, "Backend")
    registry.go_offline()
    registry.withdraw_stake()

    direct_vm.sender = direct_alice
    with pytest.raises(AssertionError, match=re.escape("Total stake below the minimum")):
        registry.restake()

    direct_vm.value = 10**18
    registry.restake()
    direct_vm.value = 0
    info = registry.get_agent(_addr_str(direct_alice))
    assert info["active"] is True
    assert info["stake"] == 10**18




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
            "", 0,
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


# ---- Direct-assign constructor path (direct hire / delegation / recurring
# occurrences all deploy a task this way - skips the auction and the
# registry cross-call entirely, so it's fully testable standalone) ----

def _deploy_direct_task(direct_vm, direct_deploy, requester, agent, price, deadline=NOW + 86400, budget=10):
    _warp_now(direct_vm)
    direct_vm.sender = requester
    return direct_deploy(
        "contracts/agent_task.py",
        _addr_str(requester), FAKE_ADDR, FAKE_ADDR,
        "Title", "Description", "Criteria", "Backend", budget, deadline,
        _addr_str(agent), price,
    )


def test_direct_assign_skips_bidding(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_direct_task(direct_vm, direct_deploy, direct_alice, direct_bob, price=7, budget=10)
    state = task.get_task_state()
    assert state["status"] == "assigned"
    assert state["assigned_agent"] == _addr_str(direct_bob)
    assert state["assigned_price"] == 7

    with pytest.raises(AssertionError, match=re.escape("Bidding is not open")):
        task.place_bid(5, 1)


def test_direct_assigned_lifecycle_and_attestation(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_direct_task(direct_vm, direct_deploy, direct_alice, direct_bob, price=7)

    empty_attestation = task.get_attestation()
    assert empty_attestation["passed"] is None
    assert empty_attestation["score"] == 0

    url = "https://example.com/deliverable"
    pattern = url.replace("://", r"://").replace(".", r"\.")
    direct_vm.mock_web(pattern, {"status": 200, "body": "a complete, working deliverable"})
    direct_vm.mock_llm(r".*", json.dumps({"score": 91, "reasoning": "meets the rubric"}))

    direct_vm.sender = direct_bob
    task.submit_deliverable(url, "done")
    direct_vm.sender = direct_alice
    task.request_verification()

    final = task.get_task_state()
    assert final["status"] == "verified"

    attestation = task.get_attestation()
    assert attestation["agent"] == _addr_str(direct_bob)
    assert attestation["passed"] is True
    assert attestation["score"] == 91
    assert attestation["deliverable_url"] == url
    assert attestation["timestamp"] == final["verified_at"]


# ---- Bid-scoring helper functions (pure, no gl.* dependency - pulled from
# the loaded contract module rather than reimplemented here, so this tests
# the actual contract code) ----

def test_bid_scoring_helpers_match_polaris_formulas(direct_vm, direct_deploy, direct_alice):
    _deploy_task(direct_vm, direct_deploy, direct_alice)  # forces the module to load
    mod = sys.modules["_contract_agent_task"]

    assert mod._price_score(1) == 100.0
    assert mod._price_score(2) == 50.0
    assert mod._price_score(200) == 0.0

    assert mod._speed_score(1) == 100.0
    assert mod._speed_score(2) == 50.0

    assert mod._rep_score(1000) == 100.0
    assert mod._rep_score(100) == 10.0
    assert mod._rep_score(70) == 7.0
