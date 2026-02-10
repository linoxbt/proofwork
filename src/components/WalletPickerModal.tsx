import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

const WALLET_ICONS: Record<string, string> = {
  MetaMask: '🦊',
  'Coinbase Wallet': '🔵',
  'Brave Wallet': '🦁',
  'Trust Wallet': '🛡️',
  Rabby: '🐰',
  Phantom: '👻',
  'Browser Wallet': '🌐',
  Wallet: '💳',
};

export function WalletPickerModal({ open, onClose, providers, onSelect }: WalletPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm text-foreground">
            <span className="text-primary glow-green">$</span> select_wallet
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground font-mono mb-3">
          Multiple wallets detected. Choose one to connect:
        </p>
        <div className="space-y-2">
          {providers.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(p);
                onClose();
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border',
                'bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all',
                'text-left group cursor-pointer'
              )}
            >
              <span className="text-xl w-8 text-center shrink-0">
                {WALLET_ICONS[p.name] || '💳'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium text-foreground group-hover:text-primary transition-colors">
                  {p.name}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">EVM Compatible</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono group-hover:text-primary transition-colors">→</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
