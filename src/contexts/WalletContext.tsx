import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createClient } from 'genlayer-js';
import { testnetAsimov } from 'genlayer-js/chains';
import { WalletPickerModal } from '@/components/WalletPickerModal';

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
}

function detectProviders(): DetectedProvider[] {
  if (typeof window === 'undefined') return [];
  const ethereum = (window as any).ethereum;
  if (!ethereum) return [];

  const identify = (p: any): string =>
    p.isMetaMask ? 'MetaMask'
    : p.isCoinbaseWallet ? 'Coinbase Wallet'
    : p.isBraveWallet ? 'Brave Wallet'
    : p.isTrust ? 'Trust Wallet'
    : p.isRabby ? 'Rabby'
    : p.isPhantom ? 'Phantom'
    : 'Browser Wallet';

  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    return ethereum.providers.map((p: any) => ({ name: identify(p), provider: p }));
  }

  return [{ name: identify(ethereum), provider: ethereum }];
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('');
  const [client, setClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingProviders, setPendingProviders] = useState<DetectedProvider[]>([]);

  const buildClient = useCallback((addr: string, provider: any) => {
    // provider is required so writes are signed through the connected browser wallet
    const c = createClient({ chain: testnetAsimov, account: addr as `0x${string}`, provider });
    // Switches (or prompts to add) the wallet's active chain to GenLayer Asimov Testnet.
    // Required before writeContract/deployContract will work through a browser wallet.
    c.connect('testnetAsimov').catch((err: any) =>
      console.error('Failed to switch wallet to GenLayer Asimov Testnet:', err)
    );
    return c;
  }, []);

  useEffect(() => {
    const provider = activeProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(''); setClient(null); setProviderName('');
      } else {
        setAddress(accounts[0]); setClient(buildClient(accounts[0], provider));
      }
    };
    const handleChainChanged = () => window.location.reload();

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);
    provider.request?.({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) { setAddress(accounts[0]); setClient(buildClient(accounts[0], provider)); }
    }).catch(() => {});

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [buildClient, activeProvider]);

  const connectWithProvider = useCallback(async (detected: DetectedProvider) => {
    setIsConnecting(true);
    try {
      const accounts: string[] = await detected.provider.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setClient(buildClient(accounts[0], detected.provider));
        setActiveProvider(detected.provider);
        setProviderName(detected.name);
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [buildClient]);

  const connect = useCallback(async () => {
    const detected = detectProviders();
    setPendingProviders(detected);
    setPickerOpen(true);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(''); setClient(null); setProviderName(''); setActiveProvider(null);
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
        account: address,
        providerName,
      }}
    >
      {children}
      <WalletPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        providers={pendingProviders}
        onSelect={(p) => connectWithProvider(p)}
      />
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
}
