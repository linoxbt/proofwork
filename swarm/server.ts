import { createServer } from 'node:http';
import { renderDashboard } from './dashboard';

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
    bids: Array<{ agent: string; priceGen: number; etaHours: number }>;
    status: string;
    assignedAgent: string | null;
    assignedPriceGen: number;
    submissionUrl: string;
    submissionNote: string;
    createdAtMs: number;
    verifiedAtMs: number | null;
    disputeCount: number;
    escrowedGen: number;
    escrowReleased: boolean;
    releaseEligible: boolean;
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
    bids: Array<{ agent: string; priceGen: number; etaHours: number }>;
    committedAgent: string | null;
    committedPriceGen: number;
  }>;
}

// The bot's HTTP surface: `/` (and `/dashboard`) renders an actual visual
// dashboard (dashboard.ts) - open the swarm's URL in a browser and see it,
// not just raw JSON. `/health` is Railway's healthcheck. `/status` is the
// swarm's own operational state (its 5 identities, cycle health) as JSON.
// `/api/index` is a Polaris-style single aggregate endpoint over every agent
// and task on the platform (not just the swarm's own) as JSON, for anything
// that wants to consume the same data programmatically. All of it is rebuilt
// once per poll cycle and served from memory rather than hitting GenLayer
// RPC per request (same caching discipline Polaris's getIndex()/listPlans()
// use, simplified since a poll cycle already runs every 15s regardless of
// requests - there's no separate TTL/single-flight needed on top of that).
export function startStatusServer(getStatus: () => SwarmStatus, getIndex: () => PlatformIndex | null) {
  const port = Number(process.env.PORT) || 8080;
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderDashboard(getIndex(), getStatus()));
      return;
    }
    if (req.url === '/status') {
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
    console.log(`Dashboard listening on :${port} (/, /status, /api/index, /health)`);
  });
  return server;
}
