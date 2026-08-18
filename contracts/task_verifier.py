# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# AI-Verified Task Completion — GenLayer Intelligent Contract
# Deploy via GenLayer CLI: genlayer deploy --contract contracts/task_verifier.py --args <title> <description> <criteria> <reward_amount>

from genlayer import *

import json

ERROR_EXPECTED = "[EXPECTED]"  # business logic — deterministic, exact match
ERROR_EXTERNAL = "[EXTERNAL]"  # external API 4xx — deterministic, exact match
ERROR_TRANSIENT = "[TRANSIENT]"  # network/5xx — non-deterministic, agree if both transient
ERROR_LLM = "[LLM_ERROR]"  # LLM misbehavior — always disagree, force rotation


class TaskVerifier(gl.Contract):
    creator: str
    title: str
    description: str
    criteria: str
    reward_amount: u256
    worker: str
    submission_url: str
    status: str  # "open", "claimed", "submitted", "verified", "rejected"
    verification_result: str
    created_at: u256

    def __init__(self, title: str, description: str, criteria: str, reward_amount: int):
        self.creator = str(gl.message.sender_address)
        self.title = title
        self.description = description
        self.criteria = criteria
        self.reward_amount = reward_amount
        self.worker = ""
        self.submission_url = ""
        self.status = "open"
        self.verification_result = ""
        self.created_at = 0

    @gl.public.write
    def claim_task(self) -> None:
        caller = str(gl.message.sender_address)
        assert self.status == "open", "Task is not open"
        assert caller != self.creator, "Creator cannot claim own task"
        self.worker = caller
        self.status = "claimed"

    @gl.public.write
    def submit_work(self, github_url: str) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.worker, "Only assigned worker can submit"
        assert self.status == "claimed", "Task must be claimed first"
        self.submission_url = github_url
        self.status = "submitted"
        # AI verification happens here
        self._verify_submission()

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
            "description": self.description,
            "criteria": self.criteria,
            "reward_amount": self.reward_amount,
            "worker": self.worker,
            "submission_url": self.submission_url,
            "status": self.status,
            "verification_result": self.verification_result,
        }

    def _verify_submission(self):
        title = self.title
        description = self.description
        criteria = self.criteria
        submission_url = self.submission_url

        def analyze():
            # Fetch the GitHub repository content
            try:
                web_data = gl.nondet.web.render(submission_url, mode="text")
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} failed to fetch {submission_url}: {e}")

            prompt = f"""You are an AI code reviewer verifying task completion.

TASK TITLE: {title}
TASK DESCRIPTION: {description}
COMPLETION CRITERIA: {criteria}

SUBMITTED GITHUB URL: {submission_url}

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
