import { cn } from '@/lib/utils';

interface CodeCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'blue';
}

export function CodeCard({ title, children, className, variant = 'default' }: CodeCardProps) {
  return (
    <div className={cn('rounded border border-border bg-card overflow-hidden', className)}>
      <div
        className={cn(
          'flex items-center gap-2 border-b border-border px-3 h-8',
          variant === 'blue' ? 'bg-secondary/[0.06]' : 'bg-muted/40'
        )}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
