import { cn } from '@/lib/utils';
import { GitBranch } from 'lucide-react';

interface CodeCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'blue';
}

export function CodeCard({ title, children, className, variant = 'default' }: CodeCardProps) {
  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      variant === 'blue' ? 'card-glow-blue' : 'card-glow',
      className
    )}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono tracking-wide">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
