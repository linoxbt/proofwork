import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AsciiHeader } from '@/components/AsciiHeader';
import { TerminalCard } from '@/components/TerminalCard';
import { ScanlineOverlay } from '@/components/ScanlineOverlay';
import { useWallet } from '@/hooks/useWallet';

const Index = () => {
  const { isConnected, isConnecting, connect, displayAddress, disconnect } = useWallet();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScanlineOverlay />

      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          GenLayer Chronicles v0.1 — Asimov Testnet
        </span>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary terminal-glow">{displayAddress}</span>
            <button onClick={disconnect} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              [disconnect]
            </button>
          </div>
        ) : (
          <button onClick={connect} disabled={isConnecting} className="terminal-button text-xs py-1 px-3">
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <AsciiHeader />
          <p className="mt-4 text-muted-foreground text-sm max-w-lg mx-auto">
            A multiplayer on-chain adventure where an AI Game Master narrates your story.
            Vote with your party. Shape the narrative. All on GenLayer.
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <button onClick={connect} disabled={isConnecting} className="terminal-button">
              {isConnecting ? '> Connecting...' : '> Connect Wallet'}
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-4">
            <button onClick={() => navigate('/lobby')} className="terminal-button">
              {'>'} Enter Lobby
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          <TerminalCard title="how_it_works.md">
            <div className="space-y-2 text-sm">
              <p><span className="text-secondary terminal-glow-amber">1.</span> <span className="text-muted-foreground">Connect your wallet — a local GenLayer keypair is created for you</span></p>
              <p><span className="text-secondary terminal-glow-amber">2.</span> <span className="text-muted-foreground">Create or join a session — deploys an Intelligent Contract on Asimov</span></p>
              <p><span className="text-secondary terminal-glow-amber">3.</span> <span className="text-muted-foreground">The AI Game Master narrates a branching story via on-chain consensus</span></p>
              <p><span className="text-secondary terminal-glow-amber">4.</span> <span className="text-muted-foreground">Vote on choices with your party — majority wins</span></p>
              <p><span className="text-secondary terminal-glow-amber">5.</span> <span className="text-muted-foreground">Your adventure is forever recorded on GenLayer</span></p>
            </div>
          </TerminalCard>
        </motion.div>
      </main>

      <footer className="border-t border-border px-4 py-3 text-center">
        <span className="text-xs text-muted-foreground">
          GenLayer Chronicles — Powered by Intelligent Contracts
        </span>
      </footer>
    </div>
  );
};

export default Index;
