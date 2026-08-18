// Local registry of deployed TaskVerifier contract addresses.
// There is no on-chain factory/index contract, so task discovery for the
// board is tracked client-side per browser.

const STORAGE_KEY = 'proofwork-task-registry';

export interface RegisteredTask {
  contractAddress: string;
  deployedAt: number;
}

export function listRegisteredTasks(): RegisteredTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function registerTask(contractAddress: string): void {
  const tasks = listRegisteredTasks();
  if (tasks.some((t) => t.contractAddress.toLowerCase() === contractAddress.toLowerCase())) return;
  tasks.push({ contractAddress, deployedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
