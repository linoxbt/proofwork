# AI-Verified Task Completion — GenLayer Intelligent Contract
# Deploy via GenLayer Studio or CLI

from genlayer.py.types import *
from genlayer.py.storage import *

import json


class TaskVerifier(gl.Contract):
    creator: str
    title: str
    description: str
    criteria: str
    reward_amount: int
    worker: str
    submission_url: str
    status: str  # "open", "claimed", "submitted", "verified", "rejected"
    verification_result: str
    created_at: int

    def __init__(self, title: str, description: str, criteria: str, reward_amount: int):
        self.creator = gl.msg.sender
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
    def claim_task(self):
        caller = gl.msg.sender
        assert self.status == "open", "Task is not open"
        assert caller != self.creator, "Creator cannot claim own task"
        self.worker = caller
        self.status = "claimed"

    @gl.public.write
    def submit_work(self, github_url: str):
        caller = gl.msg.sender
        assert caller == self.worker, "Only assigned worker can submit"
        assert self.status == "claimed", "Task must be claimed first"
        self.submission_url = github_url
        self.status = "submitted"
        # AI verification happens here
        self._verify_submission()

    @gl.public.write
    def cancel_task(self):
        caller = gl.msg.sender
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
        # Fetch the GitHub repository content
        web_data = gl.get_webpage(self.submission_url, mode="text")

        prompt = f"""You are an AI code reviewer verifying task completion.

TASK TITLE: {self.title}
TASK DESCRIPTION: {self.description}
COMPLETION CRITERIA: {self.criteria}

SUBMITTED GITHUB URL: {self.submission_url}

REPOSITORY CONTENT:
{web_data[:8000]}

Analyze the repository content against the completion criteria.
Determine if the task has been genuinely completed.

Respond in valid JSON format:
{{"verified": true/false, "confidence": 0-100, "reasoning": "detailed explanation of your verification"}}

Be strict but fair. Look for evidence that the criteria are met in the actual code."""

        result = gl.exec_prompt(prompt)

        try:
            parsed = json.loads(result)
            verified = parsed.get("verified", False)
            self.verification_result = json.dumps(parsed)
            self.status = "verified" if verified else "rejected"
        except (json.JSONDecodeError, KeyError):
            self.verification_result = json.dumps({
                "verified": False,
                "confidence": 0,
                "reasoning": "AI verification produced malformed output. Manual review needed."
            })
            self.status = "rejected"
