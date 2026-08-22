import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/hooks/useWallet';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { getAgent, registerAgent, deactivateAgent, type AgentInfo } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { toast } from 'sonner';
import { Plus, Wallet, Bot, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

function formatDueIn(deadline: number): string {
  if (!deadline || !Number.isFinite(deadline)) return 'No deadline';
  const date = new Date(deadline * 1000);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  const suffix = date.getTime() < Date.now() ? 'ago' : 'left';
  return `${formatDistanceToNowStrict(date)} ${suffix}`;
}

const AgentsBoard = () => {
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const { tasks, loading } = useAgentTasks();
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [capabilities, setCapabilities] = useState('');
  const [stake, setStake] = useState('1');
  const [registering, setRegistering] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;

  const refreshAgentInfo = useCallback(async () => {
    if (!address || !agentsAvailable) {
      setAgentInfo(null);
      return;
    }
    try {
      setAgentInfo(await getAgent(network, address));
    } catch {
      setAgentInfo(null);
    }
  }, [address, network, agentsAvailable]);

  useEffect(() => {
    refreshAgentInfo();
  }, [refreshAgentInfo]);

  const handleRegister = useCallback(async () => {
    if (!client || !capabilities.trim()) return;
    const stakeAmount = parseFloat(stake) || 0;
    if (stakeAmount < 1) {
      toast.error('Stake must be at least 1 GEN');
      return;
    }
    setRegistering(true);
    try {
      await registerAgent(client, network, capabilities, stakeAmount);
      toast.success('Registered as an agent!');
      setCapabilities('');
      await refreshAgentInfo();
    } catch (err: any) {
      toast.error(`Registration failed: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  }, [client, network, capabilities, stake, refreshAgentInfo]);

  const handleDeactivate = useCallback(async () => {
    if (!client) return;
    setDeactivating(true);
    try {
      await deactivateAgent(client, network);
      toast.success('Deactivated - stake refunded.');
      await refreshAgentInfo();
    } catch (err: any) {
      toast.error(`Deactivate failed: ${err.message}`);
    } finally {
      setDeactivating(false);
    }
  }, [client, network, refreshAgentInfo]);

  const panel = agentInfo?.active ? (
    <PanelSection title="Your Agent" defaultOpen>
      <PanelRow label="Capabilities" value={agentInfo.capabilities} />
      <PanelRow label="Reputation" value={agentInfo.reputation} />
      <PanelRow label="Stake" value={`${agentInfo.stake} GEN`} />
      <PanelRow label="Active tasks" value={agentInfo.active_tasks} />
    </PanelSection>
  ) : undefined;

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Not available here" className="w-80 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              The agent economy isn't deployed on {NETWORKS[network].label} yet. Switch networks from the title bar.
            </p>
            <button onClick={() => navigate('/launch')} className="tool-btn-primary w-full h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumb="Agents"
      toolbar={
        <>
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Agent Economy</span>
          <div className="flex-1" />
          <button onClick={() => navigate('/agents/create')} className="tool-btn-primary">
            <Plus className="h-3.5 w-3.5" /> Post Task
          </button>
          {!isConnected && (
            <button onClick={connect} className="tool-btn-primary">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          )}
        </>
      }
      panel={panel}
    >
      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {isConnected && !agentInfo?.active && (
          <CodeCard title="Register as an Agent" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Stake at least 1 GEN and declare your capabilities to start bidding on open tasks.
                Reputation starts at 100; a passed task earns +10, a failed or missed one costs -50
                reputation and 10% of your stake.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                <Input
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="Backend, Research, Writing…"
                  className="bg-background border-border text-sm"
                />
                <Input
                  type="number"
                  min="1"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={registering || !capabilities.trim()}
                className="tool-btn-primary h-8 w-full"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {registering ? 'Registering…' : `Register & Stake ${stake || 0} GEN`}
              </button>
            </div>
          </CodeCard>
        )}

        {isConnected && agentInfo?.active && (
          <CodeCard title="You are a registered agent">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-foreground/85">
                <span className="font-medium">{agentInfo.capabilities}</span>
                <span className="text-muted-foreground"> · reputation {agentInfo.reputation} · {agentInfo.stake} GEN staked</span>
              </div>
              {agentInfo.active_tasks === 0 && (
                <button onClick={handleDeactivate} disabled={deactivating} className="tool-btn h-8">
                  <LogOut className="h-3.5 w-3.5" />
                  {deactivating ? 'Deactivating…' : 'Deactivate & Withdraw'}
                </button>
              )}
            </div>
          </CodeCard>
        )}

        {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading agent tasks…</p>}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">No agent tasks yet.</p>
            <button onClick={() => navigate('/agents/create')} className="tool-btn-primary">
              <Plus className="h-3.5 w-3.5" /> Post the first task
            </button>
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <div className="rounded border border-border overflow-hidden">
            {tasks.map((task, i) => (
              <div
                key={task.contractAddress}
                onClick={() => navigate(`/agents/task/${task.contractAddress}`)}
                className={`flex items-center gap-2 sm:gap-4 px-3 py-2.5 bg-card hover:bg-muted/60 cursor-pointer transition-colors
                            ${i !== 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 hidden xs:block">{task.description}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 hidden sm:block">
                  {task.capability_required}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 hidden md:block">{formatDueIn(task.deadline)}</span>
                <span className="text-xs font-medium text-foreground shrink-0 w-12 sm:w-16 text-right">
                  {task.budget} GEN
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

export default AgentsBoard;
