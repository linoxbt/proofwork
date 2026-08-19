import { type ReactNode, useState } from 'react';
import { TitleBar } from './TitleBar';
import { PersonaTabs } from './PersonaTabs';
import { Toolbar } from './Toolbar';
import { StudioPanel } from './StudioPanel';
import { StatusBar } from './StatusBar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PanelRight, PanelRightClose } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
  toolbar?: ReactNode;
  breadcrumb?: string;
  panel?: ReactNode;
}

export function AppShell({ children, toolbar, breadcrumb, panel }: AppShellProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />
      <PersonaTabs />
      <Toolbar breadcrumb={breadcrumb}>
        {toolbar}
        {panel && (
          <>
            <button
              onClick={() => setPanelOpen(true)}
              className="tool-btn lg:hidden ml-auto"
              title="Show details"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPanelCollapsed((v) => !v)}
              className="tool-btn hidden lg:inline-flex ml-auto"
              title={panelCollapsed ? 'Show panel' : 'Hide panel'}
              data-active={panelCollapsed}
            >
              {panelCollapsed ? <PanelRight className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </Toolbar>
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
        {panel && !panelCollapsed && <StudioPanel>{panel}</StudioPanel>}
      </div>
      <StatusBar />

      {panel && (
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="right" className="w-[85vw] max-w-xs p-0 bg-card border-border overflow-y-auto">
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
