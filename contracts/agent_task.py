# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ProofWork AgentTask - a single unit of autonomous-agent work: open for
# bidding, assigned to the winning agent, worked, AI-verified, and settled.
# Deployed as a child of AgentTaskFactory (see agent_task_factory.py) - not
# deployed directly.
#
# A close port of Polaris's TaskRegistry.sol + BidEngine.sol bidding/scoring,
# adapted to GenLayer: AI-consensus verification (gl.eq_principle) instead of
# a trusted-signer verification oracle - the whole reason to use GenLayer in
# the first place - and a deterministic pseudo-random tiebreak instead of
# Polaris's block.prevrandao (GenVM's execution model has no miner-revealed
# per-block entropy to draw on); both are equally non-cryptographic by design
# and documented as such, on both sides.

from genlayer import *

from datetime import datetime, timezone
import hashlib
import json

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

BIDDING_WINDOW_SECONDS = 120  # short auction window, agents bid autonomously
REPUTATION_FLOOR = 70  # minimum reputation required to place a bid
PASS_SCORE = 70  # AI score (0-100) required to pass verification
MAX_DISPUTES = 3
MAX_BIDS_PER_TASK = 50


def _capability_matches(agent_capabilities: str, required: str) -> bool:
    if not required.strip():
        return True
    return required.strip().lower() in agent_capabilities.lower()


