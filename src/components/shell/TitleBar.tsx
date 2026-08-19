import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { Wallet, X, ChevronDown, Check } from 'lucide-react';

function NetworkSwitcher() {
  const { network, switchNetwork } = useWallet();
  const [open, setOpen] = useState(false);
  const current = NETWORKS[network];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 h-7 px-2 rounded-[4px] border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors whitespace-nowrap"
      >
        <span className={`status-dot ${current.gasless ? 'bg-secondary' : 'bg-primary'}`} />
        {current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 rounded-[6px] border border-border bg-popover shadow-lg overflow-hidden">
            {(Object.keys(NETWORKS) as NetworkId[]).map((id) => (
              <button
                key={id}
                onClick={() => { switchNetwork(id); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-muted/60 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`status-dot ${NETWORKS[id].gasless ? 'bg-secondary' : 'bg-primary'}`} />
                  {NETWORKS[id].label}
                </span>
                {network === id && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TitleBar() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, connect, disconnect, displayAddress } = useWallet();

  return (
    <header className="h-11 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-3 border-b border-border bg-muted select-none">
      <button
        onClick={() => navigate('/board')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 shrink-0"
      >
        <img src="/logo.png" alt="" className="h-5 w-5 rounded-[3px] shrink-0" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap">ProofWork</span>
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <NetworkSwitcher />

        {isConnected ? (
          <>
            <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-background border border-border">
              <span className="status-dot bg-success" />
              <span className="text-[11px] font-mono text-foreground whitespace-nowrap">{displayAddress}</span>
            </div>
            <button
              onClick={disconnect}
              title="Disconnect wallet"
              className="tool-btn h-7 w-7 px-0 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button onClick={connect} disabled={isConnecting} className="tool-btn-primary shrink-0 whitespace-nowrap">
            <Wallet className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">{isConnecting ? 'Connecting…' : 'Connect Wallet'}</span>
            <span className="xs:hidden">{isConnecting ? '…' : 'Connect'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
