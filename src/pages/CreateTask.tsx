import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { useWallet } from '@/hooks/useWallet';
import { createTaskViaFactory } from '@/lib/contract';
import { NETWORKS } from '@/lib/networks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Rocket, Wallet, CalendarIcon, Lock } from 'lucide-react';
import { format, addDays } from 'date-fns';

const CATEGORIES = ['Backend', 'Frontend', 'Smart Contract', 'Design', 'Data / ML', 'DevOps', 'Other'];
const SUBMISSION_FORMATS = ['GitHub Repository', 'Live URL / Deployed App', 'Video Demo', 'Document / PDF', 'Design File', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const EFFORTS = ['< 1 hour', '1-4 hours', '1 day', 'Multi-day'];

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours || 0, minutes || 0, 0, 0);
  return combined;
}

const CreateTask = () => {
  const navigate = useNavigate();
  const { isConnected, connect, client, network } = useWallet();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [submissionFormat, setSubmissionFormat] = useState('');
  const [submissionFormatOther, setSubmissionFormatOther] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [estimatedEffort, setEstimatedEffort] = useState('1-4 hours');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [reward, setReward] = useState('100');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(addDays(new Date(), 7));
  const [deadlineTime, setDeadlineTime] = useState('17:00');
  const [deploying, setDeploying] = useState(false);

  const deadline = deadlineDate ? combineDateAndTime(deadlineDate, deadlineTime) : undefined;
  const categoryValid = category && (category !== 'Other' || categoryOther.trim());
  const formatValid = submissionFormat && (submissionFormat !== 'Other' || submissionFormatOther.trim());
  const canDeploy = title && categoryValid && formatValid && description && criteria && deadline;

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
    const rewardAmount = parseInt(reward) || 0;
    if (rewardAmount <= 0) {
      toast.error('Reward must be greater than 0');
      return;
    }
    setDeploying(true);
    try {
      toast.info(`Deploying task and locking ${rewardAmount} GEN in escrow…`);
      const addr = await createTaskViaFactory(client, network, {
        title,
        category,
        categoryOther: category === 'Other' ? categoryOther : '',
        priority,
        estimatedEffort,
        description,
        criteria,
        submissionFormat,
        submissionFormatOther: submissionFormat === 'Other' ? submissionFormatOther : '',
        rewardAmount,
        deadlineUnixSeconds: Math.floor(deadline.getTime() / 1000),
      });
      toast.success('Task deployed and escrow funded!');
      navigate(`/task/${addr}`);
    } catch (err: any) {
      toast.error(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [client, canDeploy, deadline, reward, network, title, category, categoryOther, priority, estimatedEffort, description, criteria, submissionFormat, submissionFormatOther, navigate]);

  const panel = (
    <>
      <PanelSection title="Preview">
        <PanelRow label="Title" value={title || '-'} />
        <PanelRow label="Category" value={category === 'Other' ? (categoryOther || '-') : (category || '-')} />
        <PanelRow label="Reward" value={`${reward || 0} GEN`} />
        <PanelRow label="Deadline" value={deadline ? format(deadline, 'MMM d, yyyy p') : '-'} />
        <PanelRow label="Priority" value={priority} />
      </PanelSection>
      <PanelSection title="Escrow" defaultOpen>
        <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <Lock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p>
            {reward || 0} GEN will be locked in the TaskFactory contract on deploy. It releases to the
            worker automatically 24h after verification, if nobody disputes - or refunds you if the
            work is rejected.
          </p>
        </div>
      </PanelSection>
      <PanelSection title="Contract" defaultOpen={false}>
        <PanelRow label="Factory" value={`${NETWORKS[network].factoryAddress.slice(0, 6)}…${NETWORKS[network].factoryAddress.slice(-4)}`} />
        <PanelRow label="Network" value={NETWORKS[network].label} />
      </PanelSection>
    </>
  );

  if (!isConnected) {
    return (
      <AppShell panel={panel}>
        <div className="flex-1 flex items-center justify-center h-full">
          <CodeCard title="Wallet required" className="w-80">
            <p className="text-muted-foreground text-sm mb-4">Connect your wallet to create a task.</p>
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
      breadcrumb="Board / Create Task"
      toolbar={
        <>
          <div className="flex-1" />
          <button
            onClick={handleDeploy}
            disabled={deploying || !canDeploy}
            className="tool-btn-primary"
          >
            <Rocket className="h-3.5 w-3.5" />
            {deploying ? 'Deploying…' : `Deploy & Lock ${reward || 0} GEN`}
          </button>
        </>
      }
      panel={panel}
    >
      <div className="max-w-2xl mx-auto p-4">
        <CodeCard title="Task Configuration">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Build a REST API with authentication"
                className="bg-background border-border text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background border-border text-sm h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {category === 'Other' && (
                  <Input
                    value={categoryOther}
                    onChange={(e) => setCategoryOther(e.target.value)}
                    placeholder="Describe the category"
                    className="bg-background border-border text-sm mt-2"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Evidence Format</label>
                <Select value={submissionFormat} onValueChange={setSubmissionFormat}>
                  <SelectTrigger className="bg-background border-border text-sm h-10">
                    <SelectValue placeholder="How should work be submitted?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {submissionFormat === 'Other' && (
                  <Input
                    value={submissionFormatOther}
                    onChange={(e) => setSubmissionFormatOther(e.target.value)}
                    placeholder="Describe the expected format"
                    className="bg-background border-border text-sm mt-2"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-background border-border text-sm h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estimated Effort</label>
                <Select value={estimatedEffort} onValueChange={setEstimatedEffort}>
                  <SelectTrigger className="bg-background border-border text-sm h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFORTS.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs to be built..."
                className="bg-background border-border text-sm min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Verification Criteria</label>
              <Textarea
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                placeholder="Must include: JWT auth, password hashing, 3+ endpoints, tests..."
                className="bg-background border-border text-sm min-h-[80px]"
              />
              <p className="text-[11px] text-muted-foreground mt-1">AI validators will check submissions against these criteria.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reward (GEN)</label>
                <Input
                  type="number"
                  min="1"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="bg-background border-border text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Locked in escrow on deploy.</p>
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

export default CreateTask;
