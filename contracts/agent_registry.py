# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ProofWork AgentRegistry - on-chain identity, stake, and reputation for
# autonomous AI agents. A close port of Polaris's AgentRegistry.sol, adapted
# to GenLayer: native GEN instead of USDC (stake minimum scaled down for
# testnet-practical GEN balances, not Polaris's literal 100), and reputation/
# stake bookkeeping only - no separate agentId, since a wallet address is
# identity enough here.
#
# Deployed once per network, separate from the human task board's
# TaskFactory/TaskVerifier. AgentTaskFactory (see agent_task_factory.py) is
# the only address ever allowed to record task outcomes here, set once via
# `set_task_factory` right after both are deployed.
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

MIN_STAKE_ATTO = u256(1) * u256(10**18)  # Polaris uses 100 USDC; scaled down for GEN testnet practicality
REPUTATION_START = u256(100)
REPUTATION_CAP = u256(1000)
REPUTATION_SLASH = u256(50)  # per failed/timed-out task
STAKE_SLASH_BPS = u256(1000)  # 10.00%, in basis points of the agent's current stake


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
    agent_registered: TreeMap[str, bool]  # true forever once ever registered
    agent_name: TreeMap[str, str]  # matches Polaris's register(agentId, stake, name, capabilities)
    agent_capabilities: TreeMap[str, str]
    agent_stake: TreeMap[str, u256]
    agent_reputation: TreeMap[str, u256]
    agent_active_tasks: TreeMap[str, u256]
    agent_active: TreeMap[str, bool]  # online/offline toggle - can only bid while true

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
    def register_agent(self, name: str, capabilities: str) -> None:
        caller = str(gl.message.sender_address)
        assert not self.agent_registered.get(caller, False), "Already registered"
        assert gl.message.value >= MIN_STAKE_ATTO, "Stake below the minimum"
        assert name.strip() != "", "Name cannot be empty"
        assert capabilities.strip() != "", "Capabilities cannot be empty"

        self.agent_addresses.append(caller)
        self.agent_registered[caller] = True
        self.agent_name[caller] = name
        self.agent_capabilities[caller] = capabilities
        self.agent_stake[caller] = gl.message.value
        self.agent_reputation[caller] = REPUTATION_START
        self.agent_active_tasks[caller] = u256(0)
        self.agent_active[caller] = True

    @gl.public.write
    def go_offline(self) -> None:
        """Step 1 of exit: stop bidding, keep the stake locked (matches
        Polaris's separate deactivate()/withdrawStake() two-step exit)."""
        caller = str(gl.message.sender_address)
        assert self.agent_active.get(caller, False), "Not currently online"
        assert self.agent_active_tasks.get(caller, u256(0)) == 0, "Cannot go offline with active tasks"
        self.agent_active[caller] = False

    @gl.public.write
    def withdraw_stake(self) -> None:
        """Step 2 of exit: reclaim the stake, only once offline."""
        caller_addr = gl.message.sender_address
        caller = str(caller_addr)
        assert self.agent_registered.get(caller, False), "Not a registered agent"
        assert not self.agent_active.get(caller, False), "Go offline before withdrawing"

        refund = self.agent_stake.get(caller, u256(0))
        self.agent_stake[caller] = u256(0)
        if refund > 0:
            _Recipient(caller_addr).emit_transfer(value=refund)

    @gl.public.write.payable
    def restake(self) -> None:
        """Come back online, optionally topping up the stake in the same call."""
        caller = str(gl.message.sender_address)
        assert self.agent_registered.get(caller, False), "Not a registered agent"
        assert not self.agent_active.get(caller, False), "Already online"

        new_total = self.agent_stake.get(caller, u256(0)) + gl.message.value
        assert new_total >= MIN_STAKE_ATTO, "Total stake below the minimum"
        self.agent_stake[caller] = new_total
        self.agent_active[caller] = True

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
    def record_task_outcome(self, agent_address: str, passed: bool, score: int, new_stake: int) -> None:
        caller = str(gl.message.sender_address)
        assert caller == self.task_factory, "Only the task factory can call this"
        assert self.agent_registered.get(agent_address, False), "Agent is not registered"

        current_active = self.agent_active_tasks.get(agent_address, u256(0))
        if current_active > 0:
            self.agent_active_tasks[agent_address] = current_active - 1

        rep = self.agent_reputation.get(agent_address, REPUTATION_START)
        if passed:
            # Tiered gain, matching Polaris: a stronger score earns more.
            if score > 85:
                gain = u256(10)
            elif score >= 70:
                gain = u256(5)
            else:
                gain = u256(2)
            new_rep = rep + gain
            self.agent_reputation[agent_address] = new_rep if new_rep <= REPUTATION_CAP else REPUTATION_CAP
        else:
            new_rep = rep - REPUTATION_SLASH if rep > REPUTATION_SLASH else u256(0)
            self.agent_reputation[agent_address] = new_rep

        self.agent_stake[agent_address] = u256(new_stake)

    @gl.public.view
    def get_agent(self, agent_address: str) -> dict:
        return {
            "address": agent_address,
            "registered": self.agent_registered.get(agent_address, False),
            "name": self.agent_name.get(agent_address, ""),
            "capabilities": self.agent_capabilities.get(agent_address, ""),
            "stake": self.agent_stake.get(agent_address, u256(0)),
            "reputation": self.agent_reputation.get(agent_address, u256(0)),
            "active_tasks": self.agent_active_tasks.get(agent_address, u256(0)),
            "active": self.agent_active.get(agent_address, False),
        }

    @gl.public.view
    def get_all_agents(self) -> list[str]:
        return [a for a in self.agent_addresses]
