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
import { toast } from 'sonner';
import {
  claimTask,
  submitWork,
  requestVerification,
  disputeTask,
  releaseFunds,
  getTaskState,
  getEscrowStatus,
  getReadOnlyClient,
  PRIVATE_EVIDENCE,
  type ContractTaskState,
  type VerificationResult,
  type EscrowStatus,
} from '@/lib/contract';
import {
  CheckCircle2, XCircle, ExternalLink, Cpu, Wallet, Send, HandCoins, ScanSearch, Gavel, Lock, Unlock, EyeOff,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';

const RELEASE_WINDOW_SECONDS = 86400;

// Tasks deployed before the `deadline` field existed on-chain read back as
// undefined/0, which produces an Invalid Date and throws in date-fns's
// format() - guard against that instead of crashing the whole page.
function formatDeadline(deadline: number | undefined): string {
  if (!deadline || !Number.isFinite(deadline)) return 'No deadline set';
  const date = new Date(deadline * 1000);
  if (Number.isNaN(date.getTime())) return 'No deadline set';
  return format(date, 'MMM d, yyyy p');
}

const TaskDetail = () => {
  const { address: contractAddr } = useParams();
  const navigate = useNavigate();
  const { address, client, isConnected, connect, network } = useWallet();
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [task, setTask] = useState<ContractTaskState | null>(null);
  const [escrow, setEscrow] = useState<EscrowStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!contractAddr) return;
    try {
      const [state, escrowStatus] = await Promise.all([
        getTaskState(client ?? getReadOnlyClient(network), contractAddr),
        getEscrowStatus(network, contractAddr),
      ]);
      setTask(state);
      setEscrow(escrowStatus);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddr, client, network]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const verification: VerificationResult | null = task?.verification_result
    ? JSON.parse(task.verification_result)
    : null;

  const isCreator = !!(task && address && task.creator.toLowerCase() === address.toLowerCase());
  const isWorker = !!(task && address && task.worker.toLowerCase() === address.toLowerCase());
  const isParty = isCreator || isWorker;

  const canClaim = task?.status === 'open' && isConnected && !isCreator;
  const canSubmit = task?.status === 'claimed' && isConnected && isWorker;
  const canRequestVerification =
    (task?.status === 'submitted' || task?.status === 'disputed') && isConnected && isParty;
  const canDispute = (task?.status === 'verified' || task?.status === 'rejected') && isConnected && isParty;

  const releaseEligibleAt = task && task.verified_at > 0 ? task.verified_at + RELEASE_WINDOW_SECONDS : null;
  const releaseEligible = releaseEligibleAt !== null && Date.now() / 1000 >= releaseEligibleAt;
  const canRelease =
    isConnected &&
    escrow &&
    !escrow.released &&
    (task?.status === 'verified' || task?.status === 'rejected') &&
    releaseEligible;

  const category = task?.category === 'Other' ? task.category_other : task?.category;
  const submissionFormat = task?.submission_format === 'Other' ? task?.submission_format_other : task?.submission_format;
  const evidenceIsPrivate = task?.submission_url === PRIVATE_EVIDENCE;
  const evidenceUrlPlaceholder =
    task?.submission_format === 'GitHub Repository'
      ? 'https://github.com/username/repo'
      : task?.submission_format === 'Live URL / Deployed App'
        ? 'https://your-app.example.com'
        : 'https://…';

  const handleClaim = useCallback(async () => {
    if (!client || !contractAddr) return;
    setClaiming(true);
    try {
      await claimTask(client, contractAddr);
      toast.success('Task claimed!');
      await refresh();
    } catch (err: any) {
      toast.error(`Claim failed: ${err.message}`);
    } finally {
      setClaiming(false);
    }
  }, [client, contractAddr, refresh]);

  const handleSubmit = useCallback(async () => {
    if (!client || !contractAddr || !evidenceUrl) return;
    setSubmitting(true);
    try {
      await submitWork(client, contractAddr, evidenceUrl, submissionNote);
      toast.success('Evidence submitted and locked. Either party can now request AI verification.');
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
      toast.info('AI validators are fetching and analyzing the evidence - this can take a minute…');
      await requestVerification(client, contractAddr);
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
      await disputeTask(client, contractAddr, disputeReason);
      toast.success('Dispute filed. Either party can now request re-verification.');
      setDisputeReason('');
      setShowVerification(false);
      await refresh();
    } catch (err: any) {
      toast.error(`Dispute failed: ${err.message}`);
    } finally {
      setDisputing(false);
    }
  }, [client, contractAddr, disputeReason, refresh]);

  const handleRelease = useCallback(async () => {
    if (!client || !contractAddr) return;
    setReleasing(true);
    try {
      await releaseFunds(client, network, contractAddr);
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
      <AppShell breadcrumb="Board / Loading…">
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-muted-foreground text-sm">Loading task from chain…</p>
        </div>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell breadcrumb="Board / Not Found">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="404" className="w-72 text-center">
            <p className="text-muted-foreground text-sm mb-4">Task not found.</p>
            <button onClick={() => navigate('/board')} className="tool-btn-primary w-full h-8">
              Back to Board
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
        <PanelRow label="Category" value={category || '-'} />
        <PanelRow label="Priority" value={task.priority || '-'} />
        <PanelRow label="Effort" value={task.estimated_effort || '-'} />
        <PanelRow label="Evidence Format" value={submissionFormat || '-'} />
        <PanelRow label="Reward" value={`${task.reward_amount} GEN`} />
        <PanelRow label="Deadline" value={formatDeadline(task.deadline)} />
        <PanelRow label="Creator" value={`${task.creator.slice(0, 6)}…${task.creator.slice(-4)}`} />
        <PanelRow label="Worker" value={task.worker ? `${task.worker.slice(0, 6)}…${task.worker.slice(-4)}` : '-'} />
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
          <PanelRow label="Confidence" value={`${verification.confidence}%`} />
        </PanelSection>
      )}
      {task.dispute_count > 0 && (
        <PanelSection title="Disputes">
          <PanelRow label="Times disputed" value={task.dispute_count} />
          {task.dispute_reason && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">"{task.dispute_reason}"</p>
          )}
        </PanelSection>
      )}
    </>
  );

  return (
    <AppShell
      breadcrumb={`Board / ${task.title}`}
      toolbar={
        <>
          <StatusBadge status={task.status} />
          <span className="text-xs font-medium text-foreground">{task.reward_amount} GEN</span>
          <div className="flex-1" />
          {canClaim && (
            <button onClick={handleClaim} disabled={claiming} className="tool-btn-primary">
              <HandCoins className="h-3.5 w-3.5" />
              {claiming ? 'Claiming…' : 'Claim Task'}
            </button>
          )}
          {canRequestVerification && (
            <button onClick={handleRequestVerification} disabled={verifying} className="tool-btn-primary">
              <ScanSearch className="h-3.5 w-3.5" />
              {verifying ? 'Verifying…' : 'Request Verification'}
            </button>
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
              {category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{category}</span>}
              {task.priority && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{task.priority} priority</span>}
              {task.estimated_effort && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{task.estimated_effort}</span>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
              <p className="text-foreground/85 leading-relaxed">{task.description}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Verification Criteria</p>
              <pre className="text-xs text-foreground/85 whitespace-pre-wrap bg-muted/40 rounded p-3 font-mono">
                {task.criteria}
              </pre>
            </div>
            {submissionFormat && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Expected Evidence Format</p>
                <p className="text-foreground/85">{submissionFormat}</p>
              </div>
            )}
          </div>
        </CodeCard>

        {canSubmit && (
          <CodeCard title="Submit Work" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This task expects <strong className="text-foreground">{submissionFormat || 'a URL'}</strong> as
                evidence. Once submitted, this is locked and only visible to you and the creator - verification
                is triggered separately by either party.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Evidence URL</label>
                <Input
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder={evidenceUrlPlaceholder}
                  className="bg-background border-border text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
                <Textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Anything the reviewer should know - what you built, how to test it, known limitations…"
                  className="bg-background border-border text-sm min-h-[70px]"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !evidenceUrl}
                className="tool-btn-primary h-8 w-full"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting…' : 'Submit Evidence'}
              </button>
            </div>
          </CodeCard>
        )}

        {(task.status === 'submitted' || task.status === 'disputed') && !showVerification && (
          <CodeCard title={task.status === 'disputed' ? 'Awaiting Re-verification' : 'Evidence Locked'} variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {task.status === 'disputed'
                  ? 'This result was disputed. Either the creator or the worker can trigger the AI validators to refetch the evidence and judge it again.'
                  : 'Evidence has been submitted and the submit action is now locked. Either the creator or the worker can trigger AI verification.'}
              </p>
              {task.status === 'disputed' && task.dispute_reason && (
                <p className="text-xs text-foreground/80 bg-muted/40 rounded p-2 italic">"{task.dispute_reason}"</p>
              )}
              {canRequestVerification ? (
                <button onClick={handleRequestVerification} disabled={verifying} className="tool-btn-primary h-8 w-full">
                  <ScanSearch className="h-3.5 w-3.5" />
                  {verifying ? 'Verifying…' : 'Request Verification'}
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Only the task creator or assigned worker can trigger verification.</p>
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
                {verification.verified ? (
                  <CheckCircle2 className="h-7 w-7 text-success" />
                ) : (
                  <XCircle className="h-7 w-7 text-destructive" />
                )}
                <div>
                  <p className={`font-semibold text-base ${verification.verified ? 'text-success' : 'text-destructive'}`}>
                    {verification.verified ? 'Verified' : 'Rejected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {verification.confidence}% · AI Consensus
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 rounded p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> AI Analysis
                </p>
                <p className="text-sm text-foreground/85 leading-relaxed">{verification.reasoning}</p>
              </div>

              {task.submission_note && task.submission_note !== PRIVATE_EVIDENCE && (
                <div className="bg-muted/40 rounded p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Worker's Note</p>
                  <p className="text-sm text-foreground/85 leading-relaxed">{task.submission_note}</p>
                </div>
              )}

              {task.submission_url && !evidenceIsPrivate && (
                <a
                  href={task.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-secondary hover:underline font-mono"
                >
                  <ExternalLink className="h-3 w-3" /> {task.submission_url}
                </a>
              )}
              {evidenceIsPrivate && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" /> Evidence is private to the task's creator and worker.
                </p>
              )}
            </div>
          </CodeCard>
        )}

        {escrow && !escrow.released && (task.status === 'verified' || task.status === 'rejected') && (
          <CodeCard title="Escrow" variant={releaseEligible ? 'default' : 'blue'}>
            <div className="flex items-start gap-3">
              {releaseEligible ? <Unlock className="h-5 w-5 text-success shrink-0 mt-0.5" /> : <Lock className="h-5 w-5 text-secondary shrink-0 mt-0.5" />}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground/85">
                  {escrow.lockedAmount} GEN is locked, payable to {task.status === 'verified' ? 'the worker' : 'the creator (refund)'}.
                  {releaseEligible
                    ? ' The 24h dispute window has passed - anyone can release it now.'
                    : releaseEligibleAt
                      ? ` Releases automatically ${formatDistanceToNowStrict(new Date(releaseEligibleAt * 1000), { addSuffix: true })} if not disputed.`
                      : ''}
                </p>
                {releaseEligible && isConnected && (
                  <button onClick={handleRelease} disabled={releasing} className="tool-btn-primary h-8">
                    <Unlock className="h-3.5 w-3.5" />
                    {releasing ? 'Releasing…' : 'Release Escrow'}
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
                If you believe the AI verdict is wrong, explain why below. The task moves to "disputed" and
                either party can then request a fresh re-verification with your reasoning as context. Disputing
                also blocks the escrow release until the case is resolved.
              </p>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Explain what the AI verification missed or got wrong…"
                className="bg-background border-border text-sm min-h-[70px]"
              />
              <button
                onClick={handleDispute}
                disabled={disputing || !disputeReason}
                className="tool-btn h-8 w-full border border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Gavel className="h-3.5 w-3.5" />
                {disputing ? 'Filing dispute…' : 'Dispute Result'}
              </button>
            </div>
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

export default TaskDetail;
