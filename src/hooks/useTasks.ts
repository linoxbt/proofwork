import { useEffect, useState, useCallback } from 'react';
import {
  getReadOnlyClient,
  getTaskState,
  getAllTaskAddresses,
  getEscrowStatus,
  type ContractTaskState,
} from '@/lib/contract';
import { useWalletContext } from '@/contexts/WalletContext';

export interface OnChainTask extends ContractTaskState {
  contractAddress: string;
  escrowLocked: number;
  escrowReleased: boolean;
}

export function useTasks() {
  const { network } = useWalletContext();
  const [tasks, setTasks] = useState<OnChainTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const addresses = await getAllTaskAddresses(network);
      const client = getReadOnlyClient(network);
      const results = await Promise.all(
        addresses.map(async (contractAddress) => {
          try {
            const [state, escrow] = await Promise.all([
              getTaskState(client, contractAddress),
              getEscrowStatus(network, contractAddress),
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
      setTasks(results.filter((t): t is OnChainTask => t !== null).reverse());
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh };
}
