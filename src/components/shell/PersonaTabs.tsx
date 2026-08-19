import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, PlusSquare, BookOpen, LayoutDashboard } from 'lucide-react';

const PERSONAS = [
  { path: '/board', label: 'Board', icon: LayoutGrid },
  { path: '/create', label: 'Create', icon: PlusSquare },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/about', label: 'About', icon: BookOpen },
];

export function PersonaTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="h-9 shrink-0 flex items-stretch border-b border-border bg-card px-1 overflow-x-auto">
      {PERSONAS.map((p) => {
        const active = location.pathname === p.path;
        return (
          <button
            key={p.path}
            data-active={active}
            onClick={() => navigate(p.path)}
            className="persona-tab"
          >
            <p.icon className="h-3.5 w-3.5" />
            {p.label}
          </button>
        );
      })}
    </nav>
  );
}
