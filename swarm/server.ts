import { createServer } from 'node:http';

export interface SwarmStatus {
  network: string;
  startedAt: string;
  lastCycleAt: string | null;
  lastCycleError: string | null;
  cycleCount: number;
  identities: Array<{
    name: string;
    address: string;
    registered: boolean;
    active: boolean;
    reputation: number;
    stake: number;
    activeTasks: number;
  }>;
}

// Mirrors the shape Polaris's GET /api/index returns (agents/tasks aggregate
// for the whole platform) - see buildIndex() in bot.ts for how this is built.
export interface PlatformIndex {
  network: string;
  indexedAtMs: number;
  totals: {
    totalTasks: number;
    openTasks: number;
    totalAgents: number;
    activeAgents: number;
    totalSeries: number;
    totalGenSettled: number;
    totalGenInEscrow: number;
  };
  agents: Array<{
    address: string;
    name: string;
    capabilities: string[];
    stakeGen: number;
    reputation: number;
    activeTasks: number;
    online: boolean;
    registered: boolean;
  }>;
  tasks: Array<{
    address: string;
    ref: string;
    requester: string;
    title: string;
    description: string;
    criteria: string;
    capabilityRequired: string;
    budgetGen: number;
    deadlineMs: number;
    biddingDeadlineMs: number;
    bidCount: number;
    status: string;
    assignedAgent: string | null;
    assignedPriceGen: number;
    createdAtMs: number;
    verifiedAtMs: number | null;
    disputeCount: number;
    escrowedGen: number;
    escrowReleased: boolean;
  }>;
  series: Array<{
    id: number;
    requester: string;
    title: string;
    capabilityRequired: string;
    budgetPerOccurrenceGen: number;
    remaining: number;
    active: boolean;
    awarded: boolean;
    biddingDeadlineMs: number;
    bidCount: number;
    committedAgent: string | null;
    committedPriceGen: number;
  }>;
}

// The bot's HTTP surface: /health for Railway's healthcheck, /status for the
// swarm's own operational state (its 5 identities, cycle health), and
// /api/index - a Polaris-style single aggregate dashboard endpoint over every
// agent and task on the platform (not just the swarm's own), rebuilt once per
// poll cycle and served from memory rather than hitting GenLayer RPC per
// request (same caching discipline Polaris's getIndex()/listPlans() use,
// simplified since a poll cycle already runs every 15s regardless of
// requests - there's no separate TTL/single-flight needed on top of that).
export function startStatusServer(getStatus: () => SwarmStatus, getIndex: () => PlatformIndex | null) {
  const port = Number(process.env.PORT) || 8080;
  const server = createServer((req, res) => {
    if (req.url === '/status' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getStatus(), null, 2));
      return;
    }
    if (req.url === '/api/index') {
      const index = getIndex();
      if (!index) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'warming up - no completed poll cycle yet' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(index, null, 2));
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => {
    console.log(`Status server listening on :${port} (/status, /api/index, /health)`);
  });
  return server;
}
