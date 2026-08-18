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
  getTaskState,
  getReadOnlyClient,
  type ContractTaskState,
  type VerificationResult,
} from '@/lib/contract';
import { CheckCircle2, XCircle, ExternalLink, Cpu, Wallet, Send, HandCoins, ScanSearch, Gavel } from 'lucide-react';
import { format } from 'date-fns';

const TaskDetail = () => {
  const { address: contractAddr } = useParams();
  const navigate = useNavigate();
  const { address, client, isConnected, connect } = useWallet();
  const [githubUrl, setGithubUrl] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [task, setTask] = useState<ContractTaskState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!contractAddr) return;
    try {
      const state = await getTaskState(client ?? getReadOnlyClient(), contractAddr);
      setTask(state);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddr, client]);

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
    if (!client || !contractAddr || !githubUrl) return;
    setSubmitting(true);
    try {
      await submitWork(client, contractAddr, githubUrl);
      toast.success('Evidence submitted and locked. Either party can now request AI verification.');
      await refresh();
    } catch (err: any) {
      toast.error(`Submit failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [client, contractAddr, githubUrl, refresh]);

  const handleRequestVerification = useCallback(async () => {
    if (!client || !contractAddr) return;
    setVerifying(true);
    setShowVerification(true);
    try {
      toast.info('AI validators are fetching and analyzing the evidence — this can take a minute…');
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
            <button onClick={() => navigate('/')} className="tool-btn-primary w-full h-8">
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
        <PanelRow label="Category" value={task.category || '—'} />
        <PanelRow label="Reward" value={`${task.reward_amount} GEN`} />
        <PanelRow label="Deadline" value={format(new Date(task.deadline * 1000), 'MMM d, yyyy')} />
        <PanelRow label="Creator" value={`${task.creator.slice(0, 6)}…${task.creator.slice(-4)}`} />
        <PanelRow label="Worker" value={task.worker ? `${task.worker.slice(0, 6)}…${task.worker.slice(-4)}` : '—'} />
      </PanelSection>
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
          </div>
        </CodeCard>

        {canSubmit && (
          <CodeCard title="Submit Work" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Submit your GitHub repository URL as evidence. Once submitted, this is locked — verification
                is triggered separately by either party.
              </p>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="bg-background border-border text-sm font-mono"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !githubUrl}
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

              {task.submission_url && (
                <a
                  href={task.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-secondary hover:underline font-mono"
                >
                  <ExternalLink className="h-3 w-3" /> {task.submission_url}
                </a>
              )}
            </div>
          </CodeCard>
        )}

        {canDispute && !showVerification && (
          <CodeCard title="Dispute This Result">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                If you believe the AI verdict is wrong, explain why below. The task moves to "disputed" and
                either party can then request a fresh re-verification with your reasoning as context.
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
