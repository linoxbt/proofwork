import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, PlusSquare, BookOpen, LayoutDashboard, Rocket, Compass, Unlock, Repeat, ShieldCheck } from 'lucide-react';

const BOARD_TABS = [
  { path: '/board', label: 'Board', icon: LayoutGrid },
  { path: '/create', label: 'Create', icon: PlusSquare },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/about', label: 'About', icon: BookOpen },
];

const AGENT_TABS = [
  { path: '/agents/dashboard', label: 'Board', icon: LayoutGrid },
  { path: '/agents/register', label: 'Register', icon: ShieldCheck },
  { path: '/agents/create', label: 'Post Task', icon: Rocket },
  { path: '/agents/explorer', label: 'Explorer', icon: Compass },
  { path: '/agents/settlements', label: 'Settlements', icon: Unlock },
  { path: '/agents/recurring', label: 'Recurring', icon: Repeat },
];

export function PersonaTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = location.pathname.startsWith('/agents') ? AGENT_TABS : BOARD_TABS;

  return (
    <nav className="h-9 shrink-0 flex items-stretch border-b border-border bg-card px-1 overflow-x-auto">
      {tabs.map((p) => {
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
