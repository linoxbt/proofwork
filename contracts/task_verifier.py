# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# AI-Verified Task Completion — GenLayer Intelligent Contract
# Deploy via GenLayer CLI: genlayer deploy --contract contracts/task_verifier.py
#   --args <title> <category> <description> <criteria> <reward_amount> <deadline_unix_ts>

from genlayer import *

from datetime import datetime, timezone
import json

ERROR_EXPECTED = "[EXPECTED]"  # business logic — deterministic, exact match
ERROR_EXTERNAL = "[EXTERNAL]"  # external API 4xx — deterministic, exact match
ERROR_TRANSIENT = "[TRANSIENT]"  # network/5xx — non-deterministic, agree if both transient
ERROR_LLM = "[LLM_ERROR]"  # LLM misbehavior — always disagree, force rotation


class TaskVerifier(gl.Contract):
    creator: str
    title: str
    category: str
    description: str
    criteria: str
    reward_amount: u256
    deadline: u256  # unix timestamp; worker must submit before this
    worker: str
    submission_url: str
    status: str  # "open", "claimed", "submitted", "verified", "rejected", "disputed"
    verification_result: str
    dispute_count: u256
    dispute_reason: str
    created_at: u256

    def __init__(
        self,
        title: str,
        category: str,
        description: str,
        criteria: str,
        reward_amount: int,
        deadline: int,
    ):
        now = int(datetime.now(timezone.utc).timestamp())
        assert deadline > now, "Deadline must be in the future"
        self.creator = str(gl.message.sender_address)
        self.title = title
        self.category = category
        self.description = description
        self.criteria = criteria
        self.reward_amount = reward_amount
        self.deadline = deadline
        self.worker = ""
        self.submission_url = ""
        self.status = "open"
        self.verification_result = ""
        self.dispute_count = 0
        self.dispute_reason = ""
        self.created_at = now

    @gl.public.write
    def claim_task(self) -> None:
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert self.status == "open", "Task is not open"
        assert caller != self.creator, "Creator cannot claim own task"
        assert now <= self.deadline, "Task deadline has passed"
        self.worker = caller
        self.status = "claimed"

    @gl.public.write
    def submit_work(self, github_url: str) -> None:
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert caller == self.worker, "Only assigned worker can submit"
        assert self.status == "claimed", "Task must be claimed first"
        assert now <= self.deadline, "Task deadline has passed"
        self.submission_url = github_url
        self.status = "submitted"
        # Evidence is now locked in. AI verification must be triggered separately
        # via request_verification() by either the creator or the worker.

    @gl.public.write
    def request_verification(self) -> None:
        caller = str(gl.message.sender_address)
        assert caller in (self.creator, self.worker), "Only creator or worker can request verification"
        assert self.status in ("submitted", "disputed"), "Task must be submitted or disputed to verify"
        self._verify_submission()

    @gl.public.write
    def dispute(self, reason: str) -> None:
        caller = str(gl.message.sender_address)
        assert caller in (self.creator, self.worker), "Only creator or worker can dispute"
        assert self.status in ("verified", "rejected"), "Can only dispute a decided verification"
        self.dispute_count += 1
        self.dispute_reason = reason
        self.status = "disputed"

    @gl.public.write
    def cancel_task(self) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.creator, "Only creator can cancel"
        assert self.status in ("open", "claimed"), "Cannot cancel after submission"
        self.status = "open"
        self.worker = ""

    @gl.public.view
    def get_task_state(self) -> dict:
        return {
            "creator": self.creator,
            "title": self.title,
            "category": self.category,
            "description": self.description,
            "criteria": self.criteria,
            "reward_amount": self.reward_amount,
            "deadline": self.deadline,
            "worker": self.worker,
            "submission_url": self.submission_url,
            "status": self.status,
            "verification_result": self.verification_result,
            "dispute_count": self.dispute_count,
            "dispute_reason": self.dispute_reason,
            "created_at": self.created_at,
        }

    def _verify_submission(self):
        title = self.title
        description = self.description
        criteria = self.criteria
        submission_url = self.submission_url
        dispute_reason = self.dispute_reason
        is_redispute = self.dispute_count > 0

        def analyze():
            # Fetch the GitHub repository content fresh, every time this is called
            try:
                web_data = gl.nondet.web.render(submission_url, mode="text")
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} failed to fetch {submission_url}: {e}")

            dispute_context = ""
            if is_redispute and dispute_reason:
                dispute_context = f"""
This submission was DISPUTED by one of the parties. Re-examine the repository
carefully in light of the dispute reason below, and do not simply repeat a
prior verdict — form your own independent judgment from the current evidence.

DISPUTE REASON: {dispute_reason}
"""

            prompt = f"""You are an AI code reviewer verifying task completion.

TASK TITLE: {title}
TASK DESCRIPTION: {description}
COMPLETION CRITERIA: {criteria}

SUBMITTED GITHUB URL: {submission_url}
{dispute_context}
REPOSITORY CONTENT:
{web_data[:8000]}

Analyze the repository content against the completion criteria.
Determine if the task has been genuinely completed.

Respond in valid JSON format:
{{"verified": true/false, "confidence": 0-100, "reasoning": "detailed explanation of your verification"}}

Be strict but fair. Look for evidence that the criteria are met in the actual code."""

            result = gl.nondet.exec_prompt(prompt, response_format="json")

            if not isinstance(result, dict) or "verified" not in result:
                return {
                    "verified": False,
                    "confidence": 0,
                    "reasoning": "AI verification produced malformed output. Manual review needed.",
                }

            return {
                "verified": bool(result.get("verified", False)),
                "confidence": int(result.get("confidence", 0) or 0),
                "reasoning": str(result.get("reasoning", "")),
            }

        parsed = gl.eq_principle.prompt_comparative(
            analyze,
            principle=(
                "`verified` must be exactly the same. `confidence` should be within "
                "15 points of each other. `reasoning` may differ in wording but should "
                "reference similar evidence from the repository."
            ),
        )

        self.verification_result = json.dumps(parsed)
        self.status = "verified" if parsed.get("verified") else "rejected"
