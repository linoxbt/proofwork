import { createClient } from 'genlayer-js';
import { testnetAsimov } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

// Contract interaction helpers for the TaskVerifier Intelligent Contract

let readOnlyClient: any = null;

// Client for reads that don't require a connected wallet (e.g. browsing the task board)
export function getReadOnlyClient() {
  if (!readOnlyClient) {
    readOnlyClient = createClient({ chain: testnetAsimov });
  }
  return readOnlyClient;
}

export interface ContractTaskState {
  creator: string;
  title: string;
  description: string;
  criteria: string;
  reward_amount: number;
  worker: string;
  submission_url: string;
  status: 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected';
  verification_result: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  reasoning: string;
}

const TX_WAIT_OPTIONS = {
  status: TransactionStatus.ACCEPTED,
  retries: 50,
  interval: 5000,
};

export async function deployTaskContract(
  client: any,
  contractCode: string,
  title: string,
  description: string,
  criteria: string,
  rewardAmount: number
): Promise<string> {
  const txHash = await client.deployContract({
    code: contractCode,
    args: [title, description, criteria, rewardAmount],
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    ...TX_WAIT_OPTIONS,
  });
  return receipt.txDataDecoded?.contractAddress ?? receipt.data?.contract_address ?? '';
}

export async function claimTask(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'claim_task',
    args: [],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function submitWork(
  client: any,
  contractAddress: string,
  githubUrl: string
): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'submit_work',
    args: [githubUrl],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function cancelTask(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'cancel_task',
    args: [],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function getTaskState(client: any, contractAddress: string): Promise<ContractTaskState> {
  const result = await client.readContract({
    address: contractAddress,
    functionName: 'get_task_state',
    args: [],
  });
  // reward_amount is a u256 on-chain and may come back as a bigint
  return { ...result, reward_amount: Number(result.reward_amount) } as ContractTaskState;
}
