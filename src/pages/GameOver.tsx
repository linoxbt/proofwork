import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanlineOverlay } from '@/components/ScanlineOverlay';
import { TerminalCard } from '@/components/TerminalCard';
import { AsciiHeader } from '@/components/AsciiHeader';
import { type ContractGameState } from '@/lib/contract';

const GameOver = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as any;
  const gameState: ContractGameState | null = locState?.gameState ?? null;
  const contractAddress: string = locState?.contractAddress ?? '';
  const theme = gameState?.theme || locState?.theme || 'Unknown';

  const storyBeats = gameState?.story_beats ?? [];
  const totalVotes = storyBeats.reduce((sum, beat) => {
    return sum + Object.keys(beat.votes).length;
  }, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScanlineOverlay />

      <main className="flex-1 flex flex-col items-center p-4 md:p-8 max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 mt-8"
        >
          <AsciiHeader />
          <p className="text-secondary terminal-glow-amber text-lg mt-4 font-mono">
            ═══ ADVENTURE COMPLETE ═══
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full space-y-4"
        >
          <TerminalCard title="adventure_recap.log">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Theme: <span className="text-secondary terminal-glow-amber">{theme}</span></p>
              {contractAddress && (
                <p className="text-xs text-muted-foreground">
                  Contract: <span className="text-primary terminal-glow text-[10px]">{contractAddress}</span>
                </p>
              )}
              {storyBeats.map((beat, i) => (
                <div key={i} className="border-l-2 border-border pl-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Chapter {i + 1}</p>
                  <p className="text-sm text-foreground/80">{beat.text.slice(0, 120)}...</p>
                  {beat.chosen_index !== null && beat.chosen_index !== undefined && (
                    <p className="text-xs text-secondary terminal-glow-amber">
                      → {beat.choices[beat.chosen_index]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </TerminalCard>

          <TerminalCard title="stats.json">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl text-primary terminal-glow font-bold">{storyBeats.length}</p>
                <p className="text-xs text-muted-foreground">Chapters</p>
              </div>
              <div>
                <p className="text-2xl text-secondary terminal-glow-amber font-bold">{totalVotes}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </div>
              <div>
                <p className="text-2xl text-primary terminal-glow font-bold">{gameState?.players?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Players</p>
              </div>
            </div>
          </TerminalCard>

          <div className="flex gap-4 pt-4">
            <button onClick={() => navigate('/lobby')} className="terminal-button flex-1">
              ⚔ New Adventure
            </button>
            <button onClick={() => navigate('/')} className="terminal-button flex-1 border-muted-foreground text-muted-foreground hover:bg-muted hover:text-foreground">
              Home
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default GameOver;
