import { useWallet } from '@/hooks/useWallet';

export function StatusBar() {
  const { isConnected } = useWallet();

  return (
    <footer className="h-6 shrink-0 flex items-center justify-between px-3 border-t border-border bg-muted text-[10.5px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className={`status-dot ${isConnected ? 'bg-success' : 'bg-muted-foreground/50'}`} />
        {isConnected ? 'Connected' : 'Not connected'}
      </div>
      <div className="flex items-center gap-3">
        <span>GenLayer · Asimov Testnet</span>
        <a
          href="https://genlayer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          genlayer.com
        </a>
      </div>
    </footer>
  );
}
