import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

// The swarm only ever runs against Studionet - it's the only network with the
// AGENTS contracts deployed (see src/lib/networks.ts).
export const NETWORK = 'studionet' as const;
export const STUDIO_RPC = 'https://studio.genlayer.com/api';

export function buildClient(privateKey: `0x${string}`) {
  return createClient({ chain: studionet, account: createAccount(privateKey) });
}

export function buildReadOnlyClient() {
  return createClient({ chain: studionet });
}

export async function getBalanceWei(address: string): Promise<bigint> {
  const res = await fetch(STUDIO_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }),
  });
  const json: any = await res.json();
  return BigInt(json.result ?? '0x0');
}

export function fmtGen(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(2);
}
