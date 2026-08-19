import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createClient } from 'genlayer-js';
import { getAppKit, isReownConfigured, REOWN_NETWORKS } from '@/lib/reown';
import { NETWORKS, type NetworkId, getStoredNetwork, setStoredNetwork } from '@/lib/networks';

interface WalletContextType {
  address: string;
  displayAddress: string;
  client: any;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  openAccount: () => void;
  network: NetworkId;
  switchNetwork: (network: NetworkId) => void;
  reownReady: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainIdToNetwork(chainId: number | string | undefined): NetworkId {
  const idNum = Number(chainId);
  if (idNum === NETWORKS.studionet.chain.id) return 'studionet';
  return 'asimov';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('');
  const [client, setClient] = useState<any>(null);
  const [network, setNetwork] = useState<NetworkId>(getStoredNetwork());
  const [isConnecting, setIsConnecting] = useState(false);
  const reownReady = isReownConfigured();

  // Sync address + active network from the Reown AppKit modal - the single
  // source of truth for the connection. Its own UI handles injected-wallet
  // detection (EIP-6963), WalletConnect QR/deep-link, and network switching.
  useEffect(() => {
    const modal = getAppKit();
    if (!modal) return;

    if (modal.getIsConnectedState()) {
      const addr = modal.getAddress();
      if (addr) setAddress(addr);
      const caipNetwork = modal.getCaipNetwork();
      if (caipNetwork) {
        const net = chainIdToNetwork(caipNetwork.id);
        setNetwork(net);
        setStoredNetwork(net);
      }
    }

    const unsubAccount = modal.subscribeAccount((acc: any) => {
      if (acc.isConnected && acc.address) {
        setAddress(acc.address);
      } else {
        setAddress('');
        setClient(null);
      }
    });

    const unsubNetwork = modal.subscribeNetwork((netState: any) => {
      if (netState.chainId === undefined) return;
      const net = chainIdToNetwork(netState.chainId);
      setNetwork(net);
      setStoredNetwork(net);
    });

    return () => {
      unsubAccount();
      unsubNetwork();
    };
  }, []);

  // Rebuild the genlayer-js client whenever the connected address or active
  // network changes, using the actual Reown-provided EIP-1193 provider so
  // writes are signed through the connected wallet. getWalletProvider() can
  // briefly lag right after a fresh connection (subscribeAccount fires before
  // AppKit's internal ProviderController finishes registering the provider),
  // so retry a few times before giving up rather than silently leaving
  // client null.
  useEffect(() => {
    const modal = getAppKit();
    if (!modal || !address) {
      setClient(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tryBuild = () => {
      if (cancelled) return;
      const provider = modal.getWalletProvider();
      if (provider) {
        setClient(createClient({ chain: NETWORKS[network].chain, account: address as `0x${string}`, provider }));
        return;
      }
      attempts += 1;
      if (attempts < 10) {
        setTimeout(tryBuild, 300);
      } else {
        console.error('Wallet provider never became available after connecting.');
        setClient(null);
      }
    };

    tryBuild();
    return () => { cancelled = true; };
  }, [address, network]);

  const connect = useCallback(() => {
    const modal = getAppKit();
    if (!modal) {
      console.error('Reown AppKit is not configured - set VITE_REOWN_PROJECT_ID to enable wallet connect.');
      return;
    }
    setIsConnecting(true);
    modal.open().finally(() => setIsConnecting(false));
  }, []);

  const disconnect = useCallback(() => {
    getAppKit()?.disconnect().catch(() => {});
    setAddress('');
    setClient(null);
  }, []);

  // Opens Reown's native Account view - balance, address, network, disconnect -
  // the same view the wallet button opens in any Reown-powered app.
  const openAccount = useCallback(() => {
    getAppKit()?.open({ view: 'Account' });
  }, []);

  const switchNetwork = useCallback((target: NetworkId) => {
    const modal = getAppKit();
    if (!modal) {
      setNetwork(target);
      setStoredNetwork(target);
      return;
    }
    const appKitNetwork = target === 'studionet' ? REOWN_NETWORKS[1] : REOWN_NETWORKS[0];
    modal.switchNetwork(appKitNetwork).catch((err: any) => console.error('Network switch failed:', err));
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        displayAddress: address ? truncateAddress(address) : '',
        client,
        isConnected: !!address,
        isConnecting,
        connect,
        disconnect,
        openAccount,
        network,
        switchNetwork,
        reownReady,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
}
