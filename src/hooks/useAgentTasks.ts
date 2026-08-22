import { useEffect, useState, useCallback } from 'react';
import {
  getAllAgentTaskAddresses,
  getAgentTaskState,
  getAgentTaskEscrowStatus,
  type AgentTaskState,
} from '@/lib/agentContract';
import { getReadOnlyClient } from '@/lib/contract';
import { NETWORKS } from '@/lib/networks';
import { useWalletContext } from '@/contexts/WalletContext';

export interface OnChainAgentTask extends AgentTaskState {
  contractAddress: string;
  escrowLocked: number;
  escrowReleased: boolean;
}

export function useAgentTasks() {
  const { network } = useWalletContext();
  const [tasks, setTasks] = useState<OnChainAgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!NETWORKS[network].agentFactoryAddress) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const addresses = await getAllAgentTaskAddresses(network);
      const client = getReadOnlyClient(network);
      const results = await Promise.all(
        addresses.map(async (contractAddress) => {
          try {
            const [state, escrow] = await Promise.all([
              getAgentTaskState(client, contractAddress),
              getAgentTaskEscrowStatus(network, contractAddress),
            ]);
            return {
              ...state,
              contractAddress,
              escrowLocked: escrow.lockedAmount,
              escrowReleased: escrow.released,
            };
          } catch {
            return null;
          }
        })
      );
      setTasks(results.filter((t): t is OnChainAgentTask => t !== null).reverse());
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh };
}
