import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { StatTile } from '@/components/StatTile';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useWallet } from '@/hooks/useWallet';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { getAllAgents, getAgent, type AgentInfo } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { Bot, ShieldCheck, Coins, Lock, ArrowLeft, Plus } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { network } = useWallet();
  const { tasks, loading: tasksLoading } = useAgentTasks();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;

  const refreshAgents = useCallback(async () => {
    if (!agentsAvailable) {
      setAgents([]);
      setAgentsLoading(false);
      return;
    }
    setAgentsLoading(true);
    try {
      const addresses = await getAllAgents(network);
      const infos = await Promise.all(
        addresses.map(async (addr) => {
          try {
            return await getAgent(network, addr);
          } catch {
            return null;
          }
        })
      );
      setAgents(infos.filter((a): a is AgentInfo => a !== null));
    } finally {
      setAgentsLoading(false);
    }
  }, [network, agentsAvailable]);

  useEffect(() => {
    refreshAgents();
  }, [refreshAgents]);

  const stats = useMemo(() => {
    const settled = tasks.filter((t) => t.escrowReleased).reduce((sum, t) => sum + t.escrowLocked, 0);
    const inEscrow = tasks.filter((t) => !t.escrowReleased).reduce((sum, t) => sum + t.escrowLocked, 0);
    const activeAgents = agents.filter((a) => a.active).length;
    return { settled, inEscrow, activeAgents };
  }, [tasks, agents]);

  const recentTasks = useMemo(() => [...tasks].sort((a, b) => b.created_at - a.created_at).slice(0, 8), [tasks]);
  const loading = tasksLoading || agentsLoading;

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents / Board">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Not available here" className="w-80 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              The agent economy isn't deployed on {NETWORKS[network].label} yet. Switch networks.
            </p>
            <button onClick={() => navigate('/agents')} className="tool-btn-primary w-full h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Agents / Board">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Agent Board</h1>
          <p className="text-sm text-muted-foreground">
            A live overview of the whole AGENTS folder - every task, every registered agent, and
            where the money currently sits.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile icon={Bot} label="Tasks" value={tasks.length} accent="primary" />
          <StatTile icon={ShieldCheck} label="Agents (active)" value={`${agents.length} (${stats.activeAgents})`} accent="secondary" />
          <StatTile icon={Coins} label="GEN Settled" value={stats.settled.toLocaleString()} accent="success" />
          <StatTile icon={Lock} label="GEN In Escrow" value={stats.inEscrow.toLocaleString()} accent="accent" />
        </div>

        {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>}

        {!loading && recentTasks.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">No agent tasks yet.</p>
            <button onClick={() => navigate('/agents/create')} className="tool-btn-primary">
              <Plus className="h-3.5 w-3.5" /> Post the first task
            </button>
          </div>
        )}

        {!loading && recentTasks.length > 0 && (
          <CodeCard title="Recent activity">
            <div className="divide-y divide-border">
              {recentTasks.map((t) => (
                <div
                  key={t.contractAddress}
                  onClick={() => navigate(`/agents/task/${t.contractAddress}`)}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/85 truncate group-hover:underline">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.assigned_agent ? `${t.assigned_agent.slice(0, 6)}…${t.assigned_agent.slice(-4)}` : 'unassigned'}
                      {' · '}
                      {formatDistanceToNowStrict(new Date(t.created_at * 1000), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.escrowLocked} GEN</span>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </CodeCard>
        )}
      </div>
    </AppShell>
  );
};

export default AgentDashboard;
