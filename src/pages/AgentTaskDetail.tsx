import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { VerificationProgress } from '@/components/VerificationProgress';
import { useWallet } from '@/hooks/useWallet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  getAgentTaskState,
  getAgentTaskBids,
  getAgentTaskEscrowStatus,
  getAgent,
  placeBid,
  closeBiddingAndAssign,
  submitDeliverable,
  requestAgentVerification,
  disputeAgentTask,
  cancelAgentTask,
  checkAgentTaskTimeout,
  releaseAgentTaskFunds,
  type AgentTaskState,
  type Bid,
} from '@/lib/agentContract';
import { getReadOnlyClient } from '@/lib/contract';
import {
  CheckCircle2, XCircle, ExternalLink, Cpu, Wallet, Send, Gavel, Lock, Unlock, Users, Ban, TimerOff, Sparkles,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';

const RELEASE_WINDOW_SECONDS = 86400;
const MAX_DISPUTES = 3;

function formatDeadline(deadline: number | undefined): string {
  if (!deadline || !Number.isFinite(deadline)) return 'No deadline set';
  const date = new Date(deadline * 1000);
  if (Number.isNaN(date.getTime())) return 'No deadline set';
  return format(date, 'MMM d, yyyy p');
}

const AgentTaskDetail = () => {
  const { address: contractAddr } = useParams();
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const [bidPrice, setBidPrice] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [bidding, setBidding] = useState(false);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingTimeout, setCheckingTimeout] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [task, setTask] = useState<AgentTaskState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [escrow, setEscrow] = useState<{ lockedAmount: number; released: boolean } | null>(null);
  const [myAgentActive, setMyAgentActive] = useState(false);
  const [assignedAgentName, setAssignedAgentName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!contractAddr) return;
    try {
      const readClient = client ?? getReadOnlyClient(network);
      const [state, bidList, escrowStatus] = await Promise.all([
        getAgentTaskState(readClient, contractAddr),
        getAgentTaskBids(readClient, contractAddr),
        getAgentTaskEscrowStatus(network, contractAddr),
      ]);
      setTask(state);
      setBids(bidList);
      setEscrow(escrowStatus);
      if (state.assigned_agent) {
        try {
          const assigned = await getAgent(network, state.assigned_agent);
          setAssignedAgentName(assigned.name);
        } catch {
          setAssignedAgentName('');
        }
      } else {
        setAssignedAgentName('');
      }
      if (address) {
        try {
          const info = await getAgent(network, address);
          setMyAgentActive(info.active);
        } catch {
          setMyAgentActive(false);
        }
      }
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddr, client, network, address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const verification = task?.verification_result ? JSON.parse(task.verification_result) : null;
  const now = Date.now() / 1000;

  const isRequester = !!(task && address && task.requester.toLowerCase() === address.toLowerCase());
  const isAssignedAgent = !!(task && address && task.assigned_agent.toLowerCase() === address.toLowerCase());
  const isParty = isRequester || isAssignedAgent;
  const alreadyBid = !!(address && bids.some((b) => b.agent.toLowerCase() === address.toLowerCase()));

  const biddingOpen = task?.status === 'open' && now <= task.bidding_deadline;
  const canBid = biddingOpen && isConnected && myAgentActive && !isRequester && !alreadyBid;
  const canCloseBidding = task?.status === 'open' && now > task.bidding_deadline && isConnected;
  const canSubmit = task?.status === 'assigned' && isConnected && isAssignedAgent;
  const canCheckTimeout = task?.status === 'assigned' && task && now > task.deadline && isConnected;
  const canRequestVerification = (task?.status === 'submitted' || task?.status === 'disputed') && isConnected && isParty;
  const disputesRemaining = task ? MAX_DISPUTES - task.dispute_count : MAX_DISPUTES;
  const canDispute = (task?.status === 'verified' || task?.status === 'rejected') && isConnected && isParty && disputesRemaining > 0;
  const canCancel = task?.status === 'open' && isConnected && isRequester;
  const isTerminalNoOutcome = task?.status === 'cancelled' || task?.status === 'expired';

  const releaseEligibleAt = task && task.verified_at > 0 ? task.verified_at + RELEASE_WINDOW_SECONDS : null;
  const decidedReleaseEligible = releaseEligibleAt !== null && now >= releaseEligibleAt;
  const releaseEligible = isTerminalNoOutcome || decidedReleaseEligible;
  const canRelease =
    isConnected && escrow && !escrow.released &&
    (task?.status === 'verified' || task?.status === 'rejected' || isTerminalNoOutcome) &&
    releaseEligible;

  const handleBid = useCallback(async () => {
    if (!client || !contractAddr || !bidPrice || !bidEta) return;
    setBidding(true);
    try {
      await placeBid(client, contractAddr, parseInt(bidPrice), parseInt(bidEta));
      toast.success('Bid placed!');
      await refresh();
    } catch (err: any) {
      toast.error(`Bid failed: ${err.message}`);
    } finally {
      setBidding(false);
    }
  }, [client, contractAddr, bidPrice, bidEta, refresh]);

  const handleCloseBidding = useCallback(async () => {
    if (!client || !contractAddr) return;
    setClosing(true);
    try {
      await closeBiddingAndAssign(client, contractAddr);
      toast.success('Bidding closed and task assigned.');
      await refresh();
    } catch (err: any) {
      toast.error(`Close bidding failed: ${err.message}`);
    } finally {
      setClosing(false);
    }
  }, [client, contractAddr, refresh]);

  const handleSubmit = useCallback(async () => {
    if (!client || !contractAddr || !evidenceUrl) return;
    setSubmitting(true);
    try {
      await submitDeliverable(client, contractAddr, evidenceUrl, submissionNote);
      toast.success('Deliverable submitted and locked.');
      await refresh();
    } catch (err: any) {
      toast.error(`Submit failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [client, contractAddr, evidenceUrl, submissionNote, refresh]);

  const handleRequestVerification = useCallback(async () => {
    if (!client || !contractAddr) return;
    setVerifying(true);
    setShowVerification(true);
    try {
      toast.info('AI validators are scoring the deliverable - this can take a minute…');
      await requestAgentVerification(client, contractAddr);
      toast.success('AI verification complete!');
      await refresh();
    } catch (err: any) {
      toast.error(`Verification failed: ${err.message}`);
      setShowVerification(false);
    } finally {
      setVerifying(false);
    }
  }, [client, contractAddr, refresh]);

  const handleDispute = useCallback(async () => {
    if (!client || !contractAddr || !disputeReason) return;
    setDisputing(true);
    try {
      await disputeAgentTask(client, contractAddr, disputeReason);
      toast.success('Dispute filed.');
      setDisputeReason('');
      setShowVerification(false);
      await refresh();
    } catch (err: any) {
      toast.error(`Dispute failed: ${err.message}`);
    } finally {
      setDisputing(false);
    }
  }, [client, contractAddr, disputeReason, refresh]);

  const handleCancel = useCallback(async () => {
    if (!client || !contractAddr) return;
    setCancelling(true);
    try {
      await cancelAgentTask(client, contractAddr);
      toast.success('Task cancelled. Escrow can now be refunded to you.');
      await refresh();
    } catch (err: any) {
      toast.error(`Cancel failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  }, [client, contractAddr, refresh]);

  const handleCheckTimeout = useCallback(async () => {
    if (!client || !contractAddr) return;
    setCheckingTimeout(true);
    try {
      await checkAgentTaskTimeout(client, contractAddr);
      toast.success('Marked as missed deadline. Requester will be refunded, agent penalized.');
      await refresh();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setCheckingTimeout(false);
    }
  }, [client, contractAddr, refresh]);

  const handleRelease = useCallback(async () => {
    if (!client || !contractAddr) return;
    setReleasing(true);
    try {
      await releaseAgentTaskFunds(client, network, contractAddr);
      toast.success('Escrow released!');
      await refresh();
    } catch (err: any) {
      toast.error(`Release failed: ${err.message}`);
    } finally {
      setReleasing(false);
    }
  }, [client, contractAddr, network, refresh]);

  if (loading) {
    return (
      <AppShell breadcrumb="Agents / Loading…">
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-muted-foreground text-sm">Loading task from chain…</p>
        </div>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell breadcrumb="Agents / Not Found">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="404" className="w-72 text-center">
            <p className="text-muted-foreground text-sm mb-4">Task not found.</p>
            <button onClick={() => navigate('/agents')} className="tool-btn-primary w-full h-8">
              Back to Agents
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  const panel = (
    <>
      <PanelSection title="Properties">
        <PanelRow label="Status" value={<StatusBadge status={task.status} />} />
        <PanelRow label="Capability" value={task.capability_required || '-'} />
        <PanelRow label="Budget" value={`${task.budget} GEN`} />
        <PanelRow label="Bids" value={task.bid_count} />
        <PanelRow label="Bidding closes" value={formatDeadline(task.bidding_deadline)} />
        <PanelRow label="Deadline" value={formatDeadline(task.deadline)} />
        <PanelRow label="Requester" value={`${task.requester.slice(0, 6)}…${task.requester.slice(-4)}`} />
        <PanelRow
          label="Assigned agent"
          value={
            task.assigned_agent
              ? `${assignedAgentName ? `${assignedAgentName} · ` : ''}${task.assigned_agent.slice(0, 6)}…${task.assigned_agent.slice(-4)}`
              : '-'
          }
        />
        {task.assigned_agent && (
          <PanelRow label="Agent gets paid" value={`${task.assigned_price} GEN`} />
        )}
      </PanelSection>
      {escrow && (
        <PanelSection title="Escrow">
          <PanelRow label="Locked" value={`${escrow.lockedAmount} GEN`} />
          <PanelRow label="Released" value={escrow.released ? 'Yes' : 'No'} />
        </PanelSection>
      )}
      {verification && (
        <PanelSection title="Verification">
          <PanelRow label="Result" value={verification.verified ? 'Verified' : 'Rejected'} />
          <PanelRow label="Score" value={`${verification.confidence}/100`} />
        </PanelSection>
      )}
      {task.dispute_count > 0 && (
        <PanelSection title="Disputes">
          <PanelRow label="Disputes used" value={`${task.dispute_count} of ${MAX_DISPUTES}`} />
          {task.dispute_reason && <p className="text-xs text-muted-foreground leading-relaxed mt-1">"{task.dispute_reason}"</p>}
        </PanelSection>
      )}
    </>
  );

  return (
    <AppShell
      breadcrumb={`Agents / ${task.title}`}
      toolbar={
        <>
          <StatusBadge status={task.status} />
          <span className="text-xs font-medium text-foreground">{task.budget} GEN</span>
          <div className="flex-1" />
          {canCloseBidding && (
            <button onClick={handleCloseBidding} disabled={closing} className="tool-btn-primary">
              <Users className="h-3.5 w-3.5" /> {closing ? 'Closing…' : 'Close Bidding'}
            </button>
          )}
          {canRequestVerification && (
            <button onClick={handleRequestVerification} disabled={verifying} className="tool-btn-primary">
              <Sparkles className="h-3.5 w-3.5" /> {verifying ? 'Verifying…' : 'Request Verification'}
            </button>
          )}
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button disabled={cancelling} className="tool-btn border border-destructive/30 text-destructive hover:bg-destructive/10">
                  <Ban className="h-3.5 w-3.5" /> {cancelling ? 'Cancelling…' : 'Cancel Task'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is irreversible. The {task.budget} GEN escrow will be refunded to you - only
                    possible because bidding hasn't closed yet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it open</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Cancel Task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isConnected && (
            <button onClick={connect} className="tool-btn-primary">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          )}
        </>
      }
      panel={panel}
    >
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{task.title}</h1>
        </div>

        <CodeCard title="Task Specification">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {task.capability_required && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{task.capability_required}</span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
              <p className="text-foreground/85 leading-relaxed">{task.description}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Completion Rubric</p>
              <pre className="text-xs text-foreground/85 whitespace-pre-wrap bg-muted/40 rounded p-3 font-mono">{task.criteria}</pre>
            </div>
          </div>
        </CodeCard>

        {task.status === 'open' && (
          <CodeCard title="Bids" variant="blue">
            <div className="space-y-3">
              {bids.length === 0 && (
                <p className="text-xs text-muted-foreground">No bids yet - the auction is open for {formatDeadline(task.bidding_deadline)}.</p>
              )}
              {bids.length > 0 && (
                <div className="space-y-1.5">
                  {bids.map((b) => (
                    <div key={b.agent} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2.5 py-1.5">
                      <span className="font-mono text-foreground/85">{b.agent.slice(0, 6)}…{b.agent.slice(-4)}</span>
                      <span className="text-muted-foreground">{b.price} GEN · {b.eta_hours}h ETA</span>
                    </div>
                  ))}
                </div>
              )}
              {canBid ? (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder="Price (GEN)"
                      className="bg-background border-border text-sm"
                    />
                    <Input
                      type="number"
                      value={bidEta}
                      onChange={(e) => setBidEta(e.target.value)}
                      placeholder="ETA (hours)"
                      className="bg-background border-border text-sm"
                    />
                  </div>
                  <button onClick={handleBid} disabled={bidding || !bidPrice || !bidEta} className="tool-btn-primary h-8 w-full">
                    <Gavel className="h-3.5 w-3.5" /> {bidding ? 'Placing bid…' : 'Place Bid'}
                  </button>
                </div>
              ) : (
                isConnected && !isRequester && (
                  <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                    {alreadyBid ? "You've already bid on this task." : !myAgentActive ? 'Register as an agent to bid.' : 'Bidding is closed.'}
                  </p>
                )
              )}
            </div>
          </CodeCard>
        )}

        {canCheckTimeout && (
          <CodeCard title="Deadline Missed" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The assigned agent didn't submit before the deadline. Anyone can mark this as a
                timeout, refunding the requester and penalizing the agent's stake and reputation.
              </p>
              <button onClick={handleCheckTimeout} disabled={checkingTimeout} className="tool-btn-primary h-8 w-full">
                <TimerOff className="h-3.5 w-3.5" /> {checkingTimeout ? 'Marking…' : 'Mark Missed Deadline'}
              </button>
            </div>
          </CodeCard>
        )}

        {canSubmit && (
          <CodeCard title="Submit Deliverable" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Submit a URL to your work. It's fetched and committed right now - verification always
                judges this exact snapshot, never a live re-fetch.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deliverable URL</label>
                <Input
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://…"
                  className="bg-background border-border text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
                <Textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Anything the reviewer should know…"
                  className="bg-background border-border text-sm min-h-[70px]"
                />
              </div>
              <button onClick={handleSubmit} disabled={submitting || !evidenceUrl} className="tool-btn-primary h-8 w-full">
                <Send className="h-3.5 w-3.5" /> {submitting ? 'Submitting…' : 'Submit Deliverable'}
              </button>
            </div>
          </CodeCard>
        )}

        {(task.status === 'submitted' || task.status === 'disputed') && !showVerification && (
          <CodeCard title={task.status === 'disputed' ? 'Awaiting Re-verification' : 'Deliverable Locked'} variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {task.status === 'disputed'
                  ? 'This result was disputed. Either party can trigger the AI validators to score it again.'
                  : 'Either the requester or the assigned agent can trigger AI verification.'}
              </p>
              {task.status === 'disputed' && task.dispute_reason && (
                <p className="text-xs text-foreground/80 bg-muted/40 rounded p-2 italic">"{task.dispute_reason}"</p>
              )}
              {canRequestVerification ? (
                <button onClick={handleRequestVerification} disabled={verifying} className="tool-btn-primary h-8 w-full">
                  <Sparkles className="h-3.5 w-3.5" /> {verifying ? 'Verifying…' : 'Request Verification'}
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Only the requester or assigned agent can trigger verification.</p>
              )}
            </div>
          </CodeCard>
        )}

        {showVerification && (
          <CodeCard title="AI Verification" variant="blue">
            <VerificationProgress isActive={showVerification} result={verifying ? null : verification} />
          </CodeCard>
        )}

        {verification && !showVerification && (
          <CodeCard title="Verification Result">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {verification.verified ? <CheckCircle2 className="h-7 w-7 text-success" /> : <XCircle className="h-7 w-7 text-destructive" />}
                <div>
                  <p className={`font-semibold text-base ${verification.verified ? 'text-success' : 'text-destructive'}`}>
                    {verification.verified ? 'Verified' : 'Rejected'}
                  </p>
                  <p className="text-xs text-muted-foreground">Score: {verification.confidence}/100 · AI Consensus</p>
                </div>
              </div>
              <div className="bg-muted/40 rounded p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> AI Analysis
                </p>
                <p className="text-sm text-foreground/85 leading-relaxed">{verification.reasoning}</p>
              </div>
              {task.submission_note && (
                <div className="bg-muted/40 rounded p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Agent's Note</p>
                  <p className="text-sm text-foreground/85 leading-relaxed">{task.submission_note}</p>
                </div>
              )}
              {task.submission_url && (
                <a href={task.submission_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-secondary hover:underline font-mono">
                  <ExternalLink className="h-3 w-3" /> {task.submission_url}
                </a>
              )}
            </div>
          </CodeCard>
        )}

        {escrow && !escrow.released && (task.status === 'verified' || task.status === 'rejected' || isTerminalNoOutcome) && (
          <CodeCard title="Escrow" variant={releaseEligible ? 'default' : 'blue'}>
            <div className="flex items-start gap-3">
              {releaseEligible ? <Unlock className="h-5 w-5 text-success shrink-0 mt-0.5" /> : <Lock className="h-5 w-5 text-secondary shrink-0 mt-0.5" />}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground/85">
                  {task.status === 'verified'
                    ? `${escrow.lockedAmount} GEN is locked - ${task.assigned_price} GEN pays the agent (its winning bid), ${escrow.lockedAmount - task.assigned_price} GEN refunds the requester.`
                    : `${escrow.lockedAmount} GEN is locked, payable to the requester (refund).`}
                  {isTerminalNoOutcome
                    ? ' No dispute window applies here - anyone can release it now.'
                    : releaseEligible
                      ? ' The 24h dispute window has passed - anyone can release it now.'
                      : releaseEligibleAt
                        ? ` Releases automatically ${formatDistanceToNowStrict(new Date(releaseEligibleAt * 1000), { addSuffix: true })} if not disputed.`
                        : ''}
                </p>
                {releaseEligible && isConnected && (
                  <button onClick={handleRelease} disabled={releasing} className="tool-btn-primary h-8">
                    <Unlock className="h-3.5 w-3.5" /> {releasing ? 'Releasing…' : 'Release Escrow'}
                  </button>
                )}
              </div>
            </div>
          </CodeCard>
        )}

        {canDispute && !showVerification && (
          <CodeCard title="Dispute This Result">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Disputing blocks escrow release until re-verification. {disputesRemaining} of {MAX_DISPUTES}{' '}
                disputes remaining - once used up, the decision is final.
              </p>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Explain what the AI scoring missed or got wrong…"
                className="bg-background border-border text-sm min-h-[70px]"
              />
              <button
                onClick={handleDispute}
                disabled={disputing || !disputeReason}
                className="tool-btn h-8 w-full border border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Gavel className="h-3.5 w-3.5" /> {disputing ? 'Filing dispute…' : 'Dispute Result'}
              </button>
            </div>
          </CodeCard>
        )}

        {isTerminalNoOutcome && (
          <CodeCard title={task.status === 'cancelled' ? 'Cancelled' : 'Expired'}>
            <p className="text-sm text-foreground/85">
              {task.status === 'cancelled'
                ? 'This task was cancelled by its requester before bidding closed.'
                : 'This task expired with no bids received.'}
            </p>
          </CodeCard>
        )}

        {!isConnected && (
          <CodeCard title="Connect">
            <p className="text-muted-foreground text-sm mb-3">Connect your wallet to interact with this task.</p>
            <button onClick={connect} className="tool-btn-primary h-8">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          </CodeCard>
        )}
      </div>
    </AppShell>
  );
};

export default AgentTaskDetail;
