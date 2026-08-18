import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';

// GenLayer Asimov Testnet, defined for Reown AppKit (chain id 4221) —
// mirrors genlayer-js's own testnetAsimov chain definition.
export const genlayerAsimovTestnet = defineChain({
  id: 4221,
  caipNetworkId: 'eip155:4221',
  chainNamespace: 'eip155',
  name: 'GenLayer Asimov Testnet',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-asimov.genlayer.com'] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Explorer', url: 'https://explorer-asimov.genlayer.com' },
  },
});

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;

let appKit: ReturnType<typeof createAppKit> | null = null;

// Reown AppKit (WalletConnect) gives mobile users — who have no injected
// window.ethereum — a way to connect via QR code / deep link to any of the
// 300+ WalletConnect-compatible wallets. Requires a free project ID from
// https://cloud.reown.com, set as VITE_REOWN_PROJECT_ID.
export function getAppKit() {
  if (!projectId) return null;
  if (!appKit) {
    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [genlayerAsimovTestnet],
      defaultNetwork: genlayerAsimovTestnet,
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
