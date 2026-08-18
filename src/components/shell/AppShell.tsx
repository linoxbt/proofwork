import { type ReactNode } from 'react';
import { TitleBar } from './TitleBar';
import { PersonaTabs } from './PersonaTabs';
import { Toolbar } from './Toolbar';
import { StudioPanel } from './StudioPanel';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
  toolbar?: ReactNode;
  breadcrumb?: string;
  panel?: ReactNode;
}

export function AppShell({ children, toolbar, breadcrumb, panel }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TitleBar />
      <PersonaTabs />
      <Toolbar breadcrumb={breadcrumb}>{toolbar}</Toolbar>
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto">{children}</main>
        {panel && <StudioPanel>{panel}</StudioPanel>}
      </div>
      <StatusBar />
    </div>
  );
}
