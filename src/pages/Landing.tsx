import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import {
  ArrowRight,
  Cpu,
  Users,
  Gavel,
  GitBranch,
  CheckCircle2,
  Wallet,
  Github,
  Lock,
  Globe,
} from 'lucide-react';

const STEPS = [
  { icon: GitBranch, title: 'Post & Fund', desc: 'Define the work, a rubric, and lock the reward in escrow.' },
  { icon: Wallet, title: 'Claim', desc: 'A worker picks up the open task and gets to work.' },
  { icon: Cpu, title: 'AI Verifies', desc: 'Validators fetch the evidence and judge it against the rubric.' },
  { icon: Users, title: 'Consensus', desc: 'A supermajority of independent validators must agree.' },
  { icon: Lock, title: 'Escrow Releases', desc: '24h later - to the worker if verified, refunded if not.' },
];

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, delay },
});

function FlowRail() {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
      <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-5">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            {...reveal(i * 0.08)}
            className="w-56 sm:w-auto shrink-0 rounded-lg border border-border bg-card p-4 relative"
          >
            <span className="absolute top-3 right-3 text-[10px] font-mono text-muted-foreground">0{i + 1}</span>
            <step.icon className="h-5 w-5 text-primary mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">{step.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Abstract "AI validators reaching consensus" graphic - independent nodes
// examining evidence, then converging on a verdict. Pure inline SVG + CSS.
function ConsensusGraphic() {
  const nodes = [
    { x: 60, y: 40 }, { x: 220, y: 20 }, { x: 340, y: 90 },
    { x: 300, y: 200 }, { x: 140, y: 220 }, { x: 40, y: 150 },
  ];
  const center = { x: 190, y: 120 };

  return (
    <div className="relative w-full aspect-square">
      <div className="absolute inset-0 animated-glow rounded-full" />
      <svg viewBox="0 0 380 260" className="relative w-full h-full">
        {nodes.map((n, i) => (
          <line key={`l-${i}`} x1={n.x} y1={n.y} x2={center.x} y2={center.y} stroke="hsl(var(--border))" strokeWidth="1.5" />
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

function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="border-y border-border bg-card/40 overflow-hidden">
      <div className="marquee-track py-3">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-2 px-6 text-xs text-muted-foreground whitespace-nowrap">
            <span className="status-dot bg-primary" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  const verifiedCount = tasks.filter((t) => t.status === 'verified').length;
  const escrowLocked = tasks.filter((t) => !t.escrowReleased).reduce((s, t) => s + t.escrowLocked, 0);
  const workers = new Set(tasks.filter((t) => t.worker).map((t) => t.worker.toLowerCase())).size;

  const marqueeItems = [
    `${tasks.length} task${tasks.length === 1 ? '' : 's'} posted`,
    `${escrowLocked.toLocaleString()} GEN locked in escrow`,
    `${workers} active worker${workers === 1 ? '' : 's'}`,
    `${verifiedCount} AI-verified completions`,
    'Deployed on Asimov Testnet & Studionet',
    'Consensus by independent AI validators',
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-hidden">
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

      {/* Hero - asymmetric split, not centered */}
      <section ref={heroRef} className="relative px-4 sm:px-6 pt-14 pb-10 sm:pt-20">
        <div className="hero-glow" aria-hidden />
        <div className="grid-bg absolute inset-0 opacity-[0.12]" aria-hidden />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-6 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/5 mb-6"
            >
              <Cpu className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">GenLayer Intelligent Contracts · Real GEN Escrow</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-left"
            >
              Post work.
              <br />
              Get it verified
              <br />
              <span className="text-gradient">by AI consensus.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed text-left"
            >
              No human reviewers. Reward locked in on-chain escrow the moment you post - independent AI
              validators fetch the evidence, judge it against your rubric, and reach consensus.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row items-start gap-3"
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
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={heroInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative lg:translate-x-6"
          >
            <ConsensusGraphic />
          </motion.div>
        </div>
      </section>

      <Marquee items={marqueeItems} />

      {/* Bento feature grid - asymmetric, left-aligned */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <motion.h2 {...reveal()} className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-6">
            Why ProofWork
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-3">
            <motion.div {...reveal(0)} className="bento-tile lg:col-span-2 lg:row-span-2 flex flex-col justify-between">
              <div>
                <Lock className="h-6 w-6 text-primary mb-3" />
                <p className="text-lg font-semibold text-foreground mb-2">Real escrow, not a display number</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  The TaskFactory contract locks GEN the moment a task is created. It only pays out - or
                  refunds - 24 hours after a decided verdict, giving both sides a real window to dispute.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Auto-release after 24h</span>
                <span className="flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5 text-accent" /> Disputable</span>
              </div>
            </motion.div>

            <motion.div {...reveal(0.08)} className="bento-tile">
              <Cpu className="h-5 w-5 text-primary mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Independent AI Validators</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Each fetches evidence fresh - no single point of failure.</p>
            </motion.div>

            <motion.div {...reveal(0.14)} className="bento-tile">
              <Globe className="h-5 w-5 text-secondary mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Globally Discoverable</p>
              <p className="text-xs text-muted-foreground leading-relaxed">A factory contract tracks every task - visible to all, on-chain.</p>
            </motion.div>

            <motion.div {...reveal(0.2)} className="bento-tile sm:col-span-2 lg:col-span-2">
              <Users className="h-5 w-5 text-accent mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Consensus, Not a Single Judge</p>
              <p className="text-xs text-muted-foreground leading-relaxed">A supermajority of validators must independently agree before a verdict is final.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-border/60">
        <div className="max-w-6xl mx-auto">
          <motion.h2 {...reveal()} className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-6">
            How It Works
          </motion.h2>
          <FlowRail />
        </div>
      </section>

      {/* Final CTA - asymmetric banner */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <motion.div
          {...reveal()}
          className="max-w-6xl mx-auto rounded-xl border border-border bg-card overflow-hidden relative"
        >
          <div className="hero-glow opacity-60" aria-hidden />
          <div className="relative px-6 sm:px-10 py-10 sm:py-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Ready to get to work?</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Connect a wallet, post a task or claim one, and let AI consensus handle verification.
              </p>
            </div>
            <button
              onClick={() => navigate('/board')}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                         bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Launch App <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60 px-4 py-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="ProofWork" className="h-4 w-4 rounded-sm" />
          <span className="text-xs text-muted-foreground">
            ProofWork - AI-Verified Task Completion on{' '}
            <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
