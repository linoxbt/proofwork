import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { Shield } from 'lucide-react';

export function Header() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, connect, disconnect, displayAddress } = useWallet();

  return (
    <header className="border-b border-border px-4 md:px-6 py-3 flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-mono font-semibold text-sm tracking-tight">
          <span className="text-primary glow-green">Task</span>
          <span className="text-foreground">Verify</span>
        </span>
      </button>

      <nav className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tasks')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          Tasks
        </button>
        <button
          onClick={() => navigate('/create')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          Create
        </button>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary font-mono glow-green">{displayAddress}</span>
            <button
              onClick={disconnect}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors font-mono"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="text-xs font-mono px-3 py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </nav>
    </header>
  );
}
