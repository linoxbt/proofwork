import { TransactionStatus } from 'genlayer-js/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { getReadOnlyClient } from '@/lib/contract';

// Contract interaction helpers for AgentRegistry + AgentTaskFactory / AgentTask
// - the autonomous agent economy, separate from the human task board's
// TaskFactory/TaskVerifier (see contract.ts).

export interface AgentInfo {
  address: string;
  registered: boolean;
  capabilities: string;
  stake: number;
  reputation: number;
  active_tasks: number;
  active: boolean;
}

export interface AgentTaskState {
  requester: string;
  factory: string;
  registry: string;
  title: string;
  description: string;
  criteria: string;
  capability_required: string;
  budget: number;
  deadline: number;
  bidding_deadline: number;
  bid_count: number;
  assigned_agent: string;
  assigned_price: number; // what the agent actually gets paid (its winning bid, not the full budget)
  submission_url: string;
  submission_note: string;
  status: 'open' | 'assigned' | 'submitted' | 'verified' | 'rejected' | 'disputed' | 'cancelled' | 'expired';
  verification_result: string;
  dispute_count: number;
  dispute_reason: string;
  created_at: number;
  verified_at: number;
}

export interface Attestation {
  agent: string;
  passed: boolean | null;
  score: number;
  deliverable_url: string;
  timestamp: number;
}

export interface Bid {
  agent: string;
  price: number;
  eta_hours: number;
}

export interface CreateAgentTaskInput {
  title: string;
  description: string;
  criteria: string;
  capabilityRequired: string;
  budget: number;
  deadlineUnixSeconds: number;
}

export interface CreateDirectTaskInput {
  title: string;
  description: string;
  criteria: string;
  capabilityRequired: string;
  agentAddress: string;
  budget: number;
  deadlineUnixSeconds: number;
}

export interface CreateRecurringTaskInput {
  title: string;
  description: string;
  criteria: string;
  capabilityRequired: string;
  budgetPerOccurrence: number;
  deadlineDurationSeconds: number;
  intervalSeconds: number;
  occurrences: number;
}

export interface RecurringSeries {
  requester: string;
  title: string;
  capability_required: string;
  budget_per_occurrence: number;
  duration_seconds: number;
  interval_seconds: number;
  remaining: number;
  next_advance_at: number;
  active: boolean;
  awarded: boolean;
  bidding_deadline: number;
  bid_count: number;
  committed_agent: string;
  committed_price: number;
}

const TX_WAIT_OPTIONS = {
  status: TransactionStatus.ACCEPTED,
  retries: 50,
  interval: 5000,
};

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

function requireAgentContracts(network: NetworkId) {
  const cfg = NETWORKS[network];
  if (!cfg.agentRegistryAddress || !cfg.agentFactoryAddress) {
    throw new Error(`The agent economy is not deployed on ${cfg.label} yet - switch networks.`);
  }
  return { registryAddress: cfg.agentRegistryAddress, factoryAddress: cfg.agentFactoryAddress };
}