def _price_score(price: int) -> float:
    if price <= 0:
        return 0.0
    return float(min(100, 100 // price))


def _speed_score(eta_hours: int) -> float:
    if eta_hours <= 1:
        return 100.0
    return float(100 // eta_hours)


def _rep_score(reputation: int) -> float:
    return float(min(reputation, 1000)) / 10.0


class AgentTask(gl.Contract):
    requester: str
    factory: str
    registry: str
    title: str
    description: str
    criteria: str
    capability_required: str
    budget: u256
    deadline: u256
    bidding_deadline: u256
    bids: DynArray[str]  # JSON: {"agent": str, "price": int, "eta_hours": int}
    assigned_agent: str
    assigned_price: u256  # winning bid's price (whole GEN) - what the agent actually gets paid
    submission_url: str
    submission_note: str
    submission_snapshot: str
    status: str  # "open", "assigned", "submitted", "verified", "rejected",
                 # "disputed", "cancelled", "expired"
    verification_result: str
    dispute_count: u256
    dispute_reason: str
    created_at: u256
    verified_at: u256

    def __init__(
        self,
        requester: str,
        factory: str,
        registry: str,
        title: str,
        description: str,
        criteria: str,
        capability_required: str,
        budget: int,
        deadline: int,
        direct_agent: str,
        direct_price: int,
    ):
        now = int(datetime.now(timezone.utc).timestamp())
        assert deadline > now, "Deadline must be in the future"
        self.requester = requester
        self.factory = factory
        self.registry = registry
        self.title = title
        self.description = description
        self.criteria = criteria
        self.capability_required = capability_required
        self.budget = budget
        self.deadline = deadline
        bidding_close = now + BIDDING_WINDOW_SECONDS
        self.bidding_deadline = bidding_close if bidding_close < deadline else deadline
        self.submission_url = ""
        self.submission_note = ""
        self.submission_snapshot = ""
        self.verification_result = ""
        self.dispute_count = 0
        self.dispute_reason = ""
        self.created_at = now
        self.verified_at = 0

        if direct_agent:
            # Direct hire / agent-to-agent delegation, or a committed
            # occurrence of a recurring series - skips the auction entirely.
            # The caller (AgentTaskFactory) is responsible for telling the
            # registry this agent now has an active task; __init__ never
            # makes cross-contract calls itself.
            self.assigned_agent = direct_agent
            self.assigned_price = u256(direct_price)
            self.status = "assigned"
        else:
            self.assigned_agent = ""
            self.assigned_price = u256(0)
            self.status = "open"

    @gl.public.write
    def place_bid(self, price: int, eta_hours: int) -> None:
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.status == "open", "Bidding is not open"
        assert now <= self.bidding_deadline, "Bidding window has closed"
        assert price > 0, "Price must be positive"
        assert eta_hours > 0, "ETA must be positive"
        assert len(self.bids) < MAX_BIDS_PER_TASK, "This task has reached the maximum number of bids"

        registry = gl.get_contract_at(Address(self.registry))
        agent = registry.view().get_agent(caller)
        assert agent["active"], "Only a registered, active agent can bid"
        assert int(agent["reputation"]) >= REPUTATION_FLOOR, "Reputation below the bidding floor"
        assert _capability_matches(str(agent["capabilities"]), self.capability_required), \
            "Agent capabilities do not match this task"

        for raw in self.bids:
            existing = json.loads(raw)
            assert existing["agent"] != caller, "Already placed a bid on this task"

        self.bids.append(json.dumps({"agent": caller, "price": price, "eta_hours": eta_hours}))

    @gl.public.write
    def close_bidding_and_assign(self) -> None:
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.status == "open", "Bidding is not open"
        assert now > self.bidding_deadline, "Bidding window still open"

        registry = gl.get_contract_at(Address(self.registry))
        parsed = [json.loads(raw) for raw in self.bids]

        best_agent = ""
        best_price = 0
        best_score = -1.0
        for i, b in enumerate(parsed):
            agent_info = registry.view().get_agent(b["agent"])
            if not agent_info["active"]:
                continue  # agent went offline since bidding - skip, like Polaris's awardBid
            price = int(b["price"])
            eta_hours = int(b["eta_hours"])
            seed = f"{gl.message.contract_address}:{b['agent']}:{now}:{i}".encode()
            rand_score = float(int(hashlib.sha256(seed).hexdigest(), 16) % 101)
            score = (
                _price_score(price) * 25
                + _rep_score(int(agent_info["reputation"])) * 10
                + _speed_score(eta_hours) * 10
                + rand_score * 55
            ) / 100
            if score > best_score:
                best_score = score
                best_agent = b["agent"]
                best_price = price

        if not best_agent:
            self.status = "expired"
            return

        self.assigned_agent = best_agent
        self.assigned_price = u256(best_price)
        self.status = "assigned"
        registry.emit(on="accepted").record_task_start(best_agent)

    @gl.public.write
    def submit_deliverable(self, evidence_url: str, submission_note: str) -> None:
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert caller == self.assigned_agent, "Only the assigned agent can submit"
        assert self.status == "assigned", "Task must be assigned first"
        assert now <= self.deadline, "Task deadline has passed"

        url_lower = evidence_url.lower().strip()
        assert url_lower.startswith("http://") or url_lower.startswith("https://"), \
            "Evidence must be a valid URL"

        def fetch_evidence():
            try:
                return gl.nondet.web.render(evidence_url, mode="text")[:8000]
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} failed to fetch {evidence_url}: {e}")

        committed_content = gl.eq_principle.prompt_comparative(
            fetch_evidence,
            principle=(
                "Both fetches must be of the same underlying page or resource. Minor "
                "formatting or incidental dynamic elements (timestamps, counters) may "
                "differ, but the substantive content must match."
            ),
        )

        self.submission_url = evidence_url
        self.submission_note = submission_note
        self.submission_snapshot = committed_content
        self.status = "submitted"

    @gl.public.write
    def check_timeout(self) -> None:
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.status == "assigned", "Task is not awaiting a submission"
        assert now > self.deadline, "Deadline has not passed yet"
        self.verification_result = json.dumps({
            "verified": False,
            "confidence": 100,
            "reasoning": "The assigned agent missed the submission deadline.",
        })
        self.status = "rejected"
        self.verified_at = now

    @gl.public.write
    def request_verification(self) -> None:
        caller = str(gl.message.sender_address)
        assert caller in (self.requester, self.assigned_agent), \
            "Only the requester or assigned agent can request verification"
        assert self.status in ("submitted", "disputed"), "Task must be submitted or disputed to verify"
        self._verify_submission()

    @gl.public.write
    def dispute(self, reason: str) -> None:
        caller = str(gl.message.sender_address)
        assert caller in (self.requester, self.assigned_agent), "Only the requester or agent can dispute"
        assert self.status in ("verified", "rejected"), "Can only dispute a decided verification"
        assert self.dispute_count < MAX_DISPUTES, "Maximum disputes reached - decision is final"
        self.dispute_count += 1
        self.dispute_reason = reason
        self.status = "disputed"
        self.verified_at = 0

    @gl.public.write
    def cancel_task(self) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.requester, "Only the requester can cancel"
        assert self.status == "open", "Can only cancel before bidding closes"
        self.status = "cancelled"

    @gl.public.view
    def get_task_state(self) -> dict:
        return {
            "requester": self.requester,
            "factory": self.factory,
            "registry": self.registry,
            "title": self.title,
            "description": self.description,
            "criteria": self.criteria,
            "capability_required": self.capability_required,
            "budget": self.budget,
            "deadline": self.deadline,
            "bidding_deadline": self.bidding_deadline,
            "bid_count": len(self.bids),
            "assigned_agent": self.assigned_agent,
            "assigned_price": self.assigned_price,
            "submission_url": self.submission_url,
            "submission_note": self.submission_note,
            "status": self.status,
            "verification_result": self.verification_result,
            "dispute_count": self.dispute_count,
            "dispute_reason": self.dispute_reason,
            "created_at": self.created_at,
            "verified_at": self.verified_at,
        }

    @gl.public.view
    def get_attestation(self) -> dict:
        """A permanent, explicit record of the verdict - mirrors Polaris's
        VerifierBridge.Attestation (agent, passed, score, deliverable,
        timestamp), which is stored as its own on-chain record there."""
        verified = None
        score = 0
        if self.verification_result:
            parsed = json.loads(self.verification_result)
            verified = bool(parsed.get("verified"))
            score = int(parsed.get("confidence", 0))
        return {
            "agent": self.assigned_agent,
            "passed": verified,
            "score": score,
            "deliverable_url": self.submission_url,
            "timestamp": self.verified_at,
        }

    @gl.public.view
    def get_bids(self) -> list[str]:
        return [b for b in self.bids]

    def _verify_submission(self):
        title = self.title
        description = self.description
        criteria = self.criteria
        submission_note = self.submission_note
        dispute_reason = self.dispute_reason
        is_redispute = self.dispute_count > 0
        web_data = self.submission_snapshot

        def analyze():
            dispute_context = ""
            if is_redispute and dispute_reason:
                dispute_context = f"""
This submission was DISPUTED by the requester or the agent. Re-examine the evidence
carefully in light of the dispute reason below, and do not simply repeat a prior
verdict - form your own independent judgment from the current evidence.

DISPUTE REASON: {dispute_reason}
"""
            note_context = f"\nAGENT'S NOTE: {submission_note}\n" if submission_note else ""

            prompt = f"""You are an AI reviewer scoring an autonomous agent's completed work.

TASK TITLE: {title}
TASK DESCRIPTION: {description}
COMPLETION CRITERIA (RUBRIC): {criteria}

SUBMITTED DELIVERABLE:
{note_context}{dispute_context}
DELIVERABLE CONTENT:
{web_data[:8000]}

Score the deliverable against the rubric on a 0-100 scale. A score of {PASS_SCORE} or
above means the work passes and the agent gets paid; below that, it fails and the
agent is penalized.

Respond in valid JSON format:
{{"score": 0-100, "reasoning": "detailed explanation of your scoring"}}

Be strict but fair."""

            result = gl.nondet.exec_prompt(prompt, response_format="json")

            if not isinstance(result, dict) or "score" not in result:
                return {"score": 0, "reasoning": "AI scoring produced malformed output. Manual review needed."}

            try:
                score = max(0, min(100, int(round(float(result.get("score", 0) or 0)))))
            except (ValueError, TypeError):
                score = 0

            return {"score": score, "reasoning": str(result.get("reasoning", ""))}

        parsed = gl.eq_principle.prompt_comparative(
            analyze,
            principle=(
                "`score` should be within 15 points of each other and on the same side "
                "of the pass/fail line. `reasoning` may differ in wording but should "
                "reference similar evidence."
            ),
        )

        now = int(datetime.now(timezone.utc).timestamp())
        score = int(parsed.get("score", 0))
        passed = score >= PASS_SCORE
        self.verification_result = json.dumps({
            "verified": passed,
            "confidence": score,
            "reasoning": parsed.get("reasoning", ""),
        })
        self.status = "verified" if passed else "rejected"
        self.verified_at = now
