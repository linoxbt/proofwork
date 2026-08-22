import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Launcher from "./pages/Launcher";
import AgentsBoard from "./pages/AgentsBoard";
import CreateAgentTask from "./pages/CreateAgentTask";
import AgentTaskDetail from "./pages/AgentTaskDetail";
import RegisterAgent from "./pages/RegisterAgent";
import AgentSettlements from "./pages/AgentSettlements";
import AgentExplorer from "./pages/AgentExplorer";
import AgentRecurring from "./pages/AgentRecurring";
import Board from "./pages/Index";
import CreateTask from "./pages/CreateTask";
import TaskDetail from "./pages/TaskDetail";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/launch" element={<Launcher />} />
              <Route path="/agents" element={<AgentsBoard />} />
              <Route path="/agents/create" element={<CreateAgentTask />} />
              <Route path="/agents/task/:address" element={<AgentTaskDetail />} />
              <Route path="/agents/register" element={<RegisterAgent />} />
              <Route path="/agents/settlements" element={<AgentSettlements />} />
              <Route path="/agents/explorer" element={<AgentExplorer />} />
              <Route path="/agents/recurring" element={<AgentRecurring />} />
              <Route path="/board" element={<Board />} />
              <Route path="/tasks" element={<Navigate to="/board" replace />} />
              <Route path="/create" element={<CreateTask />} />
              <Route path="/task/:address" element={<TaskDetail />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