export async function registerAgent(client: any, network: NetworkId, capabilities: string, stakeGen: number): Promise<string> {
  const { registryAddress } = requireAgentContracts(network);
  const valueWei = BigInt(stakeGen) * BigInt(10 ** 18);
  const txHash = await client.writeContract({
    address: registryAddress,
    functionName: 'register_agent',
    args: [capabilities],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Agent registration');
  return txHash;
}

export async function goOffline(client: any, network: NetworkId): Promise<string> {
  const { registryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: registryAddress,
    functionName: 'go_offline',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Go offline');
  return txHash;
}

export async function withdrawStake(client: any, network: NetworkId): Promise<string> {
  const { registryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: registryAddress,
    functionName: 'withdraw_stake',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Withdraw stake');
  return txHash;
}

export async function restake(client: any, network: NetworkId, addGen: number): Promise<string> {
  const { registryAddress } = requireAgentContracts(network);
  const valueWei = BigInt(Math.round(addGen * 1e18));
  const txHash = await client.writeContract({
    address: registryAddress,
    functionName: 'restake',
    args: [],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Restake');
  return txHash;
}

export async function getAgent(network: NetworkId, address: string): Promise<AgentInfo> {
  const { registryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const result = await client.readContract({ address: registryAddress, functionName: 'get_agent', args: [address] });
  return {
    ...result,
    stake: Number(result.stake) / 1e18,
    reputation: Number(result.reputation),
    active_tasks: Number(result.active_tasks),
  } as AgentInfo;
}

export async function getAllAgents(network: NetworkId): Promise<string[]> {
  const { registryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  return client.readContract({ address: registryAddress, functionName: 'get_all_agents', args: [] });
}

export async function createAgentTask(client: any, network: NetworkId, input: CreateAgentTaskInput): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const valueWei = BigInt(input.budget) * BigInt(10 ** 18);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'create_task',
    args: [input.title, input.description, input.criteria, input.capabilityRequired, input.budget, input.deadlineUnixSeconds],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Agent task creation');

  const readClient = getReadOnlyClient(network);
  const tasks: string[] = await readClient.readContract({ address: factoryAddress, functionName: 'get_all_tasks', args: [] });
  return tasks[tasks.length - 1];
}

export async function createDirectTask(client: any, network: NetworkId, input: CreateDirectTaskInput): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const valueWei = BigInt(input.budget) * BigInt(10 ** 18);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'create_direct_task',
    args: [input.title, input.description, input.criteria, input.capabilityRequired, input.agentAddress, input.budget, input.deadlineUnixSeconds],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Direct hire');

  const readClient = getReadOnlyClient(network);
  const tasks: string[] = await readClient.readContract({ address: factoryAddress, functionName: 'get_all_tasks', args: [] });
  return tasks[tasks.length - 1];
}

export async function getAttestation(client: any, contractAddress: string): Promise<Attestation> {
  const result = await client.readContract({ address: contractAddress, functionName: 'get_attestation', args: [] });
  return { ...result, score: Number(result.score), timestamp: Number(result.timestamp) } as Attestation;
}

export async function createRecurringTask(client: any, network: NetworkId, input: CreateRecurringTaskInput): Promise<number> {
  const { factoryAddress } = requireAgentContracts(network);
  const valueWei = BigInt(input.budgetPerOccurrence) * BigInt(input.occurrences) * BigInt(10 ** 18);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'create_recurring_task',
    args: [
      input.title, input.description, input.criteria, input.capabilityRequired,
      input.budgetPerOccurrence, input.deadlineDurationSeconds, input.intervalSeconds, input.occurrences,
    ],
    value: valueWei,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Recurring task creation');

  const readClient = getReadOnlyClient(network);
  const count: number = Number(await readClient.readContract({ address: factoryAddress, functionName: 'get_series_count', args: [] }));
  return count;
}

export async function bidRecurringSeries(client: any, network: NetworkId, seriesId: number, priceGen: number, etaHours: number): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'bid_recurring_series',
    args: [seriesId, priceGen, etaHours],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Bid on series');
  return txHash;
}

export async function awardRecurringSeries(client: any, network: NetworkId, seriesId: number): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'award_recurring_series',
    args: [seriesId],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Award series');
  return txHash;
}

export async function getSeriesBids(network: NetworkId, seriesId: number): Promise<Bid[]> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const raw: string[] = await client.readContract({ address: factoryAddress, functionName: 'get_series_bids', args: [seriesId] });
  return raw.map((r) => JSON.parse(r));
}

export async function advanceRecurringSeries(client: any, network: NetworkId, oldTaskAddress: string): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'advance_recurring_series',
    args: [oldTaskAddress],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Advance recurring series');
  return txHash;
}

export async function cancelRecurringSeries(client: any, network: NetworkId, seriesId: number): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'cancel_recurring_series',
    args: [seriesId],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Cancel recurring series');
  return txHash;
}

export async function getSeries(network: NetworkId, seriesId: number): Promise<RecurringSeries> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const result = await client.readContract({ address: factoryAddress, functionName: 'get_series', args: [seriesId] });
  return {
    ...result,
    budget_per_occurrence: Number(result.budget_per_occurrence) / 1e18,
    duration_seconds: Number(result.duration_seconds),
    interval_seconds: Number(result.interval_seconds),
    remaining: Number(result.remaining),
    next_advance_at: Number(result.next_advance_at),
  } as RecurringSeries;
}

