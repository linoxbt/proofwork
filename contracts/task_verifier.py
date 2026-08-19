# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# AI-Verified Task Completion - GenLayer Intelligent Contract
# Deployed as a child of TaskFactory (see task_factory.py) - not deployed directly.

from genlayer import *

from datetime import datetime, timezone
import json

ERROR_EXPECTED = "[EXPECTED]"  # business logic - deterministic, exact match
ERROR_EXTERNAL = "[EXTERNAL]"  # external API 4xx - deterministic, exact match
ERROR_TRANSIENT = "[TRANSIENT]"  # network/5xx - non-deterministic, agree if both transient
ERROR_LLM = "[LLM_ERROR]"  # LLM misbehavior - always disagree, force rotation


class TaskVerifier(gl.Contract):
    creator: str
    factory: str
    title: str
    category: str
    category_other: str
    priority: str
    estimated_effort: str
    description: str
    criteria: str
    submission_format: str
    submission_format_other: str
    reward_amount: u256
    deadline: u256  # unix timestamp; worker must submit before this
    worker: str
    submission_url: str
    submission_note: str
    status: str  # "open", "claimed", "submitted", "verified", "rejected", "disputed"
    verification_result: str
    dispute_count: u256
    dispute_reason: str
    created_at: u256
    verified_at: u256  # set when status first becomes verified/rejected; escrow release window starts here

    def __init__(
        self,
        creator: str,
        factory: str,
        title: str,
        category: str,
        category_other: str,
        priority: str,
        estimated_effort: str,
        description: str,
        criteria: str,
        submission_format: str,
        submission_format_other: str,
        reward_amount: int,
        deadline: int,
    ):
        now = int(datetime.now(timezone.utc).timestamp())
        assert deadline > now, "Deadline must be in the future"
        self.creator = creator
        self.factory = factory
        self.title = title
        self.category = category
        self.category_other = category_other
        self.priority = priority
        self.estimated_effort = estimated_effort
        self.description = description
        self.criteria = criteria
        self.submission_format = submission_format
        self.submission_format_other = submission_format_other
        self.reward_amount = reward_amount
        self.deadline = deadline
        self.worker = ""
        self.submission_url = ""
        self.submission_note = ""
        self.status = "open"
        self.verification_result = ""
        self.dispute_count = 0
        self.dispute_reason = ""
        self.created_at = now
        self.verified_at = 0

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
    def submit_work(self, evidence_url: str, submission_note: str) -> None:
        caller = str(gl.message.sender_address)
        now = int(datetime.now(timezone.utc).timestamp())
        assert caller == self.worker, "Only assigned worker can submit"
        assert self.status == "claimed", "Task must be claimed first"
        assert now <= self.deadline, "Task deadline has passed"

        url_lower = evidence_url.lower().strip()
        assert url_lower.startswith("http://") or url_lower.startswith("https://"), \
            "Evidence must be a valid URL"
        expected_format = self.submission_format
        if expected_format == "GitHub Repository":
            assert "github.com" in url_lower, \
                "This task expects a GitHub Repository URL (github.com)"

        self.submission_url = evidence_url
        self.submission_note = submission_note
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
        self.verified_at = 0

    @gl.public.write
    def cancel_task(self) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.creator, "Only creator can cancel"
        assert self.status in ("open", "claimed"), "Cannot cancel after submission"
        self.status = "open"
        self.worker = ""

    @gl.public.view
    def get_task_state(self) -> dict:
        caller = str(gl.message.sender_address)
        is_party = caller == self.creator or caller == self.worker
        # Submitted evidence is only meaningful to hide once something has
        # actually been submitted - an empty string already means "nothing
        # submitted yet" for open/claimed tasks, so only redact when there's
        # something real to redact.
        hide_evidence = self.submission_url != "" and not is_party
        evidence_url = "[private]" if hide_evidence else self.submission_url
        evidence_note = "[private]" if hide_evidence else self.submission_note

        return {
            "creator": self.creator,
            "factory": self.factory,
            "title": self.title,
            "category": self.category,
            "category_other": self.category_other,
            "priority": self.priority,
            "estimated_effort": self.estimated_effort,
            "description": self.description,
            "criteria": self.criteria,
            "submission_format": self.submission_format,
            "submission_format_other": self.submission_format_other,
            "reward_amount": self.reward_amount,
            "deadline": self.deadline,
            "worker": self.worker,
            "submission_url": evidence_url,
            "submission_note": evidence_note,
            "status": self.status,
            "verification_result": self.verification_result,
            "dispute_count": self.dispute_count,
            "dispute_reason": self.dispute_reason,
            "created_at": self.created_at,
            "verified_at": self.verified_at,
        }

    def _verify_submission(self):
        title = self.title
        description = self.description
        criteria = self.criteria
        submission_url = self.submission_url
        submission_note = self.submission_note
        submission_format = self.submission_format_other or self.submission_format
        dispute_reason = self.dispute_reason
        is_redispute = self.dispute_count > 0

        def analyze():
            # Fetch the evidence fresh, every time this is called
            try:
                web_data = gl.nondet.web.render(submission_url, mode="text")
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} failed to fetch {submission_url}: {e}")

            dispute_context = ""
            if is_redispute and dispute_reason:
                dispute_context = f"""
This submission was DISPUTED by one of the parties. Re-examine the evidence
carefully in light of the dispute reason below, and do not simply repeat a
prior verdict - form your own independent judgment from the current evidence.

DISPUTE REASON: {dispute_reason}
"""

            note_context = f"\nWORKER'S NOTE: {submission_note}\n" if submission_note else ""

            prompt = f"""You are an AI reviewer verifying task completion.

TASK TITLE: {title}
TASK DESCRIPTION: {description}
COMPLETION CRITERIA: {criteria}
EXPECTED EVIDENCE FORMAT: {submission_format}

SUBMITTED EVIDENCE URL: {submission_url}
{note_context}{dispute_context}
EVIDENCE CONTENT:
{web_data[:8000]}

Analyze the evidence against the completion criteria, keeping in mind the expected
evidence format above (e.g. a GitHub repo, a live deployed app, a video, a document).
Determine if the task has been genuinely completed.

Respond in valid JSON format:
{{"verified": true/false, "confidence": 0-100, "reasoning": "detailed explanation of your verification"}}

Be strict but fair. Look for evidence that the criteria are met."""

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
                "reference similar evidence."
            ),
        )

        now = int(datetime.now(timezone.utc).timestamp())
        self.verification_result = json.dumps(parsed)
        self.status = "verified" if parsed.get("verified") else "rejected"
        self.verified_at = now
