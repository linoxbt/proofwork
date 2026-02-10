import { motion } from 'framer-motion';
import { CodeCard } from '@/components/CodeCard';
import { Shield, Cpu, GitBranch, Users, Globe, Zap, Lock, Eye } from 'lucide-react';

const HOW_IT_WORKS = [
  {
    icon: Globe,
    title: 'Intelligent Contracts',
    desc: 'Unlike traditional smart contracts, GenLayer\'s Intelligent Contracts can access the internet, read web pages, and run AI models — all on-chain.',
  },
  {
    icon: Cpu,
    title: 'AI Validators',
    desc: 'Multiple independent AI validators analyze your GitHub submission. Each validator fetches the repo, reads the code, and evaluates it against the task criteria.',
  },
  {
    icon: Users,
    title: 'Consensus Protocol',
    desc: 'Validators don\'t just run once — they reach consensus. A supermajority must agree on the verification result, preventing any single point of failure.',
  },
  {
    icon: Lock,
    title: 'Trustless & Permissionless',
    desc: 'No human reviewers, no central authority. The verification is fully decentralized and deterministic. Anyone can post tasks, anyone can submit work.',
  },
];

const TECH_DETAILS = [
  { label: 'gl.get_webpage()', desc: 'Fetches GitHub repository content directly from within the smart contract' },
  { label: 'gl.exec_prompt()', desc: 'Runs AI analysis on the fetched code against your specified criteria' },
  { label: 'Consensus', desc: 'Multiple validators independently verify, then compare results' },
  { label: 'On-chain result', desc: 'Verification outcome is stored immutably on the GenLayer blockchain' },
];

export function GenLayerExplainer() {
  return (
    <section className="px-4 py-20 border-t border-border" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/20 bg-secondary/5 mb-4">
            <Eye className="h-3 w-3 text-secondary" />
            <span className="text-xs font-mono text-secondary">Deep Dive</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            How AI Verification <span className="text-primary glow-green">Actually</span> Works
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            GenLayer's Intelligent Contracts go beyond traditional blockchain limitations.
            They can access the internet, run AI models, and reach decentralized consensus — all natively on-chain.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <CodeCard title={item.title.toLowerCase().replace(/\s+/g, '_')}>
                <div className="flex items-start gap-3">
                  <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </CodeCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <CodeCard title="verification_pipeline.py" variant="blue">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-4">
                Under the hood, the Intelligent Contract executes this pipeline for every submission:
              </p>
              {TECH_DETAILS.map((detail, i) => (
                <div key={detail.label} className="flex items-start gap-3">
                  <span className="text-xs font-mono text-secondary shrink-0 w-5 text-right">{i + 1}.</span>
                  <div>
                    <code className="text-xs font-mono text-primary">{detail.label}</code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{detail.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CodeCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground font-mono">
              Built on <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a> · Asimov Testnet · 
              <a href="https://studio.genlayer.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline ml-1">Try GenLayer Studio →</a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
