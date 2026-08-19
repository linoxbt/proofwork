import { type LucideIcon } from 'lucide-react';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: 'primary' | 'secondary' | 'success' | 'accent' | 'muted';
}

const ACCENT_CLASSES: Record<NonNullable<StatTileProps['accent']>, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-success',
  accent: 'text-accent',
  muted: 'text-muted-foreground',
};

export function StatTile({ icon: Icon, label, value, accent = 'muted' }: StatTileProps) {
  return (
    <div className="rounded border border-border bg-card p-3 flex items-center gap-3">
      <div className={`h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0 ${ACCENT_CLASSES[accent]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}
