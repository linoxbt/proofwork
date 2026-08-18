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
  category: string;
  description: string;
  criteria: string;
  reward_amount: number;
  deadline: number;
  worker: string;
  submission_url: string;
  status: 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected' | 'disputed';
  verification_result: string;
  dispute_count: number;
  dispute_reason: string;
  created_at: number;
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

// A transaction can reach status ACCEPTED at the message-queue level while the
// contract call itself failed or the validator round never actually agreed
// (timeout / deterministic violation among nondet-block validators, most often
// hit by the AI-verification path). Only txExecutionResultName reflects whether
// the contract code genuinely completed — check it explicitly rather than
// trusting "ACCEPTED" alone.
function assertTxSucceeded(receipt: any, action: string) {
  const result = receipt?.txExecutionResultName;
  if (result && result !== 'FINISHED_WITH_RETURN') {
    throw new Error(`${action} did not complete (${result}). Please try again.`);
  }
}

export async function deployTaskContract(
  client: any,
  contractCode: string,
  title: string,
  category: string,
  description: string,
  criteria: string,
  rewardAmount: number,
  deadlineUnixSeconds: number
): Promise<string> {
  const txHash = await client.deployContract({
    code: contractCode,
    args: [title, category, description, criteria, rewardAmount, deadlineUnixSeconds],
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    ...TX_WAIT_OPTIONS,
  });
  assertTxSucceeded(receipt, 'Deploy');
  return receipt.txDataDecoded?.contractAddress ?? receipt.data?.contract_address ?? '';
}

export async function claimTask(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'claim_task',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Claim');
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
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Submit');
  return txHash;
}

export async function requestVerification(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'request_verification',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Verification');
  return txHash;
}

export async function disputeTask(
  client: any,
  contractAddress: string,
  reason: string
): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'dispute',
    args: [reason],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Dispute');
  return txHash;
}

export async function cancelTask(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'cancel_task',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Cancel');
  return txHash;
}

export async function getTaskState(client: any, contractAddress: string): Promise<ContractTaskState> {
  const result = await client.readContract({
    address: contractAddress,
    functionName: 'get_task_state',
    args: [],
  });
  // reward_amount/deadline/dispute_count/created_at are u256 on-chain and may come back as bigints
  return {
    ...result,
    reward_amount: Number(result.reward_amount),
    deadline: Number(result.deadline),
    dispute_count: Number(result.dispute_count),
    created_at: Number(result.created_at),
  } as ContractTaskState;
}
