import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-dvh flex items-center justify-center bg-background text-foreground px-4">
          <div className="w-full max-w-sm rounded border border-border bg-card overflow-hidden text-center">
            <div className="flex items-center gap-2 border-b border-border px-3 h-8 bg-muted/40">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Error</span>
            </div>
            <div className="p-5">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Something went wrong</p>
              <p className="text-xs text-muted-foreground mb-4">{this.state.error.message}</p>
              <button
                onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
                className="tool-btn-primary w-full h-8"
              >
                Back to Board
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
