import { createClient } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';

// Contract interaction helpers for TaskFactory + its TaskVerifier children

const readOnlyClients: Partial<Record<NetworkId, any>> = {};

// Client for reads that don't require a connected wallet (e.g. browsing the task board)
export function getReadOnlyClient(network: NetworkId) {
  if (!readOnlyClients[network]) {
    readOnlyClients[network] = createClient({ chain: NETWORKS[network].chain });
  }
  return readOnlyClients[network];
}

export interface ContractTaskState {
  creator: string;
  factory: string;
  title: string;
  category: string;
  category_other: string;
  priority: string;
  estimated_effort: string;
  description: string;
  criteria: string;
  submission_format: string;
  submission_format_other: string;
  reward_amount: number;
  deadline: number;
  worker: string;
  submission_url: string;
  status: 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected' | 'disputed';
  verification_result: string;
  dispute_count: number;
  dispute_reason: string;
  created_at: number;
  verified_at: number;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  reasoning: string;
}

export interface EscrowStatus {
  lockedAmount: number;
  released: boolean;
}

export interface CreateTaskInput {
  title: string;
  category: string;
  categoryOther: string;
  priority: string;
  estimatedEffort: string;
  description: string;
  criteria: string;
  submissionFormat: string;
  submissionFormatOther: string;
  rewardAmount: number;
  deadlineUnixSeconds: number;
}

const TX_WAIT_OPTIONS = {
  status: TransactionStatus.ACCEPTED,
  retries: 50,
  interval: 5000,
};

// A transaction can reach status ACCEPTED at the message-queue level while the
// contract call itself failed or the validator round never actually agreed
// (timeout / deterministic violation among nondet-block validators, most often
// hit by the AI-verification path). Check the leader's actual execution result
// rather than trusting "ACCEPTED" alone.
function assertTxSucceeded(receipt: any, action: string) {
  const leaderResult = receipt?.consensus_data?.leader_receipt?.[0]?.execution_result;
  const execResultName = receipt?.txExecutionResultName;
  const failed =
    (leaderResult && leaderResult !== 'SUCCESS') ||
    (execResultName && execResultName !== 'FINISHED_WITH_RETURN') ||
    receipt?.status_name === 'UNDETERMINED';
  if (failed) {
    throw new Error(`${action} did not complete (${leaderResult ?? execResultName ?? receipt?.status_name}). Please try again.`);
  }
}

export async function createTaskViaFactory(
  client: any,
  network: NetworkId,
  input: CreateTaskInput
): Promise<string> {
  const valueWei = BigInt(input.rewardAmount) * BigInt(10 ** 18);
  const txHash = await client.writeContract({
    address: NETWORKS[network].factoryAddress,
    functionName: 'create_task',
    args: [
      input.title,
      input.category,
      input.categoryOther,
      input.priority,
      input.estimatedEffort,
      input.description,
      input.criteria,
      input.submissionFormat,
      input.submissionFormatOther,
      input.rewardAmount,
      input.deadlineUnixSeconds,
    ],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Task creation');

  // The factory returns the new child address as the call's return value, but
  // the receipt doesn't surface it directly for a plain writeContract call —
  // read the factory's task list and take the newest entry instead.
  const readClient = getReadOnlyClient(network);
  const tasks: string[] = await readClient.readContract({
    address: NETWORKS[network].factoryAddress,
    functionName: 'get_all_tasks',
    args: [],
  });
  return tasks[tasks.length - 1];
}

export async function getAllTaskAddresses(network: NetworkId): Promise<string[]> {
  const client = getReadOnlyClient(network);
  return client.readContract({
    address: NETWORKS[network].factoryAddress,
    functionName: 'get_all_tasks',
    args: [],
  });
}

export async function getEscrowStatus(network: NetworkId, taskAddress: string): Promise<EscrowStatus> {
  const client = getReadOnlyClient(network);
  const result = await client.readContract({
    address: NETWORKS[network].factoryAddress,
    functionName: 'get_escrow_status',
    args: [taskAddress],
  });
  return {
    lockedAmount: Number(result.locked_amount) / 1e18,
    released: !!result.released,
  };
}

export async function releaseFunds(client: any, network: NetworkId, taskAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: NETWORKS[network].factoryAddress,
    functionName: 'release_funds',
    args: [taskAddress],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Escrow release');
  return txHash;
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
  evidenceUrl: string
): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'submit_work',
    args: [evidenceUrl],
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
  // reward_amount/deadline/dispute_count/created_at/verified_at are u256 on-chain and may come back as bigints
  return {
    ...result,
    reward_amount: Number(result.reward_amount),
    deadline: Number(result.deadline),
    dispute_count: Number(result.dispute_count),
    created_at: Number(result.created_at),
    verified_at: Number(result.verified_at),
  } as ContractTaskState;
}
