import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Wallet, ExternalLink, Loader2 } from 'lucide-react';

interface DetectedProvider {
  name: string;
  provider: any;
}

interface WalletPickerModalProps {
  open: boolean;
  onClose: () => void;
  providers: DetectedProvider[];
  onSelect: (provider: DetectedProvider) => void;
}

const WALLET_META: Record<string, { icon: string; color: string }> = {
  MetaMask: { icon: '🦊', color: 'hover:border-orange-500/40' },
  'Coinbase Wallet': { icon: '🔵', color: 'hover:border-blue-500/40' },
  'Brave Wallet': { icon: '🦁', color: 'hover:border-orange-400/40' },
  'Trust Wallet': { icon: '🛡️', color: 'hover:border-blue-400/40' },
  Rabby: { icon: '🐰', color: 'hover:border-purple-500/40' },
  Phantom: { icon: '👻', color: 'hover:border-purple-400/40' },
  'Browser Wallet': { icon: '🌐', color: 'hover:border-primary/30' },
};

export function WalletPickerModal({ open, onClose, providers, onSelect }: WalletPickerModalProps) {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleSelect = (p: DetectedProvider) => {
    setConnecting(p.name);
    onSelect(p);
  };

  const handleClose = () => {
    setConnecting(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[360px] bg-card border-border p-0 gap-0 overflow-hidden">
        <div className="p-5 pb-3">
          <DialogHeader>
            <DialogTitle className="font-mono text-base text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Connect Wallet
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-2">
            Choose a wallet to connect to ProofWork
          </p>
        </div>

        <div className="px-3 pb-3 space-y-1.5">
          {providers.length > 0 ? (
            providers.map((p, i) => {
              const meta = WALLET_META[p.name] || { icon: '💳', color: 'hover:border-primary/30' };
              const isConnecting = connecting === p.name;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(p)}
                  disabled={!!connecting}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border',
                    'bg-background hover:bg-muted/40 transition-all duration-150',
                    'text-left group cursor-pointer disabled:opacity-50 disabled:cursor-wait',
                    meta.color
                  )}
                >
                  <span className="text-2xl w-9 text-center shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">Detected</p>
                  </div>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">→</span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">No wallet detected</p>
              <p className="text-xs text-muted-foreground leading-relaxed px-4">
                Install a browser wallet extension like MetaMask, Coinbase Wallet, or Rabby to get started.
              </p>
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                Browse wallets <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            By connecting, you agree to the Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
