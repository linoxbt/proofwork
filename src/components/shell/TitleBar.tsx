import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, X } from 'lucide-react';

export function TitleBar() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, connect, disconnect, displayAddress, providerName } = useWallet();

  return (
    <header className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-border bg-muted select-none">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <img src="/logo.png" alt="" className="h-5 w-5 rounded-[3px]" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground">ProofWork</span>
        <span className="text-[10px] text-muted-foreground border border-border rounded-[3px] px-1.5 py-0.5 ml-1">
          Asimov Testnet
        </span>
      </button>

      {isConnected ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-background border border-border">
            <span className="status-dot bg-success" />
            <span className="text-[11px] text-muted-foreground">{providerName}</span>
            <span className="text-[11px] font-mono text-foreground">{displayAddress}</span>
          </div>
          <button
            onClick={disconnect}
            title="Disconnect wallet"
            className="tool-btn h-7 w-7 px-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={isConnecting} className="tool-btn-primary">
          <Wallet className="h-3.5 w-3.5" />
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}
    </header>
  );
}
