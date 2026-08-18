import { useEffect, useState, useCallback } from 'react';
import { getReadOnlyClient, getTaskState, type ContractTaskState } from '@/lib/contract';
import { listRegisteredTasks } from '@/lib/taskRegistry';

export interface OnChainTask extends ContractTaskState {
  contractAddress: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<OnChainTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const registered = listRegisteredTasks();
    const client = getReadOnlyClient();
    const results = await Promise.all(
      registered.map(async ({ contractAddress }) => {
        try {
          const state = await getTaskState(client, contractAddress);
          return { ...state, contractAddress };
        } catch {
          return null;
        }
      })
    );
    setTasks(results.filter((t): t is OnChainTask => t !== null));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh };
}
