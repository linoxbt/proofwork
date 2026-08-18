import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
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
import { CheckCircle2, XCircle, ExternalLink, GitBranch, Cpu, User, ArrowLeft } from 'lucide-react';

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

  // Auto-trigger verification animation for submitted/verified/rejected tasks
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
      toast.info('Submitting work — AI validators will fetch and analyze the repo, this can take a minute...');
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
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm font-mono">Loading task from chain...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <CodeCard title="404">
            <p className="text-muted-foreground text-sm mb-4 font-mono">Task not found.</p>
            <button onClick={() => navigate('/tasks')} className="text-xs text-primary font-mono hover:underline">
              ← Back to tasks
            </button>
          </CodeCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono mb-6 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> back to tasks
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Task info */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-lg font-bold text-foreground">{task.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={task.status} />
                <span className="text-xs font-mono text-accent font-medium">{task.reward_amount} GEN</span>
              </div>
            </div>
          </div>

          {/* Description & Criteria */}
          <CodeCard title="task_spec.md">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Description</p>
                <p className="text-foreground/80 leading-relaxed">{task.description}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Verification Criteria</p>
                <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap bg-muted/30 rounded p-3">
                  {task.criteria}
                </pre>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> Creator: {task.creator}</span>
                {task.worker && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Worker: {task.worker}</span>}
              </div>
            </div>
          </CodeCard>

          {/* Actions */}
          {canClaim && (
            <CodeCard title="claim_task.sh">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Ready to take on this task? Claim it to get started.</p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {claiming ? '⏳ Claiming...' : '$ claim_task'}
                </button>
              </div>
            </CodeCard>
          )}

          {canSubmit && (
            <CodeCard title="submit_work.sh" variant="blue">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Submit your GitHub repository URL for AI verification.</p>
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="bg-background border-border font-mono text-sm"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !githubUrl}
                  className="w-full py-2.5 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '⏳ Submitting for AI Review...' : '$ submit_work --verify'}
                </button>
              </div>
            </CodeCard>
          )}

          {/* Verification animation */}
          {showVerification && (
            <CodeCard title="ai_verification.log" variant="blue">
              <VerificationProgress
                isActive={showVerification}
                result={verification}
              />
            </CodeCard>
          )}

          {/* Verification result details */}
          {verification && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <CodeCard title="verification_result.json" variant={verification.verified ? 'default' : 'blue'}>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {verification.verified ? (
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive" />
                    )}
                    <div>
                      <p className={`font-mono font-bold text-lg ${verification.verified ? 'text-primary glow-green' : 'text-destructive glow-red'}`}>
                        {verification.verified ? 'VERIFIED ✓' : 'REJECTED ✗'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Confidence: {verification.confidence}% · AI Consensus
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-mono text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Cpu className="h-3 w-3" /> AI Analysis
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{verification.reasoning}</p>
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
            </motion.div>
          )}

          {task.status === 'submitted' && !verification && !showVerification && (
            <CodeCard title="verifying...">
              <div className="flex items-center gap-3 py-2">
                <Cpu className="h-5 w-5 text-secondary animate-pulse-glow" />
                <div>
                  <p className="text-sm font-mono text-secondary glow-blue">AI Validators Processing...</p>
                  <p className="text-xs text-muted-foreground">Fetching repo, analyzing code, reaching consensus</p>
                </div>
              </div>
            </CodeCard>
          )}

          {!isConnected && (
            <CodeCard title="connect">
              <p className="text-muted-foreground text-sm mb-3">Connect your wallet to interact with this task.</p>
              <button onClick={connect} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm">
                Connect Wallet
              </button>
            </CodeCard>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default TaskDetail;
