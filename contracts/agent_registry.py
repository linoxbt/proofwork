# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ProofWork AgentRegistry - on-chain identity, stake, and reputation for
# autonomous AI agents. Deployed once per network, separate from the human
# task board's TaskFactory/TaskVerifier. AgentTaskFactory (see
# agent_task_factory.py) is the only address ever allowed to record task
# outcomes here, set once via `set_task_factory` right after both are deployed.
#
# NOTE: every agent record here is keyed by the agent's address AS A STRING,
# never as an `Address`. Converting a string argument to `Address(...)` inside
# a method invoked asynchronously via another contract's `.emit()` call was
# found to silently fail to deliver on this network - `record_task_start` and
# `record_task_outcome` (the two methods called that way, from AgentTask and
# AgentTaskFactory respectively) do no such conversion, and never move GEN
# directly; all actual transfers happen synchronously from
# AgentTaskFactory.release_funds instead, the same proven pattern the human
# task board's escrow already uses.

from genlayer import *

MIN_STAKE_ATTO = u256(1) * u256(10**18)  # 1 GEN minimum to register
REPUTATION_START = u256(100)
REPUTATION_CAP = u256(1000)
REPUTATION_GAIN = u256(10)  # per honest completion
REPUTATION_SLASH = u256(50)  # per failed/timed-out task


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class AgentRegistry(gl.Contract):
    owner: str  # deployer - only address allowed to call set_task_factory
    task_factory: str  # AgentTaskFactory address - only caller allowed to record outcomes
    agent_addresses: DynArray[str]
    agent_capabilities: TreeMap[str, str]
    agent_stake: TreeMap[str, u256]
    agent_reputation: TreeMap[str, u256]
    agent_active_tasks: TreeMap[str, u256]
    agent_active: TreeMap[str, bool]

    def __init__(self):
        self.owner = str(gl.message.sender_address)
        self.task_factory = ""

    @gl.public.write
    def set_task_factory(self, factory_address: str) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.owner, "Only the deployer can set the task factory"
        assert self.task_factory == "", "Task factory already set"
        self.task_factory = factory_address

    @gl.public.write.payable
    def register_agent(self, capabilities: str) -> None:
        caller = str(gl.message.sender_address)
        assert not self.agent_active.get(caller, False), "Already registered"
        assert gl.message.value >= MIN_STAKE_ATTO, "Stake must be at least 1 GEN"
        assert capabilities.strip() != "", "Capabilities cannot be empty"

        if caller not in self.agent_addresses:
            self.agent_addresses.append(caller)

        self.agent_capabilities[caller] = capabilities
        self.agent_stake[caller] = gl.message.value
        self.agent_reputation[caller] = REPUTATION_START
        self.agent_active_tasks[caller] = u256(0)
        self.agent_active[caller] = True

    @gl.public.write
    def deactivate_agent(self) -> None:
        caller_addr = gl.message.sender_address
        caller = str(caller_addr)
        assert self.agent_active.get(caller, False), "Not a registered agent"
        assert self.agent_active_tasks.get(caller, u256(0)) == 0, \
            "Cannot deactivate with active tasks"

        refund = self.agent_stake[caller]
        self.agent_active[caller] = False
        self.agent_stake[caller] = u256(0)
        if refund > 0:
            _Recipient(caller_addr).emit_transfer(value=refund)

    @gl.public.write
    def record_task_start(self, agent_address: str) -> None:
        caller = str(gl.message.sender_address)
        # Called directly by an AgentTask child at assignment time (not by the
        # factory itself) - verify the caller is a task the factory actually
        # deployed, rather than trusting any address that claims to be one.
        factory = gl.get_contract_at(Address(self.task_factory))
        assert factory.view().is_valid_task(caller), "Caller is not a registered task"
        assert self.agent_active.get(agent_address, False), "Agent is not active"
        self.agent_active_tasks[agent_address] = self.agent_active_tasks.get(agent_address, u256(0)) + 1

    @gl.public.write
    def record_task_outcome(self, agent_address: str, passed: bool, new_stake: int) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.task_factory, "Only the task factory can call this"
        assert self.agent_active.get(agent_address, False), "Agent is not active"

        current_active = self.agent_active_tasks.get(agent_address, u256(0))
        if current_active > 0:
            self.agent_active_tasks[agent_address] = current_active - 1

        rep = self.agent_reputation.get(agent_address, REPUTATION_START)
        if passed:
            new_rep = rep + REPUTATION_GAIN
            self.agent_reputation[agent_address] = new_rep if new_rep <= REPUTATION_CAP else REPUTATION_CAP
        else:
            new_rep = rep - REPUTATION_SLASH if rep > REPUTATION_SLASH else u256(0)
            self.agent_reputation[agent_address] = new_rep

        self.agent_stake[agent_address] = u256(new_stake)

    @gl.public.view
    def get_agent(self, agent_address: str) -> dict:
        return {
            "address": agent_address,
            "capabilities": self.agent_capabilities.get(agent_address, ""),
            "stake": self.agent_stake.get(agent_address, u256(0)),
            "reputation": self.agent_reputation.get(agent_address, u256(0)),
            "active_tasks": self.agent_active_tasks.get(agent_address, u256(0)),
            "active": self.agent_active.get(agent_address, False),
        }

    @gl.public.view
    def get_all_agents(self) -> list[str]:
        return [a for a in self.agent_addresses]
