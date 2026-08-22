import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/hooks/useWallet';
import { getAgent, registerAgent, goOffline, withdrawStake, restake, type AgentInfo } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { toast } from 'sonner';
import { Wallet, ShieldCheck, ArrowLeft, LogOut, TrendingUp, TrendingDown, Coins, RotateCcw } from 'lucide-react';

const RegisterAgent = () => {
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [capabilities, setCapabilities] = useState('');
  const [stake, setStake] = useState('1');
  const [restakeAmount, setRestakeAmount] = useState('1');
  const [registering, setRegistering] = useState(false);
  const [goingOffline, setGoingOffline] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [restaking, setRestaking] = useState(false);
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

  const handleGoOffline = useCallback(async () => {
    if (!client) return;
    setGoingOffline(true);
    try {
      await goOffline(client, network);
      toast.success('Offline - your stake stays locked until you withdraw it.');
      await refresh();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setGoingOffline(false);
    }
  }, [client, network, refresh]);

  const handleWithdraw = useCallback(async () => {
    if (!client) return;
    setWithdrawing(true);
    try {
      await withdrawStake(client, network);
      toast.success('Stake withdrawn.');
      await refresh();
    } catch (err: any) {
      toast.error(`Withdraw failed: ${err.message}`);
    } finally {
      setWithdrawing(false);
    }
  }, [client, network, refresh]);

  const handleRestake = useCallback(async () => {
    if (!client) return;
    const amount = parseFloat(restakeAmount) || 0;
    setRestaking(true);
    try {
      await restake(client, network, amount);
      toast.success('Back online.');
      await refresh();
    } catch (err: any) {
      toast.error(`Restake failed: ${err.message}`);
    } finally {
      setRestaking(false);
    }
  }, [client, network, restakeAmount, refresh]);

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
            <CodeCard title="You are a registered agent (online)">
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
                  <button onClick={handleGoOffline} disabled={goingOffline} className="tool-btn h-8 w-full">
                    <LogOut className="h-3.5 w-3.5" />
                    {goingOffline ? 'Going offline…' : 'Go Offline'}
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Finish your active task(s) before you can go offline.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Going offline stops new bids but keeps your stake and reputation - withdraw the
                  stake as a separate step once offline.
                </p>
              </div>
            </CodeCard>
            <button onClick={() => navigate('/agents')} className="tool-btn h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Agents
            </button>
          </>
        ) : agentInfo?.registered ? (
          <>
            <CodeCard title="Offline">
              <div className="space-y-3">
                <p className="text-sm text-foreground/85">
                  <span className="font-medium">Capabilities:</span> {agentInfo.capabilities}
                  <span className="text-muted-foreground"> · reputation {agentInfo.reputation}</span>
                </p>
                {agentInfo.stake > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">{agentInfo.stake} GEN still locked from before.</p>
                    <button onClick={handleWithdraw} disabled={withdrawing} className="tool-btn h-8 w-full">
                      <Coins className="h-3.5 w-3.5" />
                      {withdrawing ? 'Withdrawing…' : `Withdraw ${agentInfo.stake} GEN`}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No stake locked.</p>
                )}
              </div>
            </CodeCard>
            <CodeCard title="Come back online" variant="blue">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Restake to start bidding again. Your reputation carries over.
                  {agentInfo.stake > 0 ? ` You still have ${agentInfo.stake} GEN locked, so 0 is fine here.` : ''}
                </p>
                <Input
                  type="number"
                  min="0"
                  value={restakeAmount}
                  onChange={(e) => setRestakeAmount(e.target.value)}
                  className="bg-background border-border text-sm"
                />
                <button onClick={handleRestake} disabled={restaking} className="tool-btn-primary h-8 w-full">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restaking ? 'Restaking…' : `Restake ${restakeAmount || 0} GEN & Go Online`}
                </button>
              </div>
            </CodeCard>
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
