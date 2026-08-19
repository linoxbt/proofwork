import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { StatTile } from '@/components/StatTile';
import { CodeCard } from '@/components/CodeCard';
import { useTasks } from '@/hooks/useTasks';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, Coins, Lock, Briefcase, Gavel, LayoutGrid } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();
  const { tasks, loading } = useTasks();

  const [tab, setTab] = useState<'created' | 'claimed'>('created');

  const my = useMemo(() => {
    const lower = address.toLowerCase();
    const created = tasks.filter((t) => t.creator.toLowerCase() === lower);
    const claimed = tasks.filter((t) => t.worker.toLowerCase() === lower);
    const earned = claimed.filter((t) => t.status === 'verified' && t.escrowReleased).reduce((s, t) => s + t.escrowLocked, 0);
    const locked = created.filter((t) => !t.escrowReleased).reduce((s, t) => s + t.escrowLocked, 0);
    const disputes = [...created, ...claimed].reduce((s, t) => s + t.dispute_count, 0);
    const completed = claimed.filter((t) => t.status === 'verified').length;
    return { created, claimed, earned, locked, disputes, completed };
  }, [tasks, address]);

  const list = tab === 'created' ? my.created : my.claimed;

  if (!isConnected) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Wallet required" className="w-80">
            <p className="text-muted-foreground text-sm mb-4">Connect your wallet to see your dashboard.</p>
            <button onClick={connect} className="tool-btn-primary w-full h-8">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      toolbar={
        <div className="flex items-center gap-0.5">
          <button data-active={tab === 'created'} onClick={() => setTab('created')} className="tool-btn">
            Created by me ({my.created.length})
          </button>
          <button data-active={tab === 'claimed'} onClick={() => setTab('claimed')} className="tool-btn">
            Claimed by me ({my.claimed.length})
          </button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile icon={Coins} label="GEN Earned" value={my.earned.toLocaleString()} accent="success" />
          <StatTile icon={Lock} label="GEN Locked (mine)" value={my.locked.toLocaleString()} accent="primary" />
          <StatTile icon={Briefcase} label="Tasks Completed" value={my.completed} accent="secondary" />
          <StatTile icon={Gavel} label="Disputes Involved" value={my.disputes} accent="accent" />
        </div>

        {loading && <div className="text-center py-16 text-sm text-muted-foreground">Loading your tasks…</div>}

        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === 'created' ? "You haven't created any tasks yet." : "You haven't claimed any tasks yet."}
            </p>
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="rounded border border-border overflow-hidden">
            {list.map((task, i) => (
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
                <span className="text-xs font-medium text-foreground shrink-0 w-16 text-right">
                  {task.reward_amount} GEN
                </span>
                <div className="shrink-0 flex justify-end">
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

export default Dashboard;
