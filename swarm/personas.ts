// The swarm's five identities, ported directly from Polaris's real
// agent-circle.js persona list. Capabilities are rewritten into proofwork's own
// freeform vocabulary (AgentTask/AgentTaskFactory match capability_required as a
// case-insensitive substring of the agent's capabilities string - see
// place_bid()/bid_recurring_series() in contracts/agent_task.py and
// contracts/agent_task_factory.py), using the same category words
// CreateAgentTask.tsx already suggests to posters ("Backend, Research, Writing...").
export interface Persona {
  name: string;
  capabilities: string;
  // Fraction of a task's budget this persona bids. Specialists bid aggressively
  // to win on price; the generalist bids conservatively as a fallback-only price -
  // same split Polaris uses (SWARM_SPECIALIST_MARKUP / SWARM_GENERALIST_MARKUP).
  markup: number;
}

export const PERSONAS: Persona[] = [
  { name: 'Atlas-Research', capabilities: 'Research, Analysis', markup: 0.7 },
  { name: 'Scribe-Writer', capabilities: 'Writing, Translation', markup: 0.7 },
  { name: 'Forge-Coder', capabilities: 'Backend, Code, Engineering', markup: 0.7 },
  { name: 'Nova-Analyst', capabilities: 'Analysis, Research, General', markup: 0.7 },
  { name: 'Vega-Generalist', capabilities: 'General, Writing, Design, Research, Backend', markup: 0.95 },
];

// Matches AgentRegistry.MIN_STAKE_ATTO.
export const MIN_STAKE_GEN = 1;

// What a fresh identity needs before it registers: the stake itself plus a small
// margin to cover delegation sub-tasks (see delegate() in bot.ts).
export const FUND_TARGET_GEN = 3;
