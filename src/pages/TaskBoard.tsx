import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';
import { useTasks } from '@/hooks/useTasks';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search } from 'lucide-react';

const TaskBoard = () => {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters = ['all', 'open', 'claimed', 'verified', 'rejected'];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-8 max-w-4xl mx-auto w-full">
        <h1 className="font-mono text-xl font-bold mb-6 text-foreground">
          <span className="text-primary glow-green">$</span> task_board
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 bg-background border-border font-mono text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                  filter === f
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm font-mono">
              Loading tasks from chain...
            </div>
          )}

          {!loading &&
            filtered.map((task, i) => (
              <motion.div
                key={task.contractAddress}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/task/${task.contractAddress}`)}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-mono text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {task.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        by {task.creator}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={task.status} />
                    <span className="text-xs font-mono text-accent font-medium">{task.reward_amount} GEN</span>
                  </div>
                </div>
              </motion.div>
            ))}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm font-mono">
              {tasks.length === 0 ? (
                <>No tasks yet — <button onClick={() => navigate('/create')} className="text-primary hover:underline">create one</button>.</>
              ) : (
                'No tasks found.'
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TaskBoard;
