import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, X } from 'lucide-react';

export function TitleBar() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, connect, disconnect, displayAddress, providerName } = useWallet();

  return (
    <header className="h-11 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-3 border-b border-border bg-muted select-none">
      <button
        onClick={() => navigate('/board')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 shrink-0"
      >
        <img src="/logo.png" alt="" className="h-5 w-5 rounded-[3px] shrink-0" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap">ProofWork</span>
        <span className="hidden sm:inline text-[10px] text-muted-foreground border border-border rounded-[3px] px-1.5 py-0.5 ml-1 whitespace-nowrap">
          Asimov Testnet
        </span>
      </button>

      {isConnected ? (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-[4px] bg-background border border-border min-w-0">
            <span className="status-dot bg-success shrink-0" />
            <span className="hidden md:inline text-[11px] text-muted-foreground whitespace-nowrap">{providerName}</span>
            <span className="text-[11px] font-mono text-foreground whitespace-nowrap">{displayAddress}</span>
          </div>
          <button
            onClick={disconnect}
            title="Disconnect wallet"
            className="tool-btn h-7 w-7 px-0 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={isConnecting} className="tool-btn-primary shrink-0 whitespace-nowrap">
          <Wallet className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">{isConnecting ? 'Connecting…' : 'Connect Wallet'}</span>
          <span className="xs:hidden">{isConnecting ? '…' : 'Connect'}</span>
        </button>
      )}
    </header>
  );
}
