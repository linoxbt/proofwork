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
import { toast } from 'sonner';
import { Rocket, Wallet } from 'lucide-react';
import taskVerifierCode from '../../contracts/task_verifier.py?raw';

const CreateTask = () => {
  const navigate = useNavigate();
  const { isConnected, connect, client } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [reward, setReward] = useState('100');
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = useCallback(async () => {
    if (!client || !title || !description || !criteria) {
      toast.error('Please fill in all fields');
      return;
    }
    setDeploying(true);
    try {
      toast.info('Deploying contract to Asimov testnet…');
      const addr = await deployTaskContract(client, taskVerifierCode, title, description, criteria, parseInt(reward) || 100);
      registerTask(addr);
      toast.success('Task deployed on-chain!');
      navigate(`/task/${addr}`);
    } catch (err: any) {
      toast.error(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [client, title, description, criteria, reward, navigate]);

  const panel = (
    <>
      <PanelSection title="Preview">
        <PanelRow label="Title" value={title || '—'} />
        <PanelRow label="Reward" value={`${reward || 0} GEN`} />
        <PanelRow label="Status" value="open" />
      </PanelSection>
      <PanelSection title="Contract" defaultOpen={false}>
        <PanelRow label="Type" value="TaskVerifier" />
        <PanelRow label="Runtime" value="GenVM (Python)" />
        <PanelRow label="Network" value="Asimov Testnet" />
        <p className="text-xs text-muted-foreground leading-relaxed mt-2">
          Deploying creates a new Intelligent Contract instance holding this task's state — criteria,
          claim status, and the AI verification result once submitted.
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
            disabled={deploying || !title || !description || !criteria}
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
