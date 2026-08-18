import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudioPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="w-[280px] shrink-0 border-l border-border bg-card overflow-y-auto hidden lg:block">
      {children}
    </aside>
  );
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button onClick={() => setOpen((v) => !v)} className="panel-section-header">
        {title}
        <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function PanelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right truncate max-w-[160px]">{value}</span>
    </div>
  );
}
