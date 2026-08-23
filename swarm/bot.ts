// Autonomous swarm bot for proofwork's AGENTS economy - the GenLayer-side
// equivalent of Polaris's server/agent-circle.js. See swarm/README.md for the
// full list of deliberate deviations from Polaris (no backend indexer, no
// Circle custody, gist-hosted deliverables, tighter poll interval).
import {
  registerAgent,
  getAgent,
  getAllAgentTaskAddresses,
  getAgentTaskState,
  getAgentTaskEscrowStatus,
  getAttestation,
  getSeriesCount,
  getSeries,
  getSeriesForTask,
  placeBid,
  closeBiddingAndAssign,
  submitDeliverable,
  requestAgentVerification,
  releaseAgentTaskFunds,
  bidRecurringSeries,
  awardRecurringSeries,
  advanceRecurringSeries,
  createDirectTask,
  type AgentTaskState,
  type RecurringSeries,
} from '../src/lib/agentContract';
import { PERSONAS, MIN_STAKE_GEN, FUND_TARGET_GEN, type Persona } from './personas';
import { loadOrCreateIdentities, type Identity } from './identities';
import { buildClient, buildReadOnlyClient, getBalanceWei, fmtGen, NETWORK } from './client';
import { produceDeliverable } from './deliverable';

const POLL_INTERVAL_MS = 15_000;
const MAX_BIDS = 3; // per-persona open-bid cap, mirrors Polaris's SWARM_MAX_BIDS
const MAX_INFLIGHT = 1; // per-persona concurrent work capacity
const REPUTATION_FLOOR = 70; // mirrors AgentTask.REPUTATION_FLOOR
const BID_ETA_HOURS = 1; // best possible speed_score in the bid formula
const WORK_MIN_MS = 60_000;
const WORK_MAX_MS = 180_000;
const DELEGATE_MARGIN = 0.8; // fraction of the winning price passed to a delegated peer
const TERMINAL = new Set(['verified', 'rejected', 'cancelled', 'expired']);

interface RunningIdentity extends Identity {
  client: ReturnType<typeof buildClient>;
  info?: Awaited<ReturnType<typeof getAgent>>;
  biddedTasks: Set<string>;
  biddedSeries: Set<number>;
  working: Set<string>;
  delegated: Set<string>;
}

const seriesMembershipCache = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}

function short(address: string) {
  return address.slice(0, 8);
}

function wants(persona: Persona, capabilityRequired: string): boolean {
  const req = capabilityRequired.trim().toLowerCase();
  if (!req) return true;
  return persona.capabilities.toLowerCase().includes(req);
}

async function maybeRegister(id: RunningIdentity) {
  const balance = await getBalanceWei(id.address);
  const needed = BigInt(Math.round(FUND_TARGET_GEN * 1e18));
  if (balance < needed) {
    console.log(
      `[${id.persona.name} ${short(id.address)}] waiting for funding - balance ${fmtGen(balance)} GEN, ` +
        `need ~${FUND_TARGET_GEN} GEN. Fund via https://studio.genlayer.com (\u{1F4A7} faucet in the account selector).`,
    );
    return;
  }
  console.log(`[${id.persona.name} ${short(id.address)}] registering with ${MIN_STAKE_GEN} GEN stake...`);
  await registerAgent(id.client, NETWORK, id.persona.name, id.persona.capabilities, MIN_STAKE_GEN);
  console.log(`[${id.persona.name} ${short(id.address)}] registered.`);
}

async function seriesIdForTask(addr: string): Promise<number> {
  if (seriesMembershipCache.has(addr)) return seriesMembershipCache.get(addr)!;
  const sid = await getSeriesForTask(NETWORK, addr);
  seriesMembershipCache.set(addr, sid);
  return sid;
}

function latestTaskForSeries(
  seriesId: number,
  taskStates: [string, AgentTaskState][],
): [string, AgentTaskState] | null {
  const matches = taskStates.filter(([addr]) => seriesMembershipCache.get(addr) === seriesId);
  if (!matches.length) return null;
  matches.sort((a, b) => b[1].created_at - a[1].created_at);
  return matches[0];
}

