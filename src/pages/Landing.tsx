import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import {
  ArrowRight,
  Shield,
  Cpu,
  Users,
  Gavel,
  CalendarClock,
  GitBranch,
  CheckCircle2,
  Wallet,
  Github,
} from 'lucide-react';

const STEPS = [
  { icon: GitBranch, title: 'Post a Task', desc: 'Define the work, a rubric, a reward, and a deadline.' },
  { icon: Wallet, title: 'Worker Claims It', desc: 'Anyone can pick up an open task and get to work.' },
  { icon: Cpu, title: 'AI Verifies', desc: 'Validators fetch the evidence and judge it against the rubric.' },
  { icon: Users, title: 'Consensus', desc: 'A supermajority of independent validators must agree.' },
];

const FEATURES = [
  {
    icon: Shield,
    title: 'Trustless Verification',
    desc: 'No human reviewers. GenLayer Intelligent Contracts fetch your evidence and judge it on-chain.',
  },
  {
    icon: Users,
    title: 'Validator Consensus',
    desc: 'Multiple independent AI validators must reach agreement before a verdict is final.',
  },
  {
    icon: Gavel,
    title: 'Built-in Disputes',
    desc: 'Disagree with a verdict? File a dispute with your reasoning and get a fresh, informed re-review.',
  },
  {
    icon: CalendarClock,
    title: 'Deadlines & Categories',
    desc: 'Every task carries a real deadline and category, enforced on-chain — not just decoration.',
  },
];

function revealProps(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.5, delay },
  };
}

function FlowGraphic() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <div ref={ref} className="relative">
      {/* connecting line, desktop only */}
      <svg
        className="hidden md:block absolute top-7 left-0 w-full h-2 -z-0"
        viewBox="0 0 400 8"
        preserveAspectRatio="none"
      >
        <motion.line
          x1="12" y1="4" x2="388" y2="4"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <motion.line
          x1="12" y1="4" x2="388" y2="4"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.2 }}
        />
      </svg>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.18 }}
            className="flex flex-col items-center text-center gap-3"
          >
            <div className="h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center relative">
              <step.icon className="h-5 w-5 text-primary" />
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[160px] leading-relaxed">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Abstract "AI validators reaching consensus" graphic — nodes independently
// examining evidence, then converging. Pure inline SVG + CSS, no assets.
function ConsensusGraphic() {
  const nodes = [
    { x: 60, y: 40 }, { x: 220, y: 20 }, { x: 340, y: 90 },
    { x: 300, y: 200 }, { x: 140, y: 220 }, { x: 40, y: 150 },
  ];
  const center = { x: 190, y: 120 };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      <div className="absolute inset-0 animated-glow rounded-full" />
      <svg viewBox="0 0 380 260" className="relative w-full h-full">
        {nodes.map((n, i) => (
          <line
            key={`l-${i}`}
            x1={n.x} y1={n.y} x2={center.x} y2={center.y}
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
          />
        ))}
        <circle cx={center.x} cy={center.y} r="22" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        <circle cx={center.x} cy={center.y} r="7" fill="hsl(var(--primary))" />
        {nodes.map((n, i) => (
          <g key={`n-${i}`}>
            <circle
              cx={n.x} cy={n.y} r="14"
              fill="hsl(var(--card))"
              stroke={i % 3 === 0 ? 'hsl(var(--success))' : 'hsl(var(--secondary))'}
              strokeWidth="2"
              className="node-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
            <circle cx={n.x} cy={n.y} r="4" fill={i % 3 === 0 ? 'hsl(var(--success))' : 'hsl(var(--secondary))'} />
          </g>
        ))}
      </svg>
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const verifiedCount = tasks.filter((t) => t.status === 'verified').length;

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded-[4px]" />
            <span className="text-sm font-semibold tracking-tight">ProofWork</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => navigate('/about')}
              className="hidden sm:inline-flex text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              How it works
            </button>
            <a
              href="https://github.com/linoxbt/proofwork"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5"
              title="View on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <button onClick={() => navigate('/board')} className="tool-btn-primary h-8 px-3.5">
              Launch App <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="hero-glow" aria-hidden />
        <div className="grid-bg absolute inset-0 opacity-[0.15]" aria-hidden />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/5 mb-6"
          >
            <Cpu className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">Powered by GenLayer Intelligent Contracts</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]"
          >
            Post work. Get it done.
            <br />
            <span className="text-gradient">Let AI consensus verify it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            No human reviewers, no central authority. ProofWork uses independent AI validators on
            GenLayer to check submitted work against your criteria — and reach on-chain consensus.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              onClick={() => navigate('/board')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                         bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Launch App <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/create')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                         border border-border text-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Post a Task
            </button>
          </motion.div>

          {tasks.length > 0 && (
            <motion.div {...revealProps(0.4)} className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="status-dot bg-primary" /> {tasks.length} task{tasks.length === 1 ? '' : 's'} posted
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" /> {verifiedCount} AI-verified
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* Flow */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-border/60">
        <div className="max-w-4xl mx-auto">
          <motion.div {...revealProps()} className="text-center mb-14">
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">How It Works</h2>
          </motion.div>
          <FlowGraphic />
        </div>
      </section>

      {/* Consensus graphic + features */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-border/60 bg-card/20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div {...revealProps()}>
            <ConsensusGraphic />
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...revealProps(i * 0.08)}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 hover:-translate-y-0.5 transition-all"
              >
                <f.icon className="h-5 w-5 text-primary mb-2.5" />
                <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/60 text-center">
        <motion.div {...revealProps()} className="max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ready to get to work?</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Connect a wallet, post a task or claim one, and let AI consensus handle verification.
          </p>
          <button
            onClick={() => navigate('/board')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                       bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Launch App <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 px-4 py-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="ProofWork" className="h-4 w-4 rounded-sm" />
          <span className="text-xs text-muted-foreground">
            ProofWork — AI-Verified Task Completion on{' '}
            <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a>
            {' '}· Asimov Testnet
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Made by{' '}
          <a href="https://x.com/linoxbt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Lino
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Landing;
