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
  account: any;
  providerName: string;
}

const WalletContext = createContext<WalletContextType | null>(null);

function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface DetectedProvider {
  name: string;
  provider: any;
  icon?: string;
}

function detectProviders(): DetectedProvider[] {
  if (typeof window === 'undefined') return [];

  const providers: DetectedProvider[] = [];
  const ethereum = (window as any).ethereum;
  if (!ethereum) return [];

  // EIP-6963: check for multiple injected providers
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    for (const p of ethereum.providers) {
      const name = p.isMetaMask ? 'MetaMask'
        : p.isCoinbaseWallet ? 'Coinbase Wallet'
        : p.isBraveWallet ? 'Brave Wallet'
        : p.isTrust ? 'Trust Wallet'
        : p.isRabby ? 'Rabby'
        : p.isPhantom ? 'Phantom'
        : 'Wallet';
      providers.push({ name, provider: p });
    }
    return providers;
  }

  // Single provider fallback
  const name = ethereum.isMetaMask ? 'MetaMask'
    : ethereum.isCoinbaseWallet ? 'Coinbase Wallet'
    : ethereum.isBraveWallet ? 'Brave Wallet'
    : ethereum.isTrust ? 'Trust Wallet'
    : ethereum.isRabby ? 'Rabby'
    : ethereum.isPhantom ? 'Phantom'
    : 'Browser Wallet';
  providers.push({ name, provider: ethereum });
  return providers;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('');
  const [client, setClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [activeProvider, setActiveProvider] = useState<any>(null);

  const buildClient = useCallback((addr: string) => {
    return createClient({
      chain: testnetAsimov,
      account: addr as `0x${string}`,
    });
  }, []);

  // Listen for account/chain changes on the active provider
  useEffect(() => {
    const provider = activeProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress('');
        setClient(null);
        setProviderName('');
      } else {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    // Check if already connected
    provider.request?.({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
      }
    }).catch(() => {});

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [buildClient, activeProvider]);

  const connectWithProvider = useCallback(async (provider: any, name: string) => {
    setIsConnecting(true);
    try {
      const accounts: string[] = await provider.request({
        method: 'eth_requestAccounts',
      });
      if (accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        setClient(buildClient(addr));
        setActiveProvider(provider);
        setProviderName(name);
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [buildClient]);

  const connect = useCallback(async () => {
    const detected = detectProviders();

    if (detected.length === 0) {
      // No wallet found — open a helpful page
      window.open('https://ethereum.org/en/wallets/', '_blank');
      return;
    }

    if (detected.length === 1) {
      await connectWithProvider(detected[0].provider, detected[0].name);
      return;
    }

    // Multiple wallets: let user pick via simple prompt
    // In a production app you'd use a modal, but this works for all EVM wallets
    const names = detected.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
    const choice = window.prompt(`Multiple wallets detected. Enter number:\n\n${names}`);
    if (choice) {
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < detected.length) {
        await connectWithProvider(detected[idx].provider, detected[idx].name);
      }
    }
  }, [connectWithProvider]);

  const disconnect = useCallback(() => {
    setAddress('');
    setClient(null);
    setProviderName('');
    setActiveProvider(null);
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
        account: address,
        providerName,
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
