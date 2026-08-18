import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { CodeCard } from '@/components/CodeCard';
import { useWallet } from '@/hooks/useWallet';
import { deployTaskContract } from '@/lib/contract';
import { registerTask } from '@/lib/taskRegistry';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
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
      toast.info('Deploying contract to Asimov testnet...');
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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <CodeCard title="access_denied">
            <p className="text-muted-foreground text-sm mb-4">Connect your wallet to create a task.</p>
            <button onClick={connect} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm">
              Connect Wallet
            </button>
          </CodeCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-mono text-xl font-bold mb-6 text-foreground">
            <span className="text-primary glow-green">$</span> create_task
          </h1>

          <CodeCard title="task_config.json">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Build a REST API with authentication"
                  className="bg-background border-border font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what needs to be built..."
                  className="bg-background border-border font-mono text-sm min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Verification Criteria</label>
                <Textarea
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  placeholder="Must include: JWT auth, password hashing, 3+ endpoints, tests..."
                  className="bg-background border-border font-mono text-sm min-h-[80px]"
                />
                <p className="text-[10px] text-muted-foreground mt-1">AI validators will check submissions against these criteria.</p>
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Reward (GEN)</label>
                <Input
                  type="number"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="bg-background border-border font-mono text-sm w-32"
                />
              </div>
              <button
                onClick={handleDeploy}
                disabled={deploying || !title || !description || !criteria}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deploying ? '⏳ Deploying to Asimov...' : 'Deploy Task Contract'}
              </button>
            </div>
          </CodeCard>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateTask;