async function waitForAttestation(client: any, addr: string, deadlineUnixSeconds: number) {
  while (Math.floor(Date.now() / 1000) < deadlineUnixSeconds) {
    const attestation = await getAttestation(client, addr);
    if (attestation.passed !== null) return attestation;
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function fulfil(id: RunningIdentity, addr: string, state: AgentTaskState) {
  const delay = randInt(WORK_MIN_MS, WORK_MAX_MS);
  console.log(
    `[${id.persona.name} ${short(id.address)}] won "${state.title}" - working (~${Math.round(delay / 1000)}s)...`,
  );
  await sleep(delay);
  const { url, note } = await produceDeliverable(state);
  await submitDeliverable(id.client, addr, url, note);
  console.log(`[${id.persona.name} ${short(id.address)}] submitted deliverable for "${state.title}": ${url}`);
  await requestAgentVerification(id.client, addr);
  console.log(`[${id.persona.name} ${short(id.address)}] requested verification for "${state.title}"`);
}

async function delegate(id: RunningIdentity, addr: string, state: AgentTaskState, identities: RunningIdentity[]) {
  const peer = identities.find(
    (p) => p !== id && p.info?.active && p.info.active_tasks === 0 && wants(p.persona, state.capability_required),
  );
  if (!peer) {
    console.log(
      `[${id.persona.name}] at capacity, no idle peer to delegate "${state.title}" to - fulfilling directly.`,
    );
    return fulfil(id, addr, state);
  }

  const subBudget = Math.max(1, Math.floor(state.assigned_price * DELEGATE_MARGIN));
  const deadlineUnixSeconds = state.deadline - 60; // leave buffer to submit to the original task in time
  console.log(
    `[${id.persona.name}] at capacity - delegating "${state.title}" to ${peer.persona.name} (sub-budget ${subBudget} GEN)`,
  );

  const subAddr = await createDirectTask(id.client, NETWORK, {
    title: `[delegated] ${state.title}`,
    description: state.description,
    criteria: state.criteria,
    capabilityRequired: state.capability_required,
    agentAddress: peer.address,
    budget: subBudget,
    deadlineUnixSeconds,
  });

  const result = await waitForAttestation(id.client, subAddr, deadlineUnixSeconds);
  if (result?.passed && result.deliverable_url) {
    await submitDeliverable(id.client, addr, result.deliverable_url, `Delegated to ${peer.persona.name}.`);
    await requestAgentVerification(id.client, addr);
    console.log(`[${id.persona.name}] delegated work for "${state.title}" passed - submitted upstream.`);
  } else {
    console.log(
      `[${id.persona.name}] delegation to ${peer.persona.name} didn't pass in time - fulfilling "${state.title}" directly instead.`,
    );
    await fulfil(id, addr, state);
  }
  await releaseAgentTaskFunds(id.client, NETWORK, subAddr).catch(() => {});
}

async function runCycle(identities: RunningIdentity[], readClient: any, closerClient: any) {
  const now = Math.floor(Date.now() / 1000);

  const [taskAddrs, seriesCount] = await Promise.all([getAllAgentTaskAddresses(NETWORK), getSeriesCount(NETWORK)]);

  const taskStates: [string, AgentTaskState][] = await Promise.all(
    taskAddrs.map(async (addr) => [addr, await getAgentTaskState(readClient, addr)] as [string, AgentTaskState]),
  );
  const seriesIds = Array.from({ length: seriesCount }, (_, i) => i + 1);
  const seriesStates: [number, RecurringSeries][] = await Promise.all(
    seriesIds.map(async (id) => [id, await getSeries(NETWORK, id)] as [number, RecurringSeries]),
  );

  await Promise.all(taskAddrs.filter((a) => !seriesMembershipCache.has(a)).map((a) => seriesIdForTask(a)));

  // Registration pass - refresh every identity's on-chain state for this cycle.
  for (const id of identities) {
    id.info = await getAgent(NETWORK, id.address);
    if (!id.info.registered) {
      await maybeRegister(id).catch((e: any) => console.error(`[${id.persona.name}] registration failed: ${e.message}`));
      continue;
    }
    if (!id.info.active) {
      console.log(`[${id.persona.name} ${short(id.address)}] offline, skipping this cycle.`);
    }
  }

  // Close/award anything past its bidding deadline - permissionless, idempotent
  // on-chain, so whichever tick notices first just does it.
  for (const [addr, state] of taskStates) {
    if (state.status === 'open' && now > state.bidding_deadline) {
      try {
        await closeBiddingAndAssign(closerClient, addr);
        console.log(`closed bidding for "${state.title}"`);
      } catch {
        // already closed by a concurrent identity, or nothing to do - ignore
      }
    }
  }
  for (const [sid, series] of seriesStates) {
    if (series.active && !series.awarded && now > series.bidding_deadline) {
      try {
        await awardRecurringSeries(closerClient, NETWORK, sid);
        console.log(`awarded series #${sid} "${series.title}"`);
      } catch {
        // ignore - same idempotency reasoning as above
      }
    }
  }

  // Settlement sweep: release funds and advance series for our own terminal tasks.
  const myAddresses = new Set(identities.map((i) => i.address.toLowerCase()));
  for (const [addr, state] of taskStates) {
    if (!TERMINAL.has(state.status)) continue;
    if (!state.assigned_agent || !myAddresses.has(state.assigned_agent.toLowerCase())) continue;
    const escrow = await getAgentTaskEscrowStatus(NETWORK, addr);
    if (escrow.released) continue;
    try {
      await releaseAgentTaskFunds(closerClient, NETWORK, addr);
      console.log(`released funds for "${state.title}" (${state.status})`);
    } catch {
      // 24h dispute window likely still open - expected, try again next cycle
    }
  }
  for (const [sid, series] of seriesStates) {
    if (!series.active || !series.awarded) continue;
    if (!series.committed_agent || !myAddresses.has(series.committed_agent.toLowerCase())) continue;
    if (now < series.next_advance_at) continue;
    const current = latestTaskForSeries(sid, taskStates);
    if (!current) continue;
    const [addr, state] = current;
    if (!TERMINAL.has(state.status)) continue;
    const escrow = await getAgentTaskEscrowStatus(NETWORK, addr);
    if (!escrow.released) continue;
    try {
      await advanceRecurringSeries(closerClient, NETWORK, addr);
      console.log(`advanced series #${sid} "${series.title}"`);
    } catch {
      // ignore - series may already be exhausted or ahead of schedule
    }
  }

  // Bidding + work, per identity.
  for (const id of identities) {
    if (!id.info?.active) continue;
    const atCapacity = id.info.active_tasks >= MAX_INFLIGHT;

    for (const [addr, state] of taskStates) {
      if (state.status !== 'open') {
        id.biddedTasks.delete(addr);
        continue;
      }
      if (now > state.bidding_deadline) continue;
      if (id.biddedTasks.has(addr)) continue;
      if (id.biddedTasks.size >= MAX_BIDS) continue;
      if (id.info.reputation < REPUTATION_FLOOR) continue;
      if (!wants(id.persona, state.capability_required)) continue;
      if (atCapacity) continue;

      const price = Math.max(1, Math.round(id.persona.markup * state.budget));
      try {
        await placeBid(id.client, addr, price, BID_ETA_HOURS);
        id.biddedTasks.add(addr);
        console.log(`[${id.persona.name} ${short(id.address)}] bid ${price} GEN on "${state.title}"`);
      } catch (e: any) {
        console.error(`[${id.persona.name}] bid failed on "${state.title}": ${e.message}`);
      }
    }

    for (const [sid, series] of seriesStates) {
      if (!series.active || series.awarded) continue;
      if (now > series.bidding_deadline) continue;
      if (id.biddedSeries.has(sid)) continue;
      if (id.info.reputation < REPUTATION_FLOOR) continue;
      if (!wants(id.persona, series.capability_required)) continue;

      const price = Math.max(1, Math.round(id.persona.markup * series.budget_per_occurrence));
      try {
        await bidRecurringSeries(id.client, NETWORK, sid, price, BID_ETA_HOURS);
        id.biddedSeries.add(sid);
        console.log(`[${id.persona.name} ${short(id.address)}] bid ${price} GEN/occurrence on series #${sid} "${series.title}"`);
      } catch (e: any) {
        console.error(`[${id.persona.name}] series bid failed on #${sid}: ${e.message}`);
      }
    }

    for (const [addr, state] of taskStates) {
      if (state.status !== 'assigned') continue;
      if (!state.assigned_agent || state.assigned_agent.toLowerCase() !== id.address.toLowerCase()) continue;
      if (id.working.has(addr) || id.delegated.has(addr)) continue;

      const busy = id.info.active_tasks > MAX_INFLIGHT;
      if (busy) {
        id.delegated.add(addr);
        delegate(id, addr, state, identities).catch((e: any) =>
          console.error(`[${id.persona.name}] delegation failed: ${e.message}`),
        );
      } else {
        id.working.add(addr);
        fulfil(id, addr, state)
          .catch((e: any) => console.error(`[${id.persona.name}] fulfil failed: ${e.message}`))
          .finally(() => id.working.delete(addr));
      }
    }
  }
}

async function main() {
  const identities = loadOrCreateIdentities(PERSONAS).map(
    (identity): RunningIdentity => ({
      ...identity,
      client: buildClient(identity.privateKey),
      biddedTasks: new Set(),
      biddedSeries: new Set(),
      working: new Set(),
      delegated: new Set(),
    }),
  );

  console.log('proofwork swarm starting. Identities:');
  for (const id of identities) console.log(`  ${id.persona.name}: ${id.address}`);
  console.log('Fund each with a few GEN via https://studio.genlayer.com (\u{1F4A7} faucet) if not already funded.\n');

  const readClient = buildReadOnlyClient();
  const closerClient = identities[0].client; // any client works for permissionless calls

  while (true) {
    try {
      await runCycle(identities, readClient, closerClient);
    } catch (e: any) {
      console.error('cycle error:', e.message);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main();
