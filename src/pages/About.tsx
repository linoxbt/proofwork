import { AppShell } from '@/components/shell/AppShell';
import { CodeCard } from '@/components/CodeCard';
import { NETWORKS } from '@/lib/networks';
import {
  Shield, Cpu, Users, Globe, Lock, Gavel, Clock, GitBranch, Wallet, HandCoins,
  Send, ScanSearch, Unlock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';

const STATUSES = [
  { name: 'open', desc: 'Task is deployed, escrow is funded, waiting for a worker to claim it.' },
  { name: 'claimed', desc: 'A worker has claimed the task and is working on it. Only that worker can submit.' },
  { name: 'submitted', desc: 'Evidence has been submitted and is locked. Either party can now request AI verification.' },
  { name: 'verified', desc: 'AI validators reached consensus that the evidence meets the criteria. Escrow will pay the worker.' },
  { name: 'rejected', desc: 'AI validators reached consensus that the evidence does not meet the criteria. Escrow will refund the creator.' },
  { name: 'disputed', desc: 'Either party contested a verified/rejected verdict. Escrow release is blocked until re-verification. Capped at 3 disputes per task - after that, the last verdict is final.' },
  { name: 'cancelled', desc: 'The creator cancelled the task before anyone claimed it. Escrow refunds to the creator immediately, no waiting period.' },
  { name: 'expired', desc: "The deadline passed with no evidence ever submitted. Anyone can mark it expired, refunding the creator's escrow immediately." },
];

const FIELDS = [
  { name: 'Category', desc: 'What kind of work this is (Backend, Frontend, Smart Contract, Design, Data/ML, DevOps, or a free-text "Other").' },
  { name: 'Priority', desc: 'Low / Medium / High - informational, not enforced on-chain.' },
  { name: 'Estimated Effort', desc: '< 1 hour, 1-4 hours, 1 day, or multi-day - a hint to workers about scope.' },
  { name: 'Evidence Format', desc: 'What kind of proof is expected: a GitHub repo, a live URL, a video, a document, a design file, or a free-text "Other". Given to the AI as context so it judges the right thing.' },
  { name: 'Deadline', desc: 'A real date and time, enforced on-chain - claiming or submitting after it has passed reverts.' },
  { name: 'Reward', desc: 'The GEN amount locked in escrow when the task is created.' },
];

const About = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">ProofWork Documentation</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            ProofWork is an on-chain task board where work is verified by independent AI validators
            reaching consensus, instead of a human reviewer, and where the reward is real GEN held in
            escrow from the moment a task is created. This page is the full reference for how it works.
          </p>
        </div>

        {/* Overview */}
        <CodeCard title="Overview">
          <div className="space-y-3 text-sm">
            <p className="text-foreground/85 leading-relaxed">
              A creator posts a task with a description, a rubric ("criteria"), an expected evidence
              format, a deadline, and a reward. The reward is paid in the same transaction that creates
              the task and is locked in a <code className="text-primary font-mono text-xs">TaskFactory</code> contract's
              escrow. A worker claims the open task, does the work, and submits a URL as evidence.
              Either the creator or the worker can then ask GenLayer's AI validators to check that
              evidence against the rubric. If either side disagrees with the verdict, they can dispute
              it within the following 24 hours; otherwise the escrow releases automatically.
            </p>
            <p className="text-foreground/85 leading-relaxed">
              Nothing about verification is centralized: multiple independent validators each fetch the
              evidence themselves and must reach consensus, and the entire task list is discoverable
              on-chain through the factory contract - not stored in any database or browser.
            </p>
          </div>
        </CodeCard>

        {/* Lifecycle */}
        <CodeCard title="Task Lifecycle" variant="blue">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-1 rounded bg-primary/15 text-primary border border-primary/25">open</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="px-2 py-1 rounded bg-accent/15 text-accent border border-accent/25">claimed</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="px-2 py-1 rounded bg-secondary/15 text-secondary border border-secondary/25">submitted</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="px-2 py-1 rounded bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.35)]">verified</span>
              <span className="text-muted-foreground">/</span>
              <span className="px-2 py-1 rounded bg-destructive/12 text-destructive border border-destructive/25">rejected</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="px-2 py-1 rounded bg-accent/20 text-accent border border-accent/40">disputed?</span>
            </div>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <div key={s.name} className="flex items-start gap-3">
                  <code className="text-xs font-mono text-primary shrink-0 w-20">{s.name}</code>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </CodeCard>

        {/* Step by step */}
        <CodeCard title="Step by Step">
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <GitBranch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">1. Post & fund a task</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  The creator fills in title, category, description, rubric, evidence format, deadline,
                  and reward, then deploys. This is a <em>payable</em> call to the TaskFactory - the GEN
                  reward is sent in the same transaction and locked in escrow immediately. The factory
                  deploys a fresh TaskVerifier contract to hold this task's state.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HandCoins className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">2. Claim</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Any address other than the creator can claim an open task, as long as the deadline
                  hasn't passed. Only the claiming worker can submit evidence afterward.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Send className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">3. Submit evidence</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  The worker submits a URL matching the requested evidence format, plus an optional
                  note. The contract fetches the evidence right then and commits it - that exact
                  content is what every future verification judges, even after a dispute, so it can't
                  drift from what was actually submitted. Submitting does not trigger verification by
                  itself; that's a separate, explicit step.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ScanSearch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">4. Request verification</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Either the creator or the worker can trigger this, any time after submission.
                  Independent AI validators judge the evidence committed at submission time against
                  the rubric, reaching consensus on a verdict, a confidence score, and their reasoning.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Gavel className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">5. Dispute (optional)</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  If either party disagrees with the verdict, they can file a dispute with a reason.
                  This moves the task to "disputed," which blocks the escrow release. The next
                  verification run is given that reason as context, so validators specifically
                  re-examine the point raised rather than repeating the same judgment. Each task allows
                  at most 3 disputes - once that's used up, the current verdict is final and the 24-hour
                  countdown can no longer be reset.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Unlock className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">6. Escrow releases</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  24 hours after a verdict stands undisputed, anyone can trigger the release - it isn't
                  restricted to the two parties, so it can't get stuck waiting on someone. Verified
                  tasks pay the worker; rejected tasks refund the creator.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">7. Cancel or reclaim (the escape hatches)</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  A creator can cancel an unclaimed task for an instant refund. If a task is claimed but
                  the deadline passes with nothing ever submitted, anyone can mark it expired - also an
                  instant refund to the creator, no 24-hour wait either way, since there's nothing to
                  dispute in either case.
                </p>
              </div>
            </div>
          </div>
        </CodeCard>

        {/* Escrow details */}
        <CodeCard title="Escrow & Payments" variant="blue">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-foreground/85 leading-relaxed">
                The reward isn't a display number - it's real GEN. Creating a task is a payable call to
                the factory, and the attached value must exactly equal the stated reward amount (in
                atto-GEN, i.e. reward × 10<sup>18</sup>). The factory holds that GEN until release.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <p className="text-foreground/85 leading-relaxed">
                A verdict starts a 24-hour countdown from the moment it's recorded. Filing a dispute
                clears that timestamp; the next successful verification starts a fresh 24-hour window.
                Escrow can only ever be released once - a factory-level flag prevents double payment.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <p className="text-foreground/85 leading-relaxed">
                Release is permissionless by design: any address can call it once the conditions are
                met, so payment never depends on either party remembering to claim it.
              </p>
            </div>
          </div>
        </CodeCard>

        {/* AI verification pipeline */}
        <CodeCard title="AI Verification Pipeline">
          <div className="space-y-3 text-sm">
            <p className="text-foreground/85 leading-relaxed">
              Verification runs inside the TaskVerifier contract itself, using GenLayer's non-deterministic
              execution primitives:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono text-primary shrink-0 w-56">gl.nondet.web.render()</code>
                <p className="text-xs text-muted-foreground leading-relaxed">Fetches the submitted evidence URL fresh, from inside the contract, every time verification runs.</p>
              </div>
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono text-primary shrink-0 w-56">gl.nondet.exec_prompt()</code>
                <p className="text-xs text-muted-foreground leading-relaxed">Runs the actual AI judgment: title, description, rubric, expected format, and the fetched evidence are given to the model, which returns a verified/confidence/reasoning verdict as JSON.</p>
              </div>
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono text-primary shrink-0 w-56">gl.eq_principle.prompt_comparative()</code>
                <p className="text-xs text-muted-foreground leading-relaxed">Independent validators each re-run the analysis and compare results against a stated principle (verified must match exactly; confidence within 15 points) - a supermajority must agree, so no single validator's opinion decides the outcome.</p>
              </div>
            </div>
            <p className="text-foreground/85 leading-relaxed">
              The verdict, confidence score, and full reasoning are stored on-chain, permanently
              attached to the task.
            </p>
          </div>
        </CodeCard>

        {/* Task fields reference */}
        <CodeCard title="Task Fields Reference">
          <div className="space-y-2">
            {FIELDS.map((f) => (
              <div key={f.name} className="flex items-start gap-3">
                <span className="text-xs font-medium text-foreground shrink-0 w-32">{f.name}</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </CodeCard>

        {/* Architecture */}
        <CodeCard title="Architecture">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">TaskFactory (one per network)</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  The contract the app actually talks to. It's the money custodian (holds every task's
                  escrow) and the global registry (every task ever created is enumerable through it) -
                  there's no off-chain database or per-browser storage involved in "all tasks."
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Cpu className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">TaskVerifier (one per task)</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Deployed by the factory for every new task. Holds that task's own state machine and
                  runs its AI verification. The factory reads a task's live status through a
                  cross-contract call whenever escrow release is attempted.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Consensus, not a single judge</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Every write to a GenLayer Intelligent Contract - claiming, submitting, verifying,
                  disputing, releasing - goes through the same validator consensus as any other
                  transaction, on top of the additional AI-specific consensus used for verification
                  itself.
                </p>
              </div>
            </div>
          </div>
        </CodeCard>

        {/* Networks */}
        <CodeCard title="Networks & Contracts">
          <div className="space-y-3">
            {Object.values(NETWORKS).map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${n.gasless ? 'bg-secondary' : 'bg-primary'}`} />
                  <span className="font-medium text-foreground">{n.label}</span>
                  {n.gasless && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Gasless</span>}
                </div>
                <code className="font-mono text-muted-foreground">{n.factoryAddress}</code>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border">
              Switch networks from the badge in the title bar. Studionet is a free, hosted environment
              good for trying the full flow without spending real testnet GEN.
            </p>
          </div>
        </CodeCard>

        {/* FAQ */}
        <CodeCard title="FAQ" variant="blue">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> What happens if I disagree with a "verified" result?</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-5">
                Either party can dispute it within the 24-hour window. That blocks the payout and gives
                validators your reasoning as context for a fresh, independent re-review.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" /> What happens to my reward if the work is rejected?</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-5">
                It's automatically refunded to you (the creator) once the 24-hour window passes without
                a dispute.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-primary" /> Do I need real funds to try this?</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-5">
                Not on Studionet - it's a free, gasless environment. Asimov Testnet needs real testnet
                GEN from a faucet, since it's a genuine public network.
              </p>
            </div>
          </div>
        </CodeCard>

        <div className="flex items-center gap-3 px-4 py-3 rounded border border-border bg-card">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Built on <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GenLayer</a>.{' '}
            <a href="https://studio.genlayer.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Try GenLayer Studio &rarr;</a>
          </p>
        </div>
      </div>
    </AppShell>
  );
};

export default About;
