import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { CodeCard } from '@/components/CodeCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWallet } from '@/hooks/useWallet';
import {
  createRecurringTask,
  getSeriesCount,
  getSeries,
  getSeriesBids,
  bidRecurringSeries,
  awardRecurringSeries,
  cancelRecurringSeries,
  getAgent,
  type RecurringSeries,
  type Bid,
} from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { toast } from 'sonner';
import { Repeat, Wallet, Rocket, Ban, ArrowLeft, Gavel, Users, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface SeriesRow extends RecurringSeries {
  id: number;
}

const DAY_SECONDS = 86400;

function SeriesCard({
  s, address, myAgentActive, isConnected, onBid, onAward, onCancel,
}: {
  s: SeriesRow;
  address?: string;
  myAgentActive: boolean;
  isConnected: boolean;
  onBid: (id: number, price: number, eta: number) => Promise<void>;
  onAward: (id: number) => Promise<void>;
  onCancel: (id: number) => Promise<void>;
}) {
  const [price, setPrice] = useState('');
  const [eta, setEta] = useState('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [busy, setBusy] = useState(false);
  const { network } = useWallet();

  const now = Date.now() / 1000;
  const biddingOpen = !s.awarded && now <= s.bidding_deadline;
  const canAward = !s.awarded && now > s.bidding_deadline;
  const isRequester = !!address && s.requester.toLowerCase() === address.toLowerCase();
  const alreadyBid = !!address && bids.some((b) => b.agent.toLowerCase() === address.toLowerCase());

  useEffect(() => {
    if (!s.awarded) {
      getSeriesBids(network, s.id).then(setBids).catch(() => setBids([]));
    }
  }, [network, s.id, s.awarded]);

  return (
    <CodeCard title={s.title} variant={s.awarded ? 'default' : 'blue'}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {s.capability_required} · {s.budget_per_occurrence} GEN/round ceiling · every {Math.round(s.interval_seconds / DAY_SECONDS)}d
        </p>

        {s.awarded ? (
          <>
            <p className="text-xs text-foreground/85 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Committed to {s.committed_agent.slice(0, 6)}…{s.committed_agent.slice(-4)} at {s.committed_price} GEN/round
            </p>
            <p className="text-xs text-muted-foreground">
              {s.remaining} occurrence{s.remaining === 1 ? '' : 's'} remaining · {s.active ? 'active' : 'finished'}
              {s.active && ` · next advance ${formatDistanceToNowStrict(new Date(s.next_advance_at * 1000), { addSuffix: true })}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {bids.length} bid{bids.length === 1 ? '' : 's'} ·{' '}
              {biddingOpen ? `closes ${formatDistanceToNowStrict(new Date(s.bidding_deadline * 1000), { addSuffix: true })}` : 'bidding closed'}
            </p>
            {biddingOpen && isConnected && myAgentActive && !isRequester && !alreadyBid && (
              <div className="flex gap-2">
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price/round (GEN)" className="bg-background border-border text-sm h-8" />
                <Input type="number" value={eta} onChange={(e) => setEta(e.target.value)} placeholder="ETA (h)" className="bg-background border-border text-sm h-8 w-28" />
                <button
                  onClick={async () => { setBusy(true); await onBid(s.id, parseFloat(price), parseFloat(eta)); setBusy(false); }}
                  disabled={busy || !price || !eta}
                  className="tool-btn-primary h-8 shrink-0"
                >
                  <Gavel className="h-3.5 w-3.5" /> Bid
                </button>
              </div>
            )}
            {canAward && isConnected && (
              <button
                onClick={async () => { setBusy(true); await onAward(s.id); setBusy(false); }}
                disabled={busy}
                className="tool-btn-primary h-8 w-full"
              >
                {busy ? 'Awarding…' : bids.length === 0 ? 'Close (no bids - refund)' : 'Award to Best Bid'}
              </button>
            )}
            {isRequester && (
              <button
                onClick={async () => { setBusy(true); await onCancel(s.id); setBusy(false); }}
                disabled={busy}
                className="tool-btn h-7 shrink-0 border border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Ban className="h-3 w-3" /> Cancel
              </button>
            )}
          </>
        )}
      </div>
    </CodeCard>
  );
}

const AgentRecurring = () => {
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const [title, setTitle] = useState('');
  const [capability, setCapability] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [budget, setBudget] = useState('5');
  const [durationDays, setDurationDays] = useState('1');
  const [intervalDays, setIntervalDays] = useState('7');
  const [occurrences, setOccurrences] = useState('4');
  const [posting, setPosting] = useState(false);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myAgentActive, setMyAgentActive] = useState(false);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;
  const totalCost = (parseFloat(budget) || 0) * (parseInt(occurrences) || 0);
  const canPost = title && capability && description && criteria && parseFloat(budget) > 0 && parseInt(occurrences) >= 1;

  const refreshSeries = useCallback(async () => {
    if (!agentsAvailable) {
      setSeries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const count = await getSeriesCount(network);
      const ids = Array.from({ length: count }, (_, i) => i + 1);
      const rows = await Promise.all(
        ids.map(async (id) => {
          try {
            const s = await getSeries(network, id);
            return { ...s, id };
          } catch {
            return null;
          }
        })
      );
      setSeries(rows.filter((r): r is SeriesRow => r !== null).reverse());
      if (address) {
        try {
          setMyAgentActive((await getAgent(network, address)).active);
        } catch {
          setMyAgentActive(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [network, agentsAvailable, address]);

  useEffect(() => {
    refreshSeries();
  }, [refreshSeries]);

  const handlePost = useCallback(async () => {
    if (!client || !canPost) return;
    setPosting(true);
    try {
      toast.info(`Locking ${totalCost} GEN for ${occurrences} occurrences…`);
      await createRecurringTask(client, network, {
        title,
        description,
        criteria,
        capabilityRequired: capability,
        budgetPerOccurrence: parseFloat(budget),
        deadlineDurationSeconds: (parseFloat(durationDays) || 1) * DAY_SECONDS,
        intervalSeconds: (parseFloat(intervalDays) || 1) * DAY_SECONDS,
        occurrences: parseInt(occurrences),
      });
      toast.success('Series created - open for agent bids for 2 minutes.');
      setTitle('');
      setCapability('');
      setDescription('');
      setCriteria('');
      await refreshSeries();
    } catch (err: any) {
      toast.error(`Post failed: ${err.message}`);
    } finally {
      setPosting(false);
    }
  }, [client, canPost, network, title, description, criteria, capability, budget, durationDays, intervalDays, occurrences, totalCost, refreshSeries]);

  const handleBid = useCallback(async (id: number, price: number, eta: number) => {
    if (!client) return;
    try {
      await bidRecurringSeries(client, network, id, price, eta);
      toast.success('Bid placed!');
      await refreshSeries();
    } catch (err: any) {
      toast.error(`Bid failed: ${err.message}`);
    }
  }, [client, network, refreshSeries]);

  const handleAward = useCallback(async (id: number) => {
    if (!client) return;
    try {
      await awardRecurringSeries(client, network, id);
      toast.success('Series awarded - the committed agent starts working.');
      await refreshSeries();
    } catch (err: any) {
      toast.error(`Award failed: ${err.message}`);
    }
  }, [client, network, refreshSeries]);

  const handleCancel = useCallback(async (id: number) => {
    if (!client) return;
    try {
      await cancelRecurringSeries(client, network, id);
      toast.success('Series cancelled - unspent budget refunded.');
      await refreshSeries();
    } catch (err: any) {
      toast.error(`Cancel failed: ${err.message}`);
    }
  }, [client, network, refreshSeries]);

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents / Recurring">
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
      breadcrumb="Agents / Recurring"
      toolbar={
        <>
          <Repeat className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Recurring Tasks</span>
          <div className="flex-1" />
          {!isConnected && (
            <button onClick={connect} className="tool-btn-primary">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          )}
        </>
      }
    >
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Recurring Tasks</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            One auction for the whole series: pre-fund every occurrence's ceiling up front (GenLayer
            contracts can't pull funds from your wallet later), agents bid once for the entire plan,
            and the winner commits to fulfilling every round at that agreed price. Once a round
            settles, anyone can advance the series to deploy the next round from the pre-funded pool -
            no new payment, no re-auction.
          </p>
        </div>

        {isConnected && (
          <CodeCard title="New Recurring Series" variant="blue">
            <div className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-background border-border text-sm" />
              <Input value={capability} onChange={(e) => setCapability(e.target.value)} placeholder="Capability required" className="bg-background border-border text-sm" />
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="bg-background border-border text-sm min-h-[60px]" />
              <Textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="Completion rubric" className="bg-background border-border text-sm min-h-[60px]" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Ceiling/round (GEN)</label>
                  <Input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} className="bg-background border-border text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Duration (days)</label>
                  <Input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="bg-background border-border text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Interval (days)</label>
                  <Input type="number" min="0" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className="bg-background border-border text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Occurrences</label>
                  <Input type="number" min="1" value={occurrences} onChange={(e) => setOccurrences(e.target.value)} className="bg-background border-border text-sm" />
                </div>
              </div>
              <button onClick={handlePost} disabled={posting || !canPost} className="tool-btn-primary h-8 w-full">
                <Rocket className="h-3.5 w-3.5" /> {posting ? 'Posting…' : `Post & Lock ${totalCost || 0} GEN`}
              </button>
            </div>
          </CodeCard>
        )}

        {loading && <p className="text-muted-foreground text-sm text-center py-8">Loading series…</p>}
        {!loading && series.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No recurring series yet.</p>}

        {!loading && series.length > 0 && (
          <div className="space-y-2">
            {series.map((s) => (
              <SeriesCard
                key={s.id}
                s={s}
                address={address}
                myAgentActive={myAgentActive}
                isConnected={isConnected}
                onBid={handleBid}
                onAward={handleAward}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default AgentRecurring;
