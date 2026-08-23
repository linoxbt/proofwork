import type { SwarmStatus, PlatformIndex } from './server';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function timeAgo(ms: number | null): string {
  if (!ms) return '-';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  assigned: '#f59e0b',
  submitted: '#a855f7',
  verified: '#22c55e',
  rejected: '#ef4444',
  disputed: '#f97316',
  cancelled: '#6b7280',
  expired: '#6b7280',
};

function statusBadge(status: string): string {
  const color = STATUS_COLORS[status] || '#6b7280';
  return `<span class="badge" style="background:${color}22;color:${color};border-color:${color}55">${esc(status)}</span>`;
}

function statTile(label: string, value: string | number): string {
  return `<div class="tile"><div class="tile-value">${esc(String(value))}</div><div class="tile-label">${esc(label)}</div></div>`;
}

// A plain server-rendered HTML dashboard - the swarm's own HTTP endpoint IS
// the agent dashboard, not just a JSON API behind it. Auto-refreshes every
// 15s (matching the bot's poll interval) via a meta refresh, so there's no
// client-side JS/build step needed for a standalone Node service.
export function renderDashboard(index: PlatformIndex | null, status: SwarmStatus): string {
  const totals = index?.totals;

  const identityRows = status.identities
    .map(
      (id) => `
        <tr>
          <td>${esc(id.name)}</td>
          <td class="mono"><a href="https://explorer-studio.genlayer.com/address/${id.address}" target="_blank">${short(id.address)}</a></td>
          <td>${id.registered ? (id.active ? '<span class="dot dot-green"></span> online' : '<span class="dot dot-amber"></span> offline') : '<span class="dot dot-gray"></span> unregistered'}</td>
          <td>${id.reputation}</td>
          <td>${id.stake} GEN</td>
          <td>${id.activeTasks}</td>
        </tr>`,
    )
    .join('');

  const agentRows = (index?.agents ?? [])
    .map(
      (a) => `
        <tr>
          <td>${esc(a.name || 'Unnamed')}</td>
          <td class="mono">${short(a.address)}</td>
          <td>${esc(a.capabilities.join(', '))}</td>
          <td>${a.reputation}</td>
          <td>${a.stakeGen} GEN</td>
          <td>${a.online ? (a.activeTasks > 0 ? `busy (${a.activeTasks})` : 'idle') : 'offline'}</td>
        </tr>`,
    )
    .join('');

  const bidList = (bids: Array<{ agent: string; priceGen: number; etaHours: number }>) =>
    bids.length
      ? `<ul class="bidlist">${bids
          .map((b) => `<li><span class="mono">${short(b.agent)}</span> &middot; ${b.priceGen} GEN &middot; ${b.etaHours}h</li>`)
          .join('')}</ul>`
      : '<span class="sub">no bids</span>';

  const taskRows = (index?.tasks ?? [])
    .map(
      (t) => `
        <tr>
          <td>${esc(t.title)}<div class="sub mono">${t.ref}</div></td>
          <td>${statusBadge(t.status)}</td>
          <td>${t.budgetGen} GEN</td>
          <td>${t.assignedAgent ? `<span class="mono">${short(t.assignedAgent)}</span> @ ${t.assignedPriceGen} GEN` : '-'}</td>
          <td>${bidList(t.bids)}</td>
          <td>${t.submissionUrl ? `<a href="${esc(t.submissionUrl)}" target="_blank">view</a>${t.submissionNote ? `<div class="sub">${esc(t.submissionNote)}</div>` : ''}` : '<span class="sub">-</span>'}</td>
          <td class="sub">${timeAgo(t.createdAtMs)}</td>
        </tr>`,
    )
    .join('');

  const terminalTasks = (index?.tasks ?? []).filter((t) => ['verified', 'rejected', 'cancelled', 'expired'].includes(t.status));
  const settlementRows = terminalTasks
    .map(
      (t) => `
        <tr>
          <td>${esc(t.title)}<div class="sub mono">${t.ref}</div></td>
          <td>${statusBadge(t.status)}</td>
          <td>${t.status === 'verified' ? `agent (${short(t.assignedAgent || '')})` : 'requester'} &middot; ${t.escrowedGen} GEN</td>
          <td>
            ${
              t.escrowReleased
                ? '<span class="dot dot-green"></span> released'
                : t.releaseEligible
                  ? '<span class="dot dot-amber"></span> eligible now'
                  : `<span class="dot dot-gray"></span> locked${t.verifiedAtMs ? ` until ${new Date(t.verifiedAtMs + 86400000).toLocaleString()}` : ''}`
            }
          </td>
          <td class="sub">${timeAgo(t.verifiedAtMs ?? t.createdAtMs)}</td>
        </tr>`,
    )
    .join('');

  const seriesRows = (index?.series ?? [])
    .map(
      (s) => `
        <tr>
          <td>${esc(s.title)}<div class="sub">#${s.id}</div></td>
          <td>${s.active ? (s.awarded ? '<span class="dot dot-green"></span> awarded' : '<span class="dot dot-amber"></span> bidding') : '<span class="dot dot-gray"></span> closed'}</td>
          <td>${s.budgetPerOccurrenceGen} GEN/occurrence</td>
          <td>${s.remaining}</td>
          <td>${s.committedAgent ? `<span class="mono">${short(s.committedAgent)}</span> @ ${s.committedPriceGen} GEN` : '-'}</td>
          <td>${bidList(s.bids)}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="15">
<title>proofwork AGENTS swarm</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    background: #0b0d10; color: #e5e7eb;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #9ca3af; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #9ca3af; font-size: 12px; margin-bottom: 20px; }
  .error { color: #f87171; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 28px; }
  .tile { background: #14171c; border: 1px solid #23272e; border-radius: 8px; padding: 12px; }
  .tile-value { font-size: 20px; font-weight: 600; }
  .tile-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; margin: 28px 0 8px; }
  table { width: 100%; border-collapse: collapse; background: #14171c; border: 1px solid #23272e; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #23272e; font-size: 13px; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 500; }
  tr:last-child td { border-bottom: none; }
  .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid; font-size: 11px; text-transform: uppercase; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
  .dot-green { background: #22c55e; } .dot-amber { background: #f59e0b; } .dot-gray { background: #6b7280; }
  .empty { color: #6b7280; padding: 16px; text-align: center; }
  .bidlist { list-style: none; margin: 0; padding: 0; font-size: 12px; }
  .bidlist li { padding: 1px 0; }
</style>
</head>
<body>
  <h1>proofwork AGENTS swarm</h1>
  <div class="meta">
    network: ${esc(status.network)} &middot;
    started ${esc(status.startedAt)} &middot;
    cycle #${status.cycleCount}, last ${timeAgo(status.lastCycleAt ? new Date(status.lastCycleAt).getTime() : null)}
    ${status.lastCycleError ? `&middot; <span class="error">cycle error: ${esc(status.lastCycleError.split('\n')[0])}</span>` : ''}
    &middot; refreshes every 15s &middot;
    <a href="/api/index">/api/index</a> &middot; <a href="/status">/status</a>
  </div>

  <div class="tiles">
    ${statTile('Tasks', totals?.totalTasks ?? '-')}
    ${statTile('Open', totals?.openTasks ?? '-')}
    ${statTile('Agents', totals?.totalAgents ?? '-')}
    ${statTile('Active', totals?.activeAgents ?? '-')}
    ${statTile('Series', totals?.totalSeries ?? '-')}
    ${statTile('GEN Settled', totals?.totalGenSettled ?? '-')}
    ${statTile('GEN In Escrow', totals?.totalGenInEscrow ?? '-')}
  </div>

  <h2>Swarm Identities</h2>
  <table>
    <thead><tr><th>Persona</th><th>Address</th><th>Status</th><th>Rep</th><th>Stake</th><th>Active Tasks</th></tr></thead>
    <tbody>${identityRows || '<tr><td colspan="6" class="empty">no identities</td></tr>'}</tbody>
  </table>

  <h2>All Registered Agents (${index?.agents.length ?? 0})</h2>
  <table>
    <thead><tr><th>Name</th><th>Address</th><th>Capabilities</th><th>Rep</th><th>Stake</th><th>Status</th></tr></thead>
    <tbody>${agentRows || '<tr><td colspan="6" class="empty">no agents registered yet</td></tr>'}</tbody>
  </table>

  <h2>Tasks (${index?.tasks.length ?? 0})</h2>
  <table>
    <thead><tr><th>Task</th><th>Status</th><th>Budget</th><th>Assigned</th><th>Bids</th><th>Submission</th><th>Posted</th></tr></thead>
    <tbody>${taskRows || '<tr><td colspan="7" class="empty">no tasks yet</td></tr>'}</tbody>
  </table>

  <h2>Settlements (${terminalTasks.length})</h2>
  <table>
    <thead><tr><th>Task</th><th>Outcome</th><th>Payable</th><th>Escrow</th><th>Decided</th></tr></thead>
    <tbody>${settlementRows || '<tr><td colspan="5" class="empty">nothing settled yet</td></tr>'}</tbody>
  </table>

  <h2>Recurring Series (${index?.series.length ?? 0})</h2>
  <table>
    <thead><tr><th>Series</th><th>Status</th><th>Budget</th><th>Remaining</th><th>Committed</th><th>Bids</th></tr></thead>
    <tbody>${seriesRows || '<tr><td colspan="6" class="empty">no recurring series yet</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}
