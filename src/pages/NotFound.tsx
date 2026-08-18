import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { CodeCard } from "@/components/CodeCard";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center h-full">
        <CodeCard title="404" className="w-72 text-center">
          <p className="text-lg font-semibold text-foreground mb-1">Page not found</p>
          <p className="text-sm text-muted-foreground mb-4">{location.pathname}</p>
          <a href="/" className="tool-btn-primary w-full h-8 inline-flex">
            Back to Board
          </a>
        </CodeCard>
      </div>
    </AppShell>
  );
};

export default NotFound;
