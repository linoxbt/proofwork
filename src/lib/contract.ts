import { TransactionStatus } from 'genlayer-js/types';

// Contract interaction helpers for the ChroniclesGameMaster Intelligent Contract

export interface ContractGameState {
  theme: string;
  players: string[];
  max_players: number;
  started: boolean;
  finished: boolean;
  current_beat: number;
  story_beats: ContractStoryBeat[];
}

export interface ContractStoryBeat {
  text: string;
  choices: string[];
  votes: Record<string, number>; // player_address -> choice_index
  chosen_index: number | null;
  resolved: boolean;
}

const TX_WAIT_OPTIONS = {
  status: TransactionStatus.ACCEPTED,
  retries: 50,
  interval: 5000,
};

export async function deployGameContract(
  client: any,
  contractCode: string,
  theme: string,
  maxPlayers: number = 4
): Promise<string> {
  await client.initializeConsensusSmartContract();
  const txHash = await client.deployContract({
    code: contractCode,
    args: [theme, maxPlayers],
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    ...TX_WAIT_OPTIONS,
  });
  return receipt.data?.contract_address ?? '';
}

export async function joinGame(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'join_game',
    args: [],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function startGame(client: any, contractAddress: string): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'start_game',
    args: [],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function submitVote(
  client: any,
  contractAddress: string,
  choiceIndex: number
): Promise<string> {
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'vote',
    args: [choiceIndex],
    value: 0,
  });
  await client.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
  return txHash;
}

export async function getGameState(client: any, contractAddress: string): Promise<ContractGameState> {
  const result = await client.readContract({
    address: contractAddress,
    functionName: 'get_game_state',
    args: [],
  });
  return result as ContractGameState;
}

export async function getPlayers(client: any, contractAddress: string): Promise<string[]> {
  const result = await client.readContract({
    address: contractAddress,
    functionName: 'get_players',
    args: [],
  });
  return result as string[];
}

export async function getCurrentStory(client: any, contractAddress: string): Promise<ContractStoryBeat[]> {
  const result = await client.readContract({
    address: contractAddress,
    functionName: 'get_story',
    args: [],
  });
  return result as ContractStoryBeat[];
}
