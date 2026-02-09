import { createClient, createAccount } from 'genlayer-js';
import { testnetAsimov } from 'genlayer-js/chains';

const STORAGE_KEY = 'genlayer-quest-account';

export function getOrCreateAccount() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through to create new
    }
  }
  const account = createAccount();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  return account;
}

export function getClient(account?: ReturnType<typeof createAccount>) {
  return createClient({
    chain: testnetAsimov,
    ...(account ? { account } : {}),
  });
}

export function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
