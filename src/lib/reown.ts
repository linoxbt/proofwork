import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';
import { NETWORKS } from '@/lib/networks';

// GenLayer networks, defined for Reown AppKit - mirrors genlayer-js's own
// chain definitions (src/lib/networks.ts) so the wallet and the RPC client
// always agree on chain id / RPC / explorer.
const genlayerAsimov = defineChain({
  id: NETWORKS.asimov.chain.id,
  caipNetworkId: `eip155:${NETWORKS.asimov.chain.id}`,
  chainNamespace: 'eip155',
  name: NETWORKS.asimov.label,
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: [...NETWORKS.asimov.chain.rpcUrls.default.http] } },
  blockExplorers: NETWORKS.asimov.chain.blockExplorers
    ? { default: { name: 'GenLayer Explorer', url: NETWORKS.asimov.chain.blockExplorers.default.url } }
    : undefined,
});

const genlayerStudionet = defineChain({
  id: NETWORKS.studionet.chain.id,
  caipNetworkId: `eip155:${NETWORKS.studionet.chain.id}`,
  chainNamespace: 'eip155',
  name: NETWORKS.studionet.label,
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: [...NETWORKS.studionet.chain.rpcUrls.default.http] } },
  blockExplorers: NETWORKS.studionet.chain.blockExplorers
    ? { default: { name: 'GenLayer Explorer', url: NETWORKS.studionet.chain.blockExplorers.default.url } }
    : undefined,
});

export const REOWN_NETWORKS = [genlayerAsimov, genlayerStudionet] as const;

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;

let appKit: ReturnType<typeof createAppKit> | null = null;

// ProofWork connects wallets exclusively through Reown AppKit (WalletConnect) -
// its own modal handles injected wallets (via EIP-6963 auto-detection), the
// WalletConnect QR/deep-link flow for mobile, and network switching between
// both GenLayer networks natively. Requires a free project ID from
// https://cloud.reown.com, set as VITE_REOWN_PROJECT_ID.
export function getAppKit() {
  if (!projectId) return null;
  if (!appKit) {
    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [genlayerAsimov, genlayerStudionet],
      defaultNetwork: genlayerStudionet,
      projectId,
      metadata: {
        name: 'ProofWork',
        description: 'AI-Verified Task Completion on GenLayer',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://proofwork.app',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : ''],
      },
      features: { analytics: false, email: false, socials: false },
    });
  }
  return appKit;
}

export function isReownConfigured() {
  return !!projectId;
}
