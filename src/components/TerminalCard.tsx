import { cn } from '@/lib/utils';

interface TerminalCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function TerminalCard({ title, children, className }: TerminalCardProps) {
  return (
    <div className={cn('terminal-card', className)}>
      {title && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="h-2 w-2 rounded-full bg-secondary" />
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="ml-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
