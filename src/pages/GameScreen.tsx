import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanlineOverlay } from '@/components/ScanlineOverlay';
import { TerminalCard } from '@/components/TerminalCard';
import { TypewriterText } from '@/components/TypewriterText';
import { useWallet } from '@/hooks/useWallet';
import { useRetroSFX } from '@/hooks/useRetroSFX';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  deployGameContract,
  joinGame,
  startGame,
  submitVote,
  getGameState,
  type ContractGameState,
  type ContractStoryBeat,
} from '@/lib/contract';
import { toast } from 'sonner';

// The Python contract code — in a real production app, this would be fetched or bundled
const CONTRACT_CODE_URL = '/contracts/chronicles_game_master.py';

const GameScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayAddress, client, address } = useWallet();
  const { playKeyClick, playVoteBlip, playConfirm, startCRTHum, stopCRTHum } = useRetroSFX();
  const isMobile = useIsMobile();

  const locState = location.state as any;
  const theme = locState?.theme || 'Dark Fantasy Dungeon';
  const shouldDeploy = locState?.deploy === true;
  const initialContractAddress = locState?.contractAddress || '';

  const [contractAddress, setContractAddress] = useState(initialContractAddress);
  const [gameState, setGameState] = useState<ContractGameState | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [voting, setVoting] = useState(false);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirmed'>('idle');
  const [crtOn, setCrtOn] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasDeployed = useRef(false);

  // Deploy contract on mount if needed
  useEffect(() => {
    if (!shouldDeploy || !client || hasDeployed.current || contractAddress) return;
    hasDeployed.current = true;

    const deploy = async () => {
      setDeploying(true);
      setError('');
      try {
        // Fetch contract code
        const resp = await fetch(CONTRACT_CODE_URL);
        if (!resp.ok) throw new Error('Failed to load contract code');
        const code = await resp.text();

        toast.info('Deploying contract to Asimov testnet...');
        const addr = await deployGameContract(client, code, theme, 4);
        setContractAddress(addr);
        toast.success(`Contract deployed: ${addr.slice(0, 10)}...`);

        // Auto-join and start
        await joinGame(client, addr);
        await startGame(client, addr);
        toast.success('Game started!');
      } catch (err: any) {
        setError(err.message || 'Deployment failed');
        toast.error(`Error: ${err.message}`);
      } finally {
        setDeploying(false);
      }
    };

    deploy();
  }, [shouldDeploy, client, theme, contractAddress]);

  // Poll game state
  useEffect(() => {
    if (!contractAddress || !client) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const state = await getGameState(client, contractAddress);
        if (!cancelled) {
          setGameState(state);
          if (state.finished) {
            navigate('/gameover', { state: { gameState: state, contractAddress, theme: state.theme } });
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [contractAddress, client, navigate]);

  // Reset vote state when beat changes
  useEffect(() => {
    if (gameState) {
      const currentBeat = gameState.story_beats[gameState.current_beat];
      const alreadyVoted = currentBeat?.votes?.[address];
      if (alreadyVoted !== undefined) {
        setMyVote(alreadyVoted);
      } else {
        setMyVote(null);
      }
      setTxStatus('idle');
      setVoting(false);
    }
  }, [gameState?.current_beat, address]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.current_beat, gameState?.story_beats?.length]);

  const toggleCRT = useCallback(() => {
    if (crtOn) { stopCRTHum(); setCrtOn(false); }
    else { startCRTHum(); setCrtOn(true); }
  }, [crtOn, startCRTHum, stopCRTHum]);

  const handleVote = async (choiceIndex: number) => {
    if (myVote !== null || voting || !client || !contractAddress) return;
    playVoteBlip();
    setMyVote(choiceIndex);
    setVoting(true);
    setTxStatus('pending');

    try {
      await submitVote(client, contractAddress, choiceIndex);
      playConfirm();
      setTxStatus('confirmed');
      toast.success('Vote submitted on-chain!');
    } catch (err: any) {
      toast.error(`Vote failed: ${err.message}`);
      setMyVote(null);
      setTxStatus('idle');
    } finally {
      setVoting(false);
    }
  };

  const storyBeats = gameState?.story_beats ?? [];
  const currentBeatIndex = gameState?.current_beat ?? 0;
  const players = gameState?.players ?? [];

  // Loading / deploying state
  if (deploying || (!contractAddress && shouldDeploy)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <ScanlineOverlay />
        <TerminalCard title="deploying_contract.sh">
          <div className="space-y-2 text-sm">
            <p className="text-primary terminal-glow animate-pulse">⏳ Deploying Intelligent Contract...</p>
            <p className="text-muted-foreground">Theme: <span className="text-secondary terminal-glow-amber">{theme}</span></p>
            <p className="text-muted-foreground text-xs">This may take a minute. AI validators are reaching consensus.</p>
            {error && <p className="text-destructive">{error}</p>}
          </div>
        </TerminalCard>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ScanlineOverlay />
        <TerminalCard title="error">
          <p className="text-destructive text-sm">No contract address. Go back to lobby.</p>
          <button onClick={() => navigate('/lobby')} className="terminal-button mt-4">{'<'} Lobby</button>
        </TerminalCard>
      </div>
    );
  }

  if (storyBeats.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ScanlineOverlay />
        <TerminalCard title="loading">
          <p className="text-primary terminal-glow animate-pulse text-sm">Loading story from chain...</p>
        </TerminalCard>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <TerminalCard title="party.log">
        <div className="space-y-2">
          {players.map((addr, i) => {
            const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className={addr.toLowerCase() === address.toLowerCase() ? 'text-secondary terminal-glow-amber' : 'text-foreground'}>
                  {short}
                </span>
              </div>
            );
          })}
        </div>
      </TerminalCard>
      <div className="mt-4">
        <TerminalCard title="status">
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">Chapter: <span className="text-foreground">{currentBeatIndex + 1}/{storyBeats.length}</span></p>
            <p className="text-muted-foreground">Theme: <span className="text-secondary terminal-glow-amber">{gameState?.theme}</span></p>
            <p className="text-muted-foreground">Contract: <span className="text-primary terminal-glow text-[10px]">{contractAddress.slice(0, 10)}...</span></p>
          </div>
        </TerminalCard>
      </div>
      <div className="mt-4">
        <button
          onClick={toggleCRT}
          className={`w-full text-left px-3 py-2 border rounded-sm text-xs transition-all ${
            crtOn ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
          }`}
        >
          {crtOn ? '♫ CRT Hum: ON' : '♫ CRT Hum: OFF'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScanlineOverlay />

      <header className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-primary text-xs transition-colors">
            {'<'} lobby
          </button>
          <span className="text-xs text-secondary terminal-glow-amber truncate max-w-[120px] sm:max-w-none">{gameState?.theme}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {txStatus !== 'idle' && (
            <Badge className={`text-[10px] sm:text-xs ${txStatus === 'pending' ? 'bg-secondary/20 text-secondary border-secondary/40 animate-pulse' : 'bg-primary/20 text-primary border-primary/40'}`}>
              {txStatus === 'pending' ? '⏳ TX PENDING' : '✓ CONFIRMED'}
            </Badge>
          )}
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <button className="text-xs text-primary border border-border px-2 py-1 rounded-sm">☰</button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background border-border w-64">
                <SheetHeader>
                  <SheetTitle className="text-primary text-sm terminal-glow">Party Info</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <SidebarContent />
                </div>
              </SheetContent>
            </Sheet>
          )}
          <span className="text-xs text-primary terminal-glow hidden sm:inline">{displayAddress}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-3 sm:p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
              {storyBeats.map((beat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i === storyBeats.length - 1 ? 0.3 : 0 }}
                >
                  <TerminalCard title={`chapter_${i + 1}.log`}>
                    <div className="space-y-4">
                      <div className="text-sm leading-relaxed">
                        {i === currentBeatIndex && !beat.resolved ? (
                          <TypewriterText text={beat.text} speed={20} onChar={playKeyClick} />
                        ) : (
                          <span className={i < currentBeatIndex ? 'text-muted-foreground' : ''}>{beat.text}</span>
                        )}
                      </div>

                      {/* Voting area for current unresolved beat */}
                      {i === currentBeatIndex && !beat.resolved && (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs text-muted-foreground">{'>'} Choose your path:</p>
                          {beat.choices.map((choice, ci) => {
                            const voteCount = Object.values(beat.votes).filter(v => v === ci).length;
                            const isMyVote = myVote === ci;
                            return (
                              <button
                                key={ci}
                                onClick={() => handleVote(ci)}
                                disabled={myVote !== null && !isMyVote}
                                className={`w-full text-left px-3 py-3 sm:py-2 border rounded-sm text-sm transition-all flex items-center justify-between active:scale-[0.98] ${
                                  isMyVote
                                    ? 'border-primary text-primary terminal-glow'
                                    : myVote !== null
                                    ? 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
                                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                }`}
                              >
                                <span>[{ci + 1}] {choice}</span>
                                {voteCount > 0 && (
                                  <span className="text-xs text-primary ml-2 shrink-0">{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                                )}
                              </button>
                            );
                          })}
                          {myVote !== null && (
                            <p className="text-xs text-muted-foreground animate-pulse">
                              Waiting for other players to vote... ({Object.keys(beat.votes).length}/{players.length})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Resolved beat */}
                      {beat.resolved && beat.chosen_index !== null && (
                        <p className="text-xs text-secondary terminal-glow-amber">
                          ✓ Party chose: {beat.choices[beat.chosen_index]}
                        </p>
                      )}
                    </div>
                  </TerminalCard>
                </motion.div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        {!isMobile && (
          <aside className="w-56 border-l border-border flex-col p-4 shrink-0 hidden md:flex">
            <SidebarContent />
          </aside>
        )}
      </div>
    </div>
  );
};

export default GameScreen;
