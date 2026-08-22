import glob
import json
import re
import sys
from pathlib import Path

import pytest

NOW = 1_700_000_000  # arbitrary fixed instant used across tests


def _ensure_genlayer_importable():
    try:
        import genlayer.py.types  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    # The vendored GenVM stdlib used by direct-mode tests lives under gltest's
    # extracted-runtime cache, not as a normally pip-installed package - locate it
    # and add it to sys.path so `genlayer.py.types.Address` becomes importable the
    # same way it is from inside a contract's own exec'd module.
    candidates = glob.glob(
        str(Path.home() / ".cache/gltest-direct/extracted/*/py-lib-genlayer-std/*/genlayer")
    )
    assert candidates, "Could not locate the vendored genlayer package for direct-mode tests"
    sys.path.insert(0, str(Path(candidates[0]).parent))


def _addr_str(raw_bytes):
    _ensure_genlayer_importable()
    from genlayer.py.types import Address
    return str(Address(raw_bytes))


def _deploy_task(direct_vm, direct_deploy, direct_creator, deadline=NOW + 86400, submission_format="GitHub Repository"):
    direct_vm.warp("2023-11-14T22:13:20Z")  # NOW
    creator_str = _addr_str(direct_creator)
    direct_vm.sender = direct_creator
    return direct_deploy(
        "contracts/task_verifier.py",
        creator_str, "0x0000000000000000000000000000000000000000",
        "Title", "Backend", "", "Medium", "1-4 hours",
        "Description", "Criteria", submission_format, "",
        10, deadline,
    )


def _mock_evidence(direct_vm, url="https://github.com/octocat/Hello-World", body="README contents"):
    direct_vm.mock_web(url.replace("://", r"://").replace(".", r"\."), {"status": 200, "body": body})


# ---- cancel_task: terminal, open-only ----

def test_cancel_task_refuses_after_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    task.claim_task()

    direct_vm.sender = direct_alice
    with pytest.raises(AssertionError, match=re.escape("Can only cancel before the task is claimed")):
        task.cancel_task()


def test_cancel_task_only_creator(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    with pytest.raises(AssertionError, match=re.escape("Only creator can cancel")):
        task.cancel_task()


def test_cancel_task_sets_terminal_cancelled_status(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    task.cancel_task()

    state = task.get_task_state()
    assert state["status"] == "cancelled"

    # Terminal - cannot be claimed, re-cancelled, or expired afterward.
    with pytest.raises(AssertionError, match=re.escape("Task is not open")):
        task.claim_task()
    with pytest.raises(AssertionError, match=re.escape("Can only cancel before the task is claimed")):
        task.cancel_task()


# ---- expire_task: deadline + status guards ----

def test_expire_task_before_deadline_reverts(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice, deadline=NOW + 86400)
    with pytest.raises(AssertionError, match=re.escape("Deadline has not passed yet")):
        task.expire_task()


def test_expire_task_after_deadline_open(direct_vm, direct_deploy, direct_alice):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice, deadline=NOW + 10)
    direct_vm.warp("2023-11-14T22:13:31Z")  # NOW + 11, past deadline
    task.expire_task()
    assert task.get_task_state()["status"] == "expired"


def test_expire_task_after_deadline_claimed_but_not_submitted(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice, deadline=NOW + 10)
    direct_vm.sender = direct_bob
    task.claim_task()

    direct_vm.warp("2023-11-14T22:13:31Z")  # past deadline
    task.expire_task()
    assert task.get_task_state()["status"] == "expired"


def test_expire_task_refuses_once_submitted(direct_vm, direct_deploy, direct_alice, direct_bob):
    task = _deploy_task(direct_vm, direct_deploy, direct_alice, deadline=NOW + 10)
    direct_vm.sender = direct_bob
    task.claim_task()
    _mock_evidence(direct_vm)
    task.submit_work("https://github.com/octocat/Hello-World", "note")

    direct_vm.warp("2023-11-14T22:13:31Z")  # past deadline, but already submitted
    with pytest.raises(AssertionError, match=re.escape("Task already has a submission or is already decided")):
        task.expire_task()


# ---- dispute cap: finality ----

def test_dispute_cap_enforced(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.mock_llm(r".*", json.dumps({"verified": True, "confidence": 90, "reasoning": "looks complete"}))
    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    task.claim_task()
    _mock_evidence(direct_vm)
    task.submit_work("https://github.com/octocat/Hello-World", "note")

    direct_vm.sender = direct_alice
    task.request_verification()
    assert task.get_task_state()["status"] == "verified"

    for i in range(3):
        task.dispute(f"round {i}")
        assert task.get_task_state()["status"] == "disputed"
        task.request_verification()
        assert task.get_task_state()["status"] == "verified"

    assert task.get_task_state()["dispute_count"] == 3
    with pytest.raises(AssertionError, match=re.escape("Maximum disputes reached - decision is final")):
        task.dispute("one too many")


# ---- evidence commitment: frozen at submission, never re-fetched ----

def test_verification_uses_frozen_snapshot_not_live_refetch(direct_vm, direct_deploy, direct_alice, direct_bob):
    url = "https://github.com/octocat/Hello-World"
    pattern = url.replace("://", r"://").replace(".", r"\.")

    direct_vm.mock_web(pattern, {"status": 200, "body": "ORIGINAL: meets all criteria"})
    direct_vm.mock_llm(
        r".*ORIGINAL.*",
        json.dumps({"verified": True, "confidence": 95, "reasoning": "matches original evidence"}),
    )

    task = _deploy_task(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    task.claim_task()
    task.submit_work(url, "note")

    # Evidence "changes" at the source after submission - a live re-fetch would see this.
    direct_vm.clear_mocks()
    direct_vm.mock_web(pattern, {"status": 200, "body": "TAMPERED: nothing here meets any criteria"})
    direct_vm.mock_llm(
        r".*TAMPERED.*",
        json.dumps({"verified": False, "confidence": 95, "reasoning": "does not meet criteria"}),
    )
    # If _verify_submission re-fetched, it would now only match the TAMPERED mock
    # and get an unmocked-LLM-call failure or the rejected verdict below.
    direct_vm.mock_llm(
        r".*ORIGINAL.*",
        json.dumps({"verified": True, "confidence": 95, "reasoning": "matches original evidence"}),
    )

    direct_vm.sender = direct_alice
    task.request_verification()

    state = task.get_task_state()
    assert state["status"] == "verified"
    result = json.loads(state["verification_result"])
    assert result["verified"] is True
