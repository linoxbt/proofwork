import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { CodeCard } from '@/components/CodeCard';
import { StatusBadge } from '@/components/StatusBadge';
import { GenLayerExplainer } from '@/components/GenLayerExplainer';
import { useWallet } from '@/hooks/useWallet';
import { MOCK_TASKS } from '@/lib/gameState';
import { Shield, GitBranch, Cpu, CheckCircle2, ArrowRight, Code2, Zap } from 'lucide-react';

const Index = () => {
  const { isConnected, connect, isConnecting } = useWallet();
  const navigate = useNavigate();

  const steps = [
    { icon: Code2, label: 'Post Task', desc: 'Define work criteria on-chain', color: 'text-primary' },
    { icon: GitBranch, label: 'Submit Proof', desc: 'Worker submits GitHub URL', color: 'text-secondary' },
    { icon: Cpu, label: 'AI Verifies', desc: 'Validators analyze the repo', color: 'text-accent' },
    { icon: CheckCircle2, label: 'Consensus', desc: 'VERIFIED ✓ or REJECTED ✗', color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24 relative">
        <div className="absolute inset-0 grid-bg opacity-30" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-6">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-xs font-mono text-primary">Powered by GenLayer Intelligent Contracts</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-foreground">AI-Verified</span>
            <br />
            <span className="text-primary glow-green">Proof of Work</span>
          </h1>

          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Smart contracts that use AI consensus to verify if you actually did your work.
            No humans needed — just code and decentralized AI validators.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isConnected ? (
              <>
                <button
                  onClick={() => navigate('/tasks')}
                  className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  Browse Tasks <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/create')}
                  className="px-6 py-2.5 rounded-lg border border-border text-foreground font-mono text-sm hover:bg-muted transition-colors"
                >
                  Post a Task
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet to Start'}
              </button>
            )}
          </div>
        </motion.div>
      </section>

      {/* How it works — steps */}
      <section className="px-4 py-16 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm font-mono text-muted-foreground uppercase tracking-widest mb-10"
          >
            How It Works
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <CodeCard title={`step_${i + 1}`}>
                  <div className="space-y-3">
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                    <p className="font-mono font-semibold text-sm text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </CodeCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* GenLayer Deep Dive */}
      <GenLayerExplainer />

      {/* Recent tasks preview */}
      <section className="px-4 py-16 border-t border-border bg-card/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-mono text-muted-foreground uppercase tracking-widest mb-10">
            Recent Tasks
          </h2>
          <div className="grid gap-3">
            {MOCK_TASKS.slice(0, 3).map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                onClick={() => navigate(`/task/${task.contractAddress}`)}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-xs font-mono text-accent">{task.rewardAmount} GEN</span>
                  <StatusBadge status={task.status} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="ProofWork" className="h-4 w-4 rounded-sm" />
          <span className="text-xs text-muted-foreground font-mono">
            ProofWork — AI-Verified Task Completion on <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a> · Asimov Testnet
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
