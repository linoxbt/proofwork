import { AppShell } from '@/components/shell/AppShell';
import { CodeCard } from '@/components/CodeCard';
import { Shield, Cpu, Users, Globe, Lock } from 'lucide-react';

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

const PIPELINE = [
  { label: 'gl.nondet.web.render()', desc: 'Fetches the submitted GitHub repository content directly from within the smart contract' },
  { label: 'gl.nondet.exec_prompt()', desc: 'Runs AI analysis on the fetched code against the task\'s specified criteria' },
  { label: 'gl.eq_principle.prompt_comparative()', desc: 'Independent validators re-derive the result and compare it against the leader\'s answer' },
  { label: 'On-chain result', desc: 'Verification outcome is stored immutably on the GenLayer blockchain' },
];

const About = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">How AI Verification Works</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            GenLayer's Intelligent Contracts go beyond traditional blockchain limitations. They can access
            the internet, run AI models, and reach decentralized consensus — all natively on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HOW_IT_WORKS.map((item) => (
            <CodeCard key={item.title} title={item.title}>
              <div className="flex items-start gap-3">
                <item.icon className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </CodeCard>
          ))}
        </div>

        <CodeCard title="Verification Pipeline" variant="blue">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-1">
              For every submission, the Intelligent Contract executes this pipeline:
            </p>
            {PIPELINE.map((step, i) => (
              <div key={step.label} className="flex items-start gap-3">
                <span className="text-xs text-secondary shrink-0 w-4 text-right">{i + 1}.</span>
                <div>
                  <code className="text-xs font-mono text-primary">{step.label}</code>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CodeCard>

        <div className="flex items-center gap-3 px-4 py-3 rounded border border-border bg-card">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Built on <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a> · Asimov Testnet ·{' '}
            <a href="https://studio.genlayer.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Try GenLayer Studio →</a>
          </p>
        </div>
      </div>
    </AppShell>
  );
};

export default About;
