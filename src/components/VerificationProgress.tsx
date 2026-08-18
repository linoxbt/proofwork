import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Search, Code2, Cpu, Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  duration: number; // ms to simulate
}

const STEPS: VerificationStep[] = [
  { id: 'fetch', label: 'Fetching Repository', description: 'Downloading source code from GitHub...', icon: GitBranch, duration: 2200 },
  { id: 'parse', label: 'Parsing Codebase', description: 'Analyzing file structure and dependencies...', icon: Search, duration: 1800 },
  { id: 'analyze', label: 'AI Code Review', description: 'Evaluating code against task criteria...', icon: Code2, duration: 3000 },
  { id: 'validate', label: 'Running Validators', description: 'Multiple AI validators reaching independent conclusions...', icon: Cpu, duration: 2500 },
  { id: 'consensus', label: 'Consensus Protocol', description: 'Validators comparing results and reaching agreement...', icon: Users, duration: 2000 },
];

interface VerificationProgressProps {
  isActive: boolean;
  result?: { verified: boolean; confidence: number } | null;
  className?: string;
}

export function VerificationProgress({ isActive, result, className }: VerificationProgressProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setFinished(false);

    let stepIndex = 0;
    const advanceStep = () => {
      if (stepIndex >= STEPS.length) {
        setFinished(true);
        return;
      }
      setCurrentStep(stepIndex);
      const timer = setTimeout(() => {
        setCompletedSteps((prev) => new Set([...prev, STEPS[stepIndex].id]));
        stepIndex++;
        advanceStep();
      }, STEPS[stepIndex].duration);
      return () => clearTimeout(timer);
    };

    const cleanup = advanceStep();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [isActive]);

  if (!isActive && !finished) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = currentStep === i && !isCompleted;
        const isPending = i > currentStep;
        const Icon = step.icon;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors',
              isCurrent && 'bg-muted/40',
              isCompleted && 'bg-muted/20'
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isCompleted ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </motion.div>
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 text-secondary animate-spin" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium',
                isCompleted && 'text-primary',
                isCurrent && 'text-secondary',
                isPending && 'text-muted-foreground'
              )}>
                {step.label}
              </p>
              <AnimatePresence>
                {isCurrent && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="text-[11px] text-muted-foreground mt-0.5 overflow-hidden"
                  >
                    {step.description}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            {isCurrent && (
              <motion.div
                className="h-1 w-12 rounded-full bg-muted overflow-hidden mt-1.5 shrink-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full bg-secondary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: step.duration / 1000, ease: 'linear' }}
                />
              </motion.div>
            )}
          </motion.div>
        );
      })}

      <AnimatePresence>
        {finished && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded mt-2 border',
              result.verified
                ? 'bg-success/10 border-success/25'
                : 'bg-destructive/10 border-destructive/25'
            )}
          >
            {result.verified ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <div>
              <p className={cn(
                'text-sm font-semibold',
                result.verified ? 'text-success' : 'text-destructive'
              )}>
                {result.verified ? 'Consensus: Verified' : 'Consensus: Rejected'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {result.confidence}% confidence across all validators
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
