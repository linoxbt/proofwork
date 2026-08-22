import { testnetAsimov, studionet } from 'genlayer-js/chains';

export type NetworkId = 'asimov' | 'studionet';

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  chain: typeof testnetAsimov | typeof studionet;
  chainIdHex: `0x${string}`;
  factoryAddress: `0x${string}`;
  gasless: boolean;
  // Agent economy contracts - undefined where not yet deployed (Asimov is
  // blocked on deployer GEN balance, same constraint as the human task board).
  agentRegistryAddress?: `0x${string}`;
  agentFactoryAddress?: `0x${string}`;
}

// TaskFactory deployed once per network - hardcoded, do not change without
// redeploying (see contracts/task_factory.py, contracts/generate_factory.py).
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  asimov: {
    id: 'asimov',
    label: 'Asimov Testnet',
    chain: testnetAsimov,
    chainIdHex: `0x${testnetAsimov.id.toString(16)}` as `0x${string}`,
    factoryAddress: '0x410273D0755A5EE0255Cb8a9A40DDB93B545D3B9',
    gasless: false,
  },
  studionet: {
    id: 'studionet',
    label: 'Studionet',
    chain: studionet,
    chainIdHex: `0x${studionet.id.toString(16)}` as `0x${string}`,
    factoryAddress: '0xa70CDdF1F3F8626BdBE4129b8E9B64007225EE60',
    gasless: true,
    agentRegistryAddress: '0xf425B0E3841fD3804345f7C2784DFB06e743f8a4',
    agentFactoryAddress: '0x03Fdfa3eAC4AC57b9EADBaC1f13802133DBc5D15',
  },
};

// Studionet is gasless and carries the presentation demo tasks; Asimov needs
// real testnet GEN a first-time visitor won't have yet.
export const DEFAULT_NETWORK: NetworkId = 'studionet';

const STORAGE_KEY = 'proofwork-network';

export function getStoredNetwork(): NetworkId {
  if (typeof window === 'undefined') return DEFAULT_NETWORK;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'asimov' || stored === 'studionet' ? stored : DEFAULT_NETWORK;
}

export function setStoredNetwork(network: NetworkId): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, network);
}
