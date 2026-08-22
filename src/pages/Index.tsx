import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { StatTile } from '@/components/StatTile';
import { useTasks } from '@/hooks/useTasks';
import { NETWORKS } from '@/lib/networks';
import { useWallet } from '@/hooks/useWallet';
import {
  Search, Plus, LayoutGrid, List, Users, ListChecks, Lock, CheckCircle2, Target, TrendingUp,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

const FILTERS = ['all', 'open', 'claimed', 'submitted', 'disputed', 'verified', 'rejected', 'cancelled', 'expired'] as const;
const VIEW_STORAGE_KEY = 'proofwork-board-view';

function formatDueIn(deadline: number): string {
  if (!deadline || !Number.isFinite(deadline)) return 'No deadline';
  const date = new Date(deadline * 1000);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  const suffix = date.getTime() < Date.now() ? 'ago' : 'left';
  return `${formatDistanceToNowStrict(date)} ${suffix}`;
}

const Board = () => {
  const navigate = useNavigate();
  const { network } = useWallet();
  const { tasks, loading } = useTasks();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem(VIEW_STORAGE_KEY) as 'grid' | 'list') || 'list'
  );

  const setViewAndPersist = (v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === 'all' ? tasks.length : tasks.filter((t) => t.status === f).length;
    return acc;
  }, {});

  const stats = useMemo(() => {
    const workers = new Set(tasks.filter((t) => t.worker).map((t) => t.worker.toLowerCase()));
    const escrowLocked = tasks.filter((t) => !t.escrowReleased).reduce((sum, t) => sum + t.escrowLocked, 0);
    const escrowSettled = tasks.filter((t) => t.escrowReleased).reduce((sum, t) => sum + t.escrowLocked, 0);
    const decided = counts.verified + counts.rejected;
    const successRate = decided > 0 ? Math.round((counts.verified / decided) * 100) : null;
    return { workers: workers.size, escrowLocked, escrowSettled, successRate };
  }, [tasks, counts.verified, counts.rejected]);

  return (
    <AppShell
      toolbar={
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="w-full h-7 pl-7 pr-2 rounded-[4px] bg-background border border-border text-xs
                           text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center rounded-[4px] border border-border overflow-hidden shrink-0">
              <button
                onClick={() => setViewAndPersist('list')}
                data-active={view === 'list'}
                className="tool-btn rounded-none border-0 h-7 w-7 px-0"
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewAndPersist('grid')}
                data-active={view === 'grid'}
                className="tool-btn rounded-none border-0 h-7 w-7 px-0"
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => navigate('/create')} className="tool-btn-primary sm:hidden">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <div className="flex items-center gap-0.5 overflow-x-auto sm:flex-1 -mx-1 px-1 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <button key={f} data-active={filter === f} onClick={() => setFilter(f)} className="tool-btn capitalize">
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/create')} className="tool-btn-primary hidden sm:inline-flex">
            <Plus className="h-3.5 w-3.5" />
            New Task
          </button>
        </div>
      }
      panel={
        <>
          <PanelSection title="Overview">
            <PanelRow label="Total tasks" value={counts.all} />
            <PanelRow label="Open" value={counts.open} />
            <PanelRow label="In progress" value={counts.claimed + counts.submitted + counts.disputed} />
            <PanelRow label="Verified" value={counts.verified} />
            <PanelRow label="Rejected" value={counts.rejected} />
          </PanelSection>
          <PanelSection title="Network">
            <PanelRow label="Chain" value="GenLayer" />
            <PanelRow label="Network" value={NETWORKS[network].label} />
            <PanelRow label="Consensus" value="AI validators" />
          </PanelSection>
          <PanelSection title="How it works" defaultOpen={false}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A creator posts a task, locks the reward in escrow, and a worker claims it. Either party
              can trigger AI validators to fetch the evidence and judge it against the criteria. Escrow
              releases 24h after a decision, unless disputed.
            </p>
          </PanelSection>
        </>
      }
    >
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatTile icon={ListChecks} label="Total Tasks" value={counts.all} accent="primary" />
          <StatTile icon={Users} label="Workers" value={stats.workers} accent="secondary" />
          <StatTile icon={Target} label="Open" value={counts.open} accent="accent" />
          <StatTile icon={Lock} label="GEN in Escrow" value={stats.escrowLocked.toLocaleString()} accent="primary" />
          <StatTile icon={CheckCircle2} label="GEN Settled" value={stats.escrowSettled.toLocaleString()} accent="success" />
          <StatTile
            icon={TrendingUp}
            label="Success Rate"
            value={stats.successRate === null ? '-' : `${stats.successRate}%`}
            accent="success"
          />
        </div>

        {loading && (
          <div className="text-center py-16 text-sm text-muted-foreground">Loading tasks from chain…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters.'}
            </p>
            {tasks.length === 0 && (
              <button onClick={() => navigate('/create')} className="tool-btn-primary">
                <Plus className="h-3.5 w-3.5" /> Create the first task
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && view === 'list' && (
          <div className="rounded border border-border overflow-hidden">
            {filtered.map((task, i) => (
              <div
                key={task.contractAddress}
                onClick={() => navigate(`/task/${task.contractAddress}`)}
                className={`flex items-center gap-2 sm:gap-4 px-3 py-2.5 bg-card hover:bg-muted/60 cursor-pointer transition-colors
                            ${i !== 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 hidden xs:block">{task.description}</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0 hidden md:block">
                  {task.creator.slice(0, 6)}…{task.creator.slice(-4)}
                </span>
                <span className="text-xs font-medium text-foreground shrink-0 w-12 sm:w-16 text-right">
                  {task.reward_amount} GEN
                </span>
                <div className="shrink-0 flex justify-end">
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((task) => (
              <div
                key={task.contractAddress}
                onClick={() => navigate(`/task/${task.contractAddress}`)}
                className="rounded border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-foreground line-clamp-2">{task.title}</p>
                  <StatusBadge status={task.status} className="shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-2 border-t border-border">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {task.category === 'Other' ? task.category_other : task.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatDueIn(task.deadline)}</span>
                  <span className="ml-auto text-xs font-semibold text-foreground">{task.reward_amount} GEN</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Board;
