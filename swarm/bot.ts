// Autonomous swarm bot for proofwork's AGENTS economy - the GenLayer-side
// equivalent of Polaris's server/agent-circle.js. See swarm/README.md for the
// full list of deliberate deviations from Polaris (no backend indexer, no
// Circle custody, gist-hosted deliverables, tighter poll interval).
import {
  registerAgent,
  getAgent,
  getAllAgents,
  getAllAgentTaskAddresses,
  getAgentTaskState,
  getAgentTaskBids,
  getAgentTaskEscrowStatus,
  getAttestation,
  getSeriesCount,
  getSeries,
  getSeriesBids,
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
import { startStatusServer, type SwarmStatus, type PlatformIndex } from './server';

// Studionet rate-limits to 500 req/hr per IP. A zero-task cycle costs ~8
// calls; each *active* (not-yet-fully-done) task adds ~3 more, tasks whose
// bidding has closed drop to ~2 (bids frozen and cached), and fully done
// tasks (terminal + escrow released) cost 0 forever (see doneTaskCache/
// closedBidsCache) - so steady-state cost now tracks active task volume, not
// total platform history. 120s keeps a handful of concurrently-active tasks
// comfortably under budget; this can still be tripped by a burst of many
// simultaneously-open tasks, matching the documented "fine at demo scale"
// tradeoff for the full-poll approach.
const POLL_INTERVAL_MS = 120_000;
const MAX_BIDS = 3; // per-persona open-bid cap, mirrors Polaris's SWARM_MAX_BIDS
const MAX_INFLIGHT = 1; // per-persona concurrent work capacity
const REPUTATION_FLOOR = 70; // mirrors AgentTask.REPUTATION_FLOOR
const BID_ETA_HOURS = 1; // best possible speed_score in the bid formula
const WORK_MIN_MS = 60_000;
const WORK_MAX_MS = 180_000;
const DELEGATE_MARGIN = 0.8; // fraction of the winning price passed to a delegated peer
const TERMINAL = new Set(['verified', 'rejected', 'cancelled', 'expired']);
const RELEASE_WINDOW_SECONDS = 86400; // matches AgentTaskFactory.RELEASE_WINDOW_SECONDS

interface RunningIdentity extends Identity {
  client: ReturnType<typeof buildClient>;
  info?: Awaited<ReturnType<typeof getAgent>>;
  biddedTasks: Set<string>;
  biddedSeries: Set<number>;
  working: Set<string>;
  delegated: Set<string>;
}

const seriesMembershipCache = new Map<string, number>();

// A task's bids are immutable once bidding closes (status leaves 'open'), and
// nothing about it will ever change again once it's terminal AND its escrow
// is released - so both are cached permanently rather than re-fetched every
// cycle forever. Without this, per-cycle RPC cost grows with the platform's
// entire task history instead of just its currently-active tasks, which is
// what actually tripped the 500req/hr limit once real tasks existed.
const closedBidsCache = new Map<string, { agent: string; price: number; eta_hours: number }[]>();
const doneTaskCache = new Map<string, PlatformIndex['tasks'][number]>();

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

// Mirrors Polaris's GET /api/index (server/indexer.js) - a single aggregate
// dashboard endpoint over agents + tasks + recurring series, rather than
// granular per-resource REST routes. Polaris builds this by replaying local
// on-chain event-log caches; proofwork's GenLayer contracts already hold
// canonical current state, so this is a direct read + the same TTL-cached
// single-flight pattern (see server.ts), no event replay needed.
async function buildIndex(
  readClient: any,
  identities: RunningIdentity[],
  taskStates: [string, AgentTaskState][],
  seriesStates: [number, RecurringSeries][],
  escrowByTask: Map<string, { lockedAmount: number; released: boolean }>,
): Promise<PlatformIndex> {
  const now = Math.floor(Date.now() / 1000);

  // Reuse the registration pass's getAgent results for the swarm's own
  // identities instead of re-fetching them here - this was silently doubling
  // RPC usage every cycle and is most of why Studionet's 500req/hr limit was
  // getting tripped even with zero tasks posted.
  const knownByAddress = new Map(identities.map((id) => [id.address.toLowerCase(), id]));
  const agentAddresses = await getAllAgents(NETWORK);
  const agents = await Promise.all(
    agentAddresses.map(async (address) => {
      const info = knownByAddress.get(address.toLowerCase())?.info ?? (await getAgent(NETWORK, address));
      return {
        address,
        name: info.name,
        capabilities: info.capabilities.split(',').map((c) => c.trim()).filter(Boolean),
        stakeGen: info.stake,
        reputation: info.reputation,
        activeTasks: info.active_tasks,
        online: info.active,
        registered: info.registered,
      };
    }),
  );

  const freshlyBuilt = await Promise.all(
    taskStates.map(async ([address, state]) => {
      const escrow = escrowByTask.get(address)!;
      let rawBids = closedBidsCache.get(address);
      if (!rawBids) {
        rawBids = await getAgentTaskBids(readClient, address);
        if (state.status !== 'open') closedBidsCache.set(address, rawBids);
      }
      const releaseEligible =
        !escrow.released &&
        TERMINAL.has(state.status) &&
        (state.status === 'cancelled' ||
          state.status === 'expired' ||
          (state.verified_at > 0 && now >= state.verified_at + RELEASE_WINDOW_SECONDS));
      const built = {
        address,
        ref: address.slice(2, 10).toUpperCase(),
        requester: state.requester,
        title: state.title,
        description: state.description,
        criteria: state.criteria,
        capabilityRequired: state.capability_required,
        budgetGen: state.budget,
        deadlineMs: state.deadline * 1000,
        biddingDeadlineMs: state.bidding_deadline * 1000,
        bidCount: state.bid_count,
        bids: rawBids.map((b) => ({ agent: b.agent, priceGen: b.price, etaHours: b.eta_hours })),
        status: state.status,
        assignedAgent: state.assigned_agent || null,
        assignedPriceGen: state.assigned_price,
        submissionUrl: state.submission_url,
        submissionNote: state.submission_note,
        createdAtMs: state.created_at * 1000,
        verifiedAtMs: state.verified_at ? state.verified_at * 1000 : null,
        disputeCount: state.dispute_count,
        escrowedGen: escrow.lockedAmount,
        escrowReleased: escrow.released,
        releaseEligible,
      };
      // Fully done - cache it forever and skip it entirely on future cycles
      // (see the doneAddrs split at the top of runCycle).
      if (TERMINAL.has(state.status) && escrow.released) doneTaskCache.set(address, built);
      return built;
    }),
  );
  const tasks = [...freshlyBuilt, ...doneTaskCache.values()].filter(
    (t, i, arr) => arr.findIndex((x) => x.address === t.address) === i,
  );
  tasks.sort((a, b) => b.createdAtMs - a.createdAtMs);

  const series = await Promise.all(
    seriesStates.map(async ([id, s]) => {
      const rawBids = s.awarded ? [] : await getSeriesBids(NETWORK, id);
      return {
        id,
        requester: s.requester,
        title: s.title,
        capabilityRequired: s.capability_required,
        budgetPerOccurrenceGen: s.budget_per_occurrence,
        remaining: s.remaining,
        active: s.active,
        awarded: s.awarded,
        biddingDeadlineMs: s.bidding_deadline * 1000,
        bidCount: s.bid_count,
        bids: rawBids.map((b) => ({ agent: b.agent, priceGen: b.price, etaHours: b.eta_hours })),
        committedAgent: s.committed_agent || null,
        committedPriceGen: s.committed_price,
      };
    }),
  );

  const totals = {
    totalTasks: tasks.length,
    openTasks: tasks.filter((t) => t.status === 'open').length,
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.online).length,
    totalSeries: series.length,
    totalGenSettled: tasks.filter((t) => t.escrowReleased).reduce((sum, t) => sum + t.escrowedGen, 0),
    totalGenInEscrow: tasks.filter((t) => !t.escrowReleased).reduce((sum, t) => sum + t.escrowedGen, 0),
  };

  return { network: NETWORK, indexedAtMs: Date.now(), totals, agents, tasks, series };
}

