import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { useTasks } from '@/hooks/useTasks';
import { Search, Plus, LayoutGrid } from 'lucide-react';

const FILTERS = ['all', 'open', 'claimed', 'submitted', 'verified', 'rejected'] as const;

const Board = () => {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === 'all' ? tasks.length : tasks.filter((t) => t.status === f).length;
    return acc;
  }, {});

  return (
    <AppShell
      toolbar={
        <>
          <div className="relative w-56">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full h-7 pl-7 pr-2 rounded-[4px] bg-background border border-border text-xs
                         text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-0.5">
            {FILTERS.map((f) => (
              <button key={f} data-active={filter === f} onClick={() => setFilter(f)} className="tool-btn capitalize">
                {f}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={() => navigate('/create')} className="tool-btn-primary">
            <Plus className="h-3.5 w-3.5" />
            New Task
          </button>
        </>
      }
      panel={
        <>
          <PanelSection title="Overview">
            <PanelRow label="Total tasks" value={counts.all} />
            <PanelRow label="Open" value={counts.open} />
            <PanelRow label="In progress" value={counts.claimed + counts.submitted} />
            <PanelRow label="Verified" value={counts.verified} />
            <PanelRow label="Rejected" value={counts.rejected} />
          </PanelSection>
          <PanelSection title="Network">
            <PanelRow label="Chain" value="GenLayer" />
            <PanelRow label="Network" value="Asimov Testnet" />
            <PanelRow label="Consensus" value="AI validators" />
          </PanelSection>
          <PanelSection title="How it works" defaultOpen={false}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A creator posts a task with reward and criteria. A worker claims it and submits a GitHub URL.
              GenLayer validators independently fetch the repo, run AI review, and reach consensus on whether
              the work meets criteria — entirely on-chain.
            </p>
          </PanelSection>
        </>
      }
    >
      <div className="max-w-4xl mx-auto p-4">
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

        {!loading && filtered.length > 0 && (
          <div className="rounded border border-border overflow-hidden">
            {filtered.map((task, i) => (
              <div
                key={task.contractAddress}
                onClick={() => navigate(`/task/${task.contractAddress}`)}
                className={`flex items-center gap-4 px-3 py-2.5 bg-card hover:bg-muted/60 cursor-pointer transition-colors
                            ${i !== 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:block">
                  {task.creator.slice(0, 6)}…{task.creator.slice(-4)}
                </span>
                <span className="text-xs font-medium text-foreground shrink-0 w-16 text-right">
                  {task.reward_amount} GEN
                </span>
                <div className="shrink-0 w-24 flex justify-end">
                  <StatusBadge status={task.status} />
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
