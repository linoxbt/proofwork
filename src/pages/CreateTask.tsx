import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { PanelSection, PanelRow } from '@/components/shell/StudioPanel';
import { CodeCard } from '@/components/CodeCard';
import { useWallet } from '@/hooks/useWallet';
import { deployTaskContract } from '@/lib/contract';
import { registerTask } from '@/lib/taskRegistry';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Rocket, Wallet, CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';
import taskVerifierCode from '../../contracts/task_verifier.py?raw';

const CATEGORIES = ['Backend', 'Frontend', 'Smart Contract', 'Design', 'Data / ML', 'DevOps', 'Other'];

const CreateTask = () => {
  const navigate = useNavigate();
  const { isConnected, connect, client } = useWallet();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [reward, setReward] = useState('100');
  const [deadline, setDeadline] = useState<Date | undefined>(addDays(new Date(), 7));
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = useCallback(async () => {
    if (!client || !title || !category || !description || !criteria || !deadline) {
      toast.error('Please fill in all fields');
      return;
    }
    if (deadline.getTime() <= Date.now()) {
      toast.error('Deadline must be in the future');
      return;
    }
    setDeploying(true);
    try {
      toast.info('Deploying contract to Asimov testnet…');
      const deadlineUnixSeconds = Math.floor(deadline.getTime() / 1000);
      const addr = await deployTaskContract(
        client,
        taskVerifierCode,
        title,
        category,
        description,
        criteria,
        parseInt(reward) || 100,
        deadlineUnixSeconds
      );
      registerTask(addr);
      toast.success('Task deployed on-chain!');
      navigate(`/task/${addr}`);
    } catch (err: any) {
      toast.error(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [client, title, category, description, criteria, reward, deadline, navigate]);

  const panel = (
    <>
      <PanelSection title="Preview">
        <PanelRow label="Title" value={title || '—'} />
        <PanelRow label="Category" value={category || '—'} />
        <PanelRow label="Reward" value={`${reward || 0} GEN`} />
        <PanelRow label="Deadline" value={deadline ? format(deadline, 'MMM d, yyyy') : '—'} />
      </PanelSection>
      <PanelSection title="Contract" defaultOpen={false}>
        <PanelRow label="Type" value="TaskVerifier" />
        <PanelRow label="Runtime" value="GenVM (Python)" />
        <PanelRow label="Network" value="Asimov Testnet" />
        <p className="text-xs text-muted-foreground leading-relaxed mt-2">
          Deploying creates a new Intelligent Contract instance holding this task's state — criteria,
          deadline, claim status, and the AI verification result once requested.
        </p>
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
            disabled={deploying || !title || !category || !description || !criteria || !deadline}
            className="tool-btn-primary"
          >
            <Rocket className="h-3.5 w-3.5" />
            {deploying ? 'Deploying…' : 'Deploy Task'}
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
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deadline</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-background text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={deadline ? 'text-foreground' : 'text-muted-foreground'}>
                        {deadline ? format(deadline, 'PPP') : 'Pick a date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={setDeadline}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reward (GEN)</label>
              <Input
                type="number"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="bg-background border-border text-sm w-32"
              />
            </div>
          </div>
        </CodeCard>
      </div>
    </AppShell>
  );
};

export default CreateTask;
