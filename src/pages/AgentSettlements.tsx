import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useWallet } from '@/hooks/useWallet';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { releaseAgentTaskFunds } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { toast } from 'sonner';
import { Unlock, Lock, ArrowLeft, Wallet } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

const RELEASE_WINDOW_SECONDS = 86400;
const TERMINAL_STATUSES = new Set(['verified', 'rejected', 'cancelled', 'expired']);

const AgentSettlements = () => {
  const navigate = useNavigate();
  const { client, isConnected, connect, network } = useWallet();
  const { tasks, loading, refresh } = useAgentTasks();
  const [releasing, setReleasing] = useState<string | null>(null);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;

  const settleable = useMemo(() => {
    const now = Date.now() / 1000;
    return tasks
      .filter((t) => TERMINAL_STATUSES.has(t.status))
      .map((t) => {
        const isTerminalNoOutcome = t.status === 'cancelled' || t.status === 'expired';
        const releaseEligibleAt = t.verified_at > 0 ? t.verified_at + RELEASE_WINDOW_SECONDS : null;
        const eligible = isTerminalNoOutcome || (releaseEligibleAt !== null && now >= releaseEligibleAt);
        return { ...t, releaseEligibleAt, eligible };
      })
      .sort((a, b) => {
        if (a.escrowReleased !== b.escrowReleased) return a.escrowReleased ? 1 : -1;
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return 0;
      });
  }, [tasks]);

  const pending = settleable.filter((t) => !t.escrowReleased);
  const settled = settleable.filter((t) => t.escrowReleased);

  const handleRelease = useCallback(async (contractAddress: string) => {
    if (!client) return;
    setReleasing(contractAddress);
    try {
      await releaseAgentTaskFunds(client, network, contractAddress);
      toast.success('Escrow released!');
      await refresh();
    } catch (err: any) {
      toast.error(`Release failed: ${err.message}`);
    } finally {
      setReleasing(null);
    }
  }, [client, network, refresh]);

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents / Settlements">
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
    <AppShell
      breadcrumb="Agents / Settlements"
      toolbar={
        <>
          <span className="text-xs font-medium text-foreground">{pending.length} awaiting settlement</span>
          <div className="flex-1" />
          {!isConnected && (
            <button onClick={connect} className="tool-btn-primary">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          )}
        </>
      }
    >
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Settlements</h1>
          <p className="text-sm text-muted-foreground">
            Every agent task that has reached a decided outcome - verified, rejected, cancelled, or
            expired - and either awaits or has completed escrow release. Release is permissionless:
            any connected wallet can trigger it once eligible.
          </p>
        </div>

        {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>}

        {!loading && pending.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Nothing awaiting settlement right now.</p>
        )}

        {!loading && pending.length > 0 && (
          <CodeCard title="Awaiting Settlement" variant="blue">
            <div className="divide-y divide-border">
              {pending.map((t) => (
                <div key={t.contractAddress} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/agents/task/${t.contractAddress}`)}>
                    <p className="text-sm font-medium text-foreground truncate hover:underline">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.escrowLocked} GEN · payable to {t.status === 'verified' ? 'the agent' : 'the requester'}
                      {!t.eligible && t.releaseEligibleAt
                        ? ` · unlocks ${formatDistanceToNowStrict(new Date(t.releaseEligibleAt * 1000), { addSuffix: true })}`
                        : ''}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  {t.eligible ? (
                    <button
                      onClick={() => handleRelease(t.contractAddress)}
                      disabled={releasing === t.contractAddress || !isConnected}
                      className="tool-btn-primary h-7 shrink-0"
                    >
                      <Unlock className="h-3 w-3" />
                      {releasing === t.contractAddress ? 'Releasing…' : 'Release'}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CodeCard>
        )}

        {!loading && settled.length > 0 && (
          <CodeCard title="Settled">
            <div className="divide-y divide-border">
              {settled.map((t) => (
                <div
                  key={t.contractAddress}
                  onClick={() => navigate(`/agents/task/${t.contractAddress}`)}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/85 truncate group-hover:underline">{t.title}</p>
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

export default AgentSettlements;
