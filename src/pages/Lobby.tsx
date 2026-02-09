import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanlineOverlay } from '@/components/ScanlineOverlay';
import { TerminalCard } from '@/components/TerminalCard';
import { useWallet } from '@/hooks/useWallet';
import { Input } from '@/components/ui/input';
import { joinGame, getGameState, type ContractGameState } from '@/lib/contract';
import { toast } from 'sonner';

const THEMES = ['Dark Fantasy Dungeon', 'Cyberpunk Heist', 'Space Exploration', 'Post-Apocalyptic Survival', 'Pirate Adventure'];

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, connect, disconnect, displayAddress, client, address } = useWallet();
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [contractAddress, setContractAddress] = useState('');
  const [joining, setJoining] = useState(false);
  const [lobbyContractAddress, setLobbyContractAddress] = useState('');
  const [gameState, setGameState] = useState<ContractGameState | null>(null);
  const [polling, setPolling] = useState(false);

  // Poll game state when we have a lobby contract
  useEffect(() => {
    if (!lobbyContractAddress || !client) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const state = await getGameState(client, lobbyContractAddress);
        if (!cancelled) {
          setGameState(state);
          if (state.started) {
            navigate('/game', { state: { contractAddress: lobbyContractAddress, theme: state.theme } });
          }
        }
      } catch (err) {
        console.error('Failed to poll game state:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [lobbyContractAddress, client, navigate]);

  const handleJoinByAddress = useCallback(async () => {
    if (!client || !contractAddress) return;
    setJoining(true);
    try {
      await joinGame(client, contractAddress);
      setLobbyContractAddress(contractAddress);
      toast.success('Joined session!');
    } catch (err: any) {
      toast.error(`Failed to join: ${err.message || 'Unknown error'}`);
    } finally {
      setJoining(false);
    }
  }, [client, contractAddress]);

  const handleCreateAndNavigate = useCallback(() => {
    // Navigate to game which will handle contract deployment
    navigate('/game', { state: { theme: selectedTheme, deploy: true } });
  }, [navigate, selectedTheme]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ScanlineOverlay />
        <TerminalCard title="access_denied">
          <p className="text-muted-foreground text-sm mb-4">Wallet connection required to enter the lobby.</p>
          <button onClick={connect} className="terminal-button">{'>'} Connect Wallet</button>
        </TerminalCard>
      </div>
    );
  }

  const players = gameState?.players ?? [address];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScanlineOverlay />

      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-primary text-xs transition-colors">
            {'<'} back
          </button>
          <span className="text-xs text-muted-foreground font-mono">Chronicles Lobby</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-primary terminal-glow">{displayAddress}</span>
          <button onClick={disconnect} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
            [disconnect]
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
          {/* Create new */}
          <TerminalCard title="create_session.sh">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select a theme for your adventure:</p>
              <div className="space-y-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`w-full text-left px-3 py-2 border rounded-sm text-sm transition-all ${
                      selectedTheme === theme
                        ? 'border-primary text-primary terminal-glow'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {'>'} {theme}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateAndNavigate}
                className="terminal-button w-full"
              >
                Deploy & Start Session
              </button>
            </div>
          </TerminalCard>

          {/* Join existing */}
          <TerminalCard title="join_session.sh">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Join by contract address:</p>
              <Input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="bg-background border-border text-foreground font-mono text-sm"
              />
              <button
                onClick={handleJoinByAddress}
                className="terminal-button w-full"
                disabled={!contractAddress || joining}
              >
                {joining ? '⏳ Joining...' : 'Join Session'}
              </button>
            </div>
          </TerminalCard>
        </motion.div>

        {/* Players in lobby */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <TerminalCard title="lobby_players.log">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {lobbyContractAddress
                  ? `Connected players (${players.length}/${gameState?.max_players ?? 4}):`
                  : 'Select or join a session to see players'}
              </p>
              {players.map((addr, i) => {
                const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className={addr.toLowerCase() === address.toLowerCase() ? 'text-secondary terminal-glow-amber' : 'text-foreground'}>
                      {short}
                      {addr.toLowerCase() === address.toLowerCase() && ' (you)'}
                    </span>
                  </div>
                );
              })}
              {lobbyContractAddress && (
                <div className="pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Contract: <span className="text-primary terminal-glow text-[10px]">{lobbyContractAddress}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Waiting for host to start...</p>
                </div>
              )}
            </div>
          </TerminalCard>
        </motion.div>
      </main>
    </div>
  );
};

export default Lobby;
