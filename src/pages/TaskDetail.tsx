import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { VerificationProgress } from '@/components/VerificationProgress';
import { useWallet } from '@/hooks/useWallet';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  claimTask,
  submitWork,
  getTaskState,
  getReadOnlyClient,
  type ContractTaskState,
  type VerificationResult,
} from '@/lib/contract';
import { CheckCircle2, XCircle, ExternalLink, Cpu, Wallet, Send, HandCoins } from 'lucide-react';

const TaskDetail = () => {
  const { address: contractAddr } = useParams();
  const navigate = useNavigate();
  const { address, client, isConnected, connect } = useWallet();
  const [githubUrl, setGithubUrl] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const canClaim = task?.status === 'open' && isConnected && !isCreator;
  const canSubmit = task?.status === 'claimed' && isConnected && isWorker;

  useEffect(() => {
    if (task && (task.status === 'submitted' || task.status === 'verified' || task.status === 'rejected')) {
      const timer = setTimeout(() => setShowVerification(true), 500);
      return () => clearTimeout(timer);
    }
  }, [task]);

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
      toast.info('Submitting work — AI validators will fetch and analyze the repo, this can take a minute…');
      await submitWork(client, contractAddr, githubUrl);
      toast.success('AI verification complete!');
      setShowVerification(true);
      await refresh();
    } catch (err: any) {
      toast.error(`Submit failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [client, contractAddr, githubUrl, refresh]);

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
        <PanelRow label="Reward" value={`${task.reward_amount} GEN`} />
        <PanelRow label="Creator" value={`${task.creator.slice(0, 6)}…${task.creator.slice(-4)}`} />
        <PanelRow label="Worker" value={task.worker ? `${task.worker.slice(0, 6)}…${task.worker.slice(-4)}` : '—'} />
      </PanelSection>
      {verification && (
        <PanelSection title="Verification">
          <PanelRow label="Result" value={verification.verified ? 'Verified' : 'Rejected'} />
          <PanelRow label="Confidence" value={`${verification.confidence}%`} />
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
              <p className="text-xs text-muted-foreground">Submit your GitHub repository URL for AI verification.</p>
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
                {submitting ? 'Submitting for AI Review…' : 'Submit for Verification'}
              </button>
            </div>
          </CodeCard>
        )}

        {showVerification && (
          <CodeCard title="AI Verification" variant="blue">
            <VerificationProgress isActive={showVerification} result={verification} />
          </CodeCard>
        )}

        {verification && (
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

        {task.status === 'submitted' && !verification && !showVerification && (
          <CodeCard title="Verifying…">
            <div className="flex items-center gap-3 py-1">
              <Cpu className="h-5 w-5 text-secondary animate-pulse" />
              <div>
                <p className="text-sm font-medium text-secondary">AI Validators Processing…</p>
                <p className="text-xs text-muted-foreground">Fetching repo, analyzing code, reaching consensus</p>
              </div>
            </div>
          </CodeCard>
        )}
      </div>
    </AppShell>
  );
};

export default TaskDetail;