export async function getSeriesForTask(network: NetworkId, taskAddress: string): Promise<number> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const result = await client.readContract({ address: factoryAddress, functionName: 'get_series_for_task', args: [taskAddress] });
  return Number(result);
}

export async function getSeriesCount(network: NetworkId): Promise<number> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const result = await client.readContract({ address: factoryAddress, functionName: 'get_series_count', args: [] });
  return Number(result);
}

export async function getAllAgentTaskAddresses(network: NetworkId): Promise<string[]> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  return client.readContract({ address: factoryAddress, functionName: 'get_all_tasks', args: [] });
}

export async function getAgentTaskState(client: any, contractAddress: string): Promise<AgentTaskState> {
  const result = await client.readContract({ address: contractAddress, functionName: 'get_task_state', args: [] });
  return {
    ...result,
    budget: Number(result.budget),
    deadline: Number(result.deadline),
    bidding_deadline: Number(result.bidding_deadline),
    bid_count: Number(result.bid_count),
    assigned_price: Number(result.assigned_price),
    dispute_count: Number(result.dispute_count),
    created_at: Number(result.created_at),
    verified_at: Number(result.verified_at),
  } as AgentTaskState;
}

export async function getAgentTaskBids(client: any, contractAddress: string): Promise<Bid[]> {
  const raw: string[] = await client.readContract({ address: contractAddress, functionName: 'get_bids', args: [] });
  return raw.map((r) => JSON.parse(r));
}

export async function placeBid(client: any, contractAddress: string, priceGen: number, etaHours: number): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'place_bid',
    args: [priceGen, etaHours],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Place bid');
  return txHash;
}

export async function closeBiddingAndAssign(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'close_bidding_and_assign',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Close bidding');
  return txHash;
}

export async function submitDeliverable(client: any, contractAddress: string, evidenceUrl: string, note: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'submit_deliverable',
    args: [evidenceUrl, note],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Submit deliverable');
  return txHash;
}

export async function requestAgentVerification(client: any, contractAddress: string): Promise<string> {
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

export async function disputeAgentTask(client: any, contractAddress: string, reason: string): Promise<string> {
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

export async function cancelAgentTask(client: any, contractAddress: string): Promise<string> {
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

export async function checkAgentTaskTimeout(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'check_timeout',
    args: [],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Check timeout');
  return txHash;
}

export async function releaseAgentTaskFunds(client: any, network: NetworkId, contractAddress: string): Promise<string> {
  const { factoryAddress } = requireAgentContracts(network);
  const txHash = await client.writeContract({
    address: factoryAddress,
    functionName: 'release_funds',
    args: [contractAddress],
    value: 0,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  assertTxSucceeded(receipt, 'Release funds');
  return txHash;
}

export async function getAgentTaskEscrowStatus(network: NetworkId, contractAddress: string): Promise<{ lockedAmount: number; released: boolean }> {
  const { factoryAddress } = requireAgentContracts(network);
  const client = getReadOnlyClient(network);
  const result = await client.readContract({ address: factoryAddress, functionName: 'get_escrow_status', args: [contractAddress] });
  return { lockedAmount: Number(result.locked_amount) / 1e18, released: !!result.released };
}
