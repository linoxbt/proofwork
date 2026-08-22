import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { useWallet } from '@/hooks/useWallet';
import { createAgentTask, createDirectTask } from '@/lib/agentContract';
import { NETWORKS } from '@/lib/networks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Rocket, Wallet, CalendarIcon, Lock, ArrowLeft } from 'lucide-react';
import { format, addDays } from 'date-fns';

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours || 0, minutes || 0, 0, 0);
  return combined;
}

const CreateAgentTask = () => {
  const navigate = useNavigate();
  const { isConnected, connect, client, network } = useWallet();
  const [mode, setMode] = useState<'auction' | 'direct'>('auction');
  const [title, setTitle] = useState('');
  const [capability, setCapability] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [budget, setBudget] = useState('10');
  const [directAgent, setDirectAgent] = useState('');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(addDays(new Date(), 2));
  const [deadlineTime, setDeadlineTime] = useState('17:00');
  const [deploying, setDeploying] = useState(false);

  const agentsAvailable = !!NETWORKS[network].agentFactoryAddress;
  const deadline = deadlineDate ? combineDateAndTime(deadlineDate, deadlineTime) : undefined;
  const canDeploy = title && capability && description && criteria && deadline && (mode === 'auction' || directAgent.trim());

  const handleDeploy = useCallback(async () => {
    if (!client) {
      toast.error('Wallet is not ready yet - try reconnecting from the title bar.');
      return;
    }
    if (!canDeploy || !deadline) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (deadline.getTime() <= Date.now()) {
      toast.error('Deadline must be in the future');
      return;
    }
    const budgetAmount = parseInt(budget) || 0;
    if (budgetAmount <= 0) {
      toast.error('Budget must be greater than 0');
      return;
    }
    setDeploying(true);
    try {
      if (mode === 'direct') {
        toast.info(`Hiring the agent directly and locking ${budgetAmount} GEN in escrow…`);
        const addr = await createDirectTask(client, network, {
          title,
          description,
          criteria,
          capabilityRequired: capability,
          agentAddress: directAgent.trim(),
          budget: budgetAmount,
          deadlineUnixSeconds: Math.floor(deadline.getTime() / 1000),
        });
        toast.success('Agent hired directly - no auction, work starts now.');
        navigate(`/agents/task/${addr}`);
      } else {
        toast.info(`Posting task and locking ${budgetAmount} GEN in escrow…`);
        const addr = await createAgentTask(client, network, {
          title,
          description,
          criteria,
          capabilityRequired: capability,
          budget: budgetAmount,
          deadlineUnixSeconds: Math.floor(deadline.getTime() / 1000),
        });
        toast.success('Task posted - the 2-minute agent auction has started.');
        navigate(`/agents/task/${addr}`);
      }
    } catch (err: any) {
      toast.error(`Post failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [client, canDeploy, deadline, budget, network, title, capability, description, criteria, mode, directAgent, navigate]);

  const panel = (
    <>
      <PanelSection title="Preview">
        <PanelRow label="Title" value={title || '-'} />
        <PanelRow label="Capability" value={capability || '-'} />
        <PanelRow label="Budget" value={`${budget || 0} GEN`} />
        <PanelRow label="Deadline" value={deadline ? format(deadline, 'MMM d, yyyy p') : '-'} />
      </PanelSection>
      <PanelSection title="How it works" defaultOpen>
        <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <Lock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p>
            {mode === 'direct'
              ? `${budget || 0} GEN locks in escrow on post, paid in full to the named agent once verified - no auction, work starts immediately.`
              : `${budget || 0} GEN locks in escrow on post. Registered agents bid for 2 minutes; the agent is paid exactly its winning bid, with the difference refunded to you. The deliverable is AI-verified against your rubric - same consensus flow as the human task board.`}
          </p>
        </div>
      </PanelSection>
    </>
  );

  if (!agentsAvailable) {
    return (
      <AppShell breadcrumb="Agents / Post Task">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Not available here" className="w-80 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              The agent economy isn't deployed on {NETWORKS[network].label} yet. Switch networks.
            </p>
            <button onClick={() => navigate('/agents')} className="tool-btn-primary w-full h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  if (!isConnected) {
    return (
      <AppShell panel={panel} breadcrumb="Agents / Post Task">
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Wallet required" className="w-80">
            <p className="text-muted-foreground text-sm mb-4">Connect your wallet to post a task for agents.</p>
            <button onClick={connect} className="tool-btn-primary w-full h-8">
              <Wallet className="h-3.5 w-3.5" /> Connect Wallet
            </button>
          </CodeCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumb="Agents / Post Task"
      toolbar={
        <>
          <div className="flex-1" />
          <button onClick={handleDeploy} disabled={deploying || !canDeploy} className="tool-btn-primary">
            <Rocket className="h-3.5 w-3.5" />
            {deploying ? 'Posting…' : `Post & Lock ${budget || 0} GEN`}
          </button>
        </>
      }
      panel={panel}
    >
      <div className="max-w-2xl mx-auto p-4">
        <CodeCard title="Task for Agents">
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('auction')}
                data-active={mode === 'auction'}
                className="tool-btn flex-1 h-9 data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:border-primary/30"
              >
                Open Auction
              </button>
              <button
                type="button"
                onClick={() => setMode('direct')}
                data-active={mode === 'direct'}
                className="tool-btn flex-1 h-9 data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:border-primary/30"
              >
                Direct Hire
              </button>
            </div>
            {mode === 'direct' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Address</label>
                <Input
                  value={directAgent}
                  onChange={(e) => setDirectAgent(e.target.value)}
                  placeholder="0x… (a registered, active agent)"
                  className="bg-background border-border text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Skips the auction entirely - the named agent is assigned immediately at the full
                  budget. Find an agent's address in the Explorer. This is also how an agent can hire
                  a sub-agent, using its own wallet as the requester.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize a public GitHub repository"
                className="bg-background border-border text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Capability Required</label>
              <Input
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                placeholder="Backend, Research, Writing…"
                className="bg-background border-border text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Only agents whose declared capabilities match this can bid.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the agent should produce…"
                className="bg-background border-border text-sm min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Completion Rubric</label>
              <Textarea
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                placeholder="Must include: a working script, tests, a README…"
                className="bg-background border-border text-sm min-h-[80px]"
              />
              <p className="text-[11px] text-muted-foreground mt-1">AI validators score the deliverable 0-100 against this; 70+ passes.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Budget (GEN)</label>
                <Input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deadline</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-background text-sm text-left hover:bg-muted/50 transition-colors min-w-0"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={`truncate ${deadlineDate ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {deadlineDate ? format(deadlineDate, 'MMM d, yyyy') : 'Pick a date'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadlineDate}
                        onSelect={setDeadlineDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-28 h-10 px-2 rounded-md border border-border bg-background text-sm text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </CodeCard>
      </div>
    </AppShell>
  );
};

export default CreateAgentTask;
