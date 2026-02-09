import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createClient } from 'genlayer-js';
import { testnetAsimov } from 'genlayer-js/chains';

interface WalletContextType {
  address: string;
  displayAddress: string;
  client: any;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  account: any; // kept for backward compat
}

const WalletContext = createContext<WalletContextType | null>(null);

function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEthereum(): any | null {
  return typeof window !== 'undefined' ? (window as any).ethereum : null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('');
  const [client, setClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const buildClient = useCallback((addr: string) => {
    return createClient({
      chain: testnetAsimov,
      account: addr as `0x${string}`, // pass address string for MetaMask signing
    });
  }, []);

  // Listen for account changes
  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress('');
        setClient(null);
      } else {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
      }
    };

    const handleChainChanged = () => {
      // Reload on chain change to avoid stale state
      window.location.reload();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
      }
    }).catch(() => {});

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [buildClient]);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts: string[] = await ethereum.request({
        method: 'eth_requestAccounts',
      });
      if (accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [buildClient]);

  const disconnect = useCallback(() => {
    setAddress('');
    setClient(null);
  }, []);

  const isConnected = !!address;
  const displayAddress = address ? truncateAddress(address) : '';

  return (
    <WalletContext.Provider
      value={{
        address,
        displayAddress,
        client,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        account: address, // backward compat
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
