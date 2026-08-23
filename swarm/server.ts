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

// A minimal status endpoint so this can run as a proper Railway web service
// (health checks, and optionally the frontend showing swarm status) - the bot
// has no other reason to speak HTTP, all real work happens via GenLayer RPC.
export function startStatusServer(getStatus: () => SwarmStatus) {
  const port = Number(process.env.PORT) || 8080;
  const server = createServer((req, res) => {
    if (req.url === '/status' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getStatus(), null, 2));
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
    console.log(`Status server listening on :${port} (/status, /health)`);
  });
  return server;
}
