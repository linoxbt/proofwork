import { testnetAsimov, studionet } from 'genlayer-js/chains';

export type NetworkId = 'asimov' | 'studionet';

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  chain: typeof testnetAsimov | typeof studionet;
  chainIdHex: `0x${string}`;
  factoryAddress: `0x${string}`;
  gasless: boolean;
}

// TaskFactory deployed once per network — hardcoded, do not change without
// redeploying (see contracts/task_factory.py, contracts/generate_factory.py).
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  asimov: {
    id: 'asimov',
    label: 'Asimov Testnet',
    chain: testnetAsimov,
    chainIdHex: `0x${testnetAsimov.id.toString(16)}` as `0x${string}`,
    factoryAddress: '0x5e005Fb91dc48F50d737C1F29F4D52F768898018',
    gasless: false,
  },
  studionet: {
    id: 'studionet',
    label: 'Studionet',
    chain: studionet,
    chainIdHex: `0x${studionet.id.toString(16)}` as `0x${string}`,
    factoryAddress: '0x685A79DD47EA5354aD98f7A1e5329Aa276AF7ffe',
    gasless: true,
  },
};

export const DEFAULT_NETWORK: NetworkId = 'asimov';

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
