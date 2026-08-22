#!/usr/bin/env python3
"""Regenerates agent_task_factory.py by embedding the current agent_task.py
source (base64-encoded, to sidestep any quoting collisions with the child's
own triple-quoted f-strings) as the AGENT_TASK_CODE_B64 constant.

Run this whenever contracts/agent_task.py changes:
    python3 contracts/generate_agent_factory.py
"""
import base64
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TASK_PATH = HERE / "agent_task.py"
FACTORY_PATH = HERE / "agent_task_factory.py"

task_source = TASK_PATH.read_text()
encoded = base64.b64encode(task_source.encode("utf-8")).decode("ascii")

factory_source = FACTORY_PATH.read_text()
new_factory_source = re.sub(
    r'AGENT_TASK_CODE_B64 = "[^"]*"',
    f'AGENT_TASK_CODE_B64 = "{encoded}"',
    factory_source,
    count=1,
)

if new_factory_source == factory_source:
    raise SystemExit("AGENT_TASK_CODE_B64 marker not found in agent_task_factory.py - nothing replaced")

FACTORY_PATH.write_text(new_factory_source)
print(f"Embedded {len(task_source)} bytes of agent_task.py ({len(encoded)} b64 chars) into agent_task_factory.py")
