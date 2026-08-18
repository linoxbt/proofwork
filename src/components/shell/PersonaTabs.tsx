import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, PlusSquare, BookOpen } from 'lucide-react';

const PERSONAS = [
  { path: '/', label: 'Board', icon: LayoutGrid },
  { path: '/create', label: 'Create', icon: PlusSquare },
  { path: '/about', label: 'About', icon: BookOpen },
];

export function PersonaTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="h-9 shrink-0 flex items-stretch border-b border-border bg-card px-1">
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
