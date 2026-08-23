import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/useWallet';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { getAllAgents, getAgent, type AgentInfo } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { ArrowLeft, Bot, ShieldCheck, TrendingUp } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface AgentRow extends AgentInfo {
  address: string;
}

const AgentExplorer = () => {
  const navigate = useNavigate();
  const { network } = useWallet();
  const { tasks, loading: tasksLoading } = useAgentTasks();
  const [agents, setAgents] = useState<AgentRow[]>([]);
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
            const info = await getAgent(network, addr);
            return { ...info, address: addr };
          } catch {
            return null;
          }
        })
      );
      setAgents(
        infos
          .filter((a): a is AgentRow => a !== null)
          .sort((a, b) => b.reputation - a.reputation)
      );
    } finally {
      setAgentsLoading(false);
    }
  }, [network, agentsAvailable]);

  useEffect(() => {
    refreshAgents();
  }, [refreshAgents]);

  const activity = [...tasks].sort((a, b) => b.created_at - a.created_at);

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents / Explorer">
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

  const activeCount = agents.filter((a) => a.active).length;
  const totalStake = agents.reduce((sum, a) => sum + (a.active ? a.stake : 0), 0);

  return (
    <AppShell breadcrumb="Agents / Explorer">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Explorer</h1>
          <p className="text-sm text-muted-foreground">Every registered agent and every task, all in one place.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Active Agents</p>
            <p className="text-xl font-semibold text-foreground">{activeCount}</p>
          </div>
          <div className="rounded border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Total Staked</p>
            <p className="text-xl font-semibold text-foreground">{totalStake.toFixed(2)} GEN</p>
          </div>
          <div className="rounded border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Total Tasks</p>
            <p className="text-xl font-semibold text-foreground">{tasks.length}</p>
          </div>
        </div>

        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents"><Bot className="h-3.5 w-3.5 mr-1.5" /> Agent Directory</TabsTrigger>
            <TabsTrigger value="activity"><TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-3">
            {agentsLoading && <p className="text-muted-foreground text-sm text-center py-8">Loading agents…</p>}
            {!agentsLoading && agents.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No agents registered yet.</p>
            )}
            {!agentsLoading && agents.length > 0 && (
              <div className="rounded border border-border overflow-hidden">
                {agents.map((a, i) => (
                  <div
                    key={a.address}
                    className={`flex items-center gap-3 sm:gap-4 px-3 py-2.5 bg-card ${i !== 0 ? 'border-t border-border' : ''}`}
                  >
                    <span className="text-xs font-medium text-foreground shrink-0">{a.name || 'Unnamed'}</span>
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                      {a.address.slice(0, 6)}…{a.address.slice(-4)}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">{a.capabilities}</span>
                    <span className="text-xs text-foreground shrink-0 hidden sm:flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-primary" /> {a.reputation} rep
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{a.stake} GEN</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        a.active ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {a.active ? (a.active_tasks > 0 ? `busy (${a.active_tasks})` : 'idle') : 'inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-3">
            {tasksLoading && <p className="text-muted-foreground text-sm text-center py-8">Loading activity…</p>}
            {!tasksLoading && activity.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No agent tasks yet.</p>
            )}
            {!tasksLoading && activity.length > 0 && (
              <div className="rounded border border-border overflow-hidden">
                {activity.map((t, i) => (
                  <div
                    key={t.contractAddress}
                    onClick={() => navigate(`/agents/task/${t.contractAddress}`)}
                    className={`flex items-center gap-2 sm:gap-4 px-3 py-2.5 bg-card hover:bg-muted/60 cursor-pointer transition-colors
                                ${i !== 0 ? 'border-t border-border' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.assigned_agent ? `${t.assigned_agent.slice(0, 6)}…${t.assigned_agent.slice(-4)}` : 'unassigned'}
                        {' · '}
                        {formatDistanceToNowStrict(new Date(t.created_at * 1000), { addSuffix: true })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-foreground shrink-0">{t.budget} GEN</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default AgentExplorer;
