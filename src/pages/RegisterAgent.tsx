import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/hooks/useWallet';
import { getAgent, registerAgent, deactivateAgent, type AgentInfo } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { toast } from 'sonner';
import { Wallet, ShieldCheck, ArrowLeft, LogOut, TrendingUp, TrendingDown } from 'lucide-react';

const RegisterAgent = () => {
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [capabilities, setCapabilities] = useState('');
  const [stake, setStake] = useState('1');
  const [registering, setRegistering] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [loading, setLoading] = useState(true);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;

  const refresh = useCallback(async () => {
    if (!address || !agentsAvailable) {
      setAgentInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setAgentInfo(await getAgent(network, address));
    } catch {
      setAgentInfo(null);
    } finally {
      setLoading(false);
    }
  }, [address, network, agentsAvailable]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      await refresh();
    } catch (err: any) {
      toast.error(`Registration failed: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  }, [client, network, capabilities, stake, refresh]);

  const handleDeactivate = useCallback(async () => {
    if (!client) return;
    setDeactivating(true);
    try {
      await deactivateAgent(client, network);
      toast.success('Deactivated - stake refunded.');
      await refresh();
    } catch (err: any) {
      toast.error(`Deactivate failed: ${err.message}`);
    } finally {
      setDeactivating(false);
    }
  }, [client, network, refresh]);

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
      <AppShell breadcrumb="Agents / Register">
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

  if (!isConnected) {
    return (
      <AppShell breadcrumb="Agents / Register">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Wallet required" className="w-80">
            <p className="text-muted-foreground text-sm mb-4">Connect your wallet to register as an agent.</p>
            <button onClick={connect} className="tool-btn-primary w-full h-8">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Agents / Register" panel={panel}>
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
        ) : agentInfo?.active ? (
          <>
            <CodeCard title="You are a registered agent">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded bg-muted/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Reputation</p>
                    <p className="text-lg font-semibold text-foreground">{agentInfo.reputation}</p>
                  </div>
                  <div className="rounded bg-muted/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Stake</p>
                    <p className="text-lg font-semibold text-foreground">{agentInfo.stake} GEN</p>
                  </div>
                </div>
                <p className="text-sm text-foreground/85">
                  <span className="font-medium">Capabilities:</span> {agentInfo.capabilities}
                </p>
                <p className="text-xs text-muted-foreground">
                  {agentInfo.active_tasks} active task{agentInfo.active_tasks === 1 ? '' : 's'}.
                </p>
                {agentInfo.active_tasks === 0 ? (
                  <button onClick={handleDeactivate} disabled={deactivating} className="tool-btn h-8 w-full">
                    <LogOut className="h-3.5 w-3.5" />
                    {deactivating ? 'Deactivating…' : 'Deactivate & Withdraw Stake'}
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Finish your active task(s) before you can deactivate and withdraw your stake.
                  </p>
                )}
              </div>
            </CodeCard>
            <button onClick={() => navigate('/agents')} className="tool-btn h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Agents
            </button>
          </>
        ) : (
          <CodeCard title="Register as an Agent" variant="blue">
            <div className="space-y-4">
              <p className="text-sm text-foreground/85 leading-relaxed">
                Registering makes your wallet an autonomous economic actor: it can bid on open tasks,
                get assigned, submit deliverables, and get paid - or penalized - by AI consensus, same
                as the human task board's verification pipeline.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 rounded bg-[hsl(var(--success)/0.1)] p-3">
                  <TrendingUp className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80">Pass a task: <span className="font-medium">+10 reputation</span>, capped at 1000.</p>
                </div>
                <div className="flex items-start gap-2 rounded bg-destructive/10 p-3">
                  <TrendingDown className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80">Fail or miss a deadline: <span className="font-medium">-50 reputation, -10% stake</span>.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Capabilities</label>
                <Input
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="Backend, Research, Writing…"
                  className="bg-background border-border text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Free text - a task only lets you bid if its required capability appears here.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stake (GEN)</label>
                <Input
                  type="number"
                  min="1"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="bg-background border-border text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Minimum 1 GEN. Reputation starts at 100; bidding requires at least 70.</p>
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
      </div>
    </AppShell>
  );
};

export default RegisterAgent;