async function runCycle(
  identities: RunningIdentity[],
  readClient: any,
  closerClient: any,
): Promise<PlatformIndex> {
  const now = Math.floor(Date.now() / 1000);

  const [taskAddrs, seriesCount] = await Promise.all([getAllAgentTaskAddresses(NETWORK), getSeriesCount(NETWORK)]);

  // Tasks already fully done (terminal + escrow released) never change again -
  // skip fetching them entirely. Every other phase below (registration,
  // close/award, settlement sweep, bidding) only needs the live ones anyway.
  const liveAddrs = taskAddrs.filter((a) => !doneTaskCache.has(a));

  const taskStates: [string, AgentTaskState][] = await Promise.all(
    liveAddrs.map(async (addr) => [addr, await getAgentTaskState(readClient, addr)] as [string, AgentTaskState]),
  );
  const seriesIds = Array.from({ length: seriesCount }, (_, i) => i + 1);
  const seriesStates: [number, RecurringSeries][] = await Promise.all(
    seriesIds.map(async (id) => [id, await getSeries(NETWORK, id)] as [number, RecurringSeries]),
  );

  await Promise.all(liveAddrs.filter((a) => !seriesMembershipCache.has(a)).map((a) => seriesIdForTask(a)));

  // Escrow status per task, fetched once and reused by both the settlement
  // sweep below and buildIndex - was previously fetched twice per task.
  const escrowByTask = new Map<string, { lockedAmount: number; released: boolean }>();
  await Promise.all(
    liveAddrs.map(async (addr) => {
      escrowByTask.set(addr, await getAgentTaskEscrowStatus(NETWORK, addr));
    }),
  );

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

  // Settlement sweep: this is permissionless housekeeping (release_funds,
  // advance_recurring_series), so it runs for every terminal task and every
  // due series on the platform - not just tasks assigned to the swarm's own
  // 5 identities. Any registered agent (a real user's wallet included) gets
  // the same autonomous settlement, even though only the swarm's own
  // identities can autonomously bid/work (that needs the agent's private key,
  // which the platform never holds for a user's own wallet).
  for (const [addr, state] of taskStates) {
    if (!TERMINAL.has(state.status)) continue;
    const escrow = escrowByTask.get(addr)!;
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
    if (now < series.next_advance_at) continue;
    const current = latestTaskForSeries(sid, taskStates);
    let addr: string;
    if (current) {
      const [liveAddr, state] = current;
      if (!TERMINAL.has(state.status)) continue;
      if (!escrowByTask.get(liveAddr)!.released) continue;
      addr = liveAddr;
    } else {
      // The current occurrence may already be fully done and skipped from
      // this cycle's live fetch entirely - fall back to the done-task cache,
      // which by construction is always terminal + released.
      const doneMatches = [...doneTaskCache.entries()].filter(([a]) => seriesMembershipCache.get(a) === sid);
      if (!doneMatches.length) continue;
      doneMatches.sort((a, b) => b[1].createdAtMs - a[1].createdAtMs);
      addr = doneMatches[0][0];
    }
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

  return buildIndex(readClient, identities, taskStates, seriesStates, escrowByTask);
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

  const startedAt = new Date().toISOString();
  let lastCycleAt: string | null = null;
  let lastCycleError: string | null = null;
  let cycleCount = 0;
  let latestIndex: PlatformIndex | null = null;

  startStatusServer(
    (): SwarmStatus => ({
      network: NETWORK,
      startedAt,
      lastCycleAt,
      lastCycleError,
      cycleCount,
      identities: identities.map((id) => ({
        name: id.persona.name,
        address: id.address,
        registered: id.info?.registered ?? false,
        active: id.info?.active ?? false,
        reputation: id.info?.reputation ?? 0,
        stake: id.info?.stake ?? 0,
        activeTasks: id.info?.active_tasks ?? 0,
      })),
    }),
    () => latestIndex,
  );

  while (true) {
    try {
      latestIndex = await runCycle(identities, readClient, closerClient);
      lastCycleError = null;
    } catch (e: any) {
      lastCycleError = e.message;
      console.error('cycle error:', e.message);
    }
    lastCycleAt = new Date().toISOString();
    cycleCount += 1;
    await sleep(POLL_INTERVAL_MS);
  }
}

main();
