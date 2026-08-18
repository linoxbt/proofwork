import { type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ToolbarProps {
  children?: ReactNode;
  breadcrumb?: string;
}

export function Toolbar({ children, breadcrumb }: ToolbarProps) {
  const navigate = useNavigate();

  if (!children && !breadcrumb) return null;

  return (
    <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-border bg-card">
      {breadcrumb && (
        <>
          <button
            onClick={() => navigate(-1)}
            className="tool-btn h-7 px-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-muted-foreground font-mono mr-2">{breadcrumb}</span>
          <div className="w-px h-4 bg-border mr-1" />
        </>
      )}
      {children}
    </div>
  );
}
