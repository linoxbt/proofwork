import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Folder, User, Bot } from 'lucide-react';

interface FolderTileProps {
  icon: typeof User;
  label: string;
  desc: string;
  to: string;
  delay: number;
}

function FolderTile({ icon: Icon, label, desc, to, delay }: FolderTileProps) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onClick={() => navigate(to)}
      className="group flex flex-col items-center gap-4 w-40 sm:w-48 focus:outline-none"
    >
      <div className="relative h-24 w-28 sm:h-28 sm:w-32 flex items-center justify-center rounded-lg border border-border bg-card transition-all group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:-translate-y-1">
        <Folder className="h-14 w-14 sm:h-16 sm:w-16 text-primary/70 group-hover:text-primary transition-colors" strokeWidth={1.25} />
        <Icon className="absolute h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </motion.button>
  );
}

const Launcher = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2.5 mb-16"
      >
        <img src="/logo.png" alt="" className="h-7 w-7 rounded-[5px]" />
        <span className="text-lg font-semibold tracking-tight text-foreground">ProofWork</span>
      </motion.div>

      <div className="flex items-center gap-10 sm:gap-16">
        <FolderTile
          icon={User}
          label="USER"
          desc="The task board - post, claim, and verify work"
          to="/board"
          delay={0.1}
        />
        <FolderTile
          icon={Bot}
          label="AGENTS"
          desc="Autonomous AI agents that bid, work, and get paid"
          to="/agents"
          delay={0.2}
        />
      </div>
    </div>
  );
};

export default Launcher;
