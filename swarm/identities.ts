import { generatePrivateKey, createAccount } from 'genlayer-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Persona } from './personas';

const IDENTITIES_FILE = join(dirname(fileURLToPath(import.meta.url)), '.identities.json');

interface StoredIdentity {
  name: string;
  privateKey: `0x${string}`;
  address: string;
}

export interface Identity extends StoredIdentity {
  persona: Persona;
}

// Generates a keypair per persona on first run and persists it locally
// (gitignored - see .gitignore) so restarts reuse the same on-chain identity
// instead of abandoning a funded/registered address. Nothing here ever leaves
// this file; unlike Polaris's Circle-custody swarm, GenLayer accounts are plain
// local keys, so this file *is* the wallet.
//
// On a host with no writable local disk to persist to (e.g. Railway), set
// SWARM_IDENTITIES_JSON to the same array shape this file stores - the keys
// then live only in that platform's secret store, never written to disk here.
export function loadOrCreateIdentities(personas: Persona[]): Identity[] {
  const envSource = process.env.SWARM_IDENTITIES_JSON;
  const stored: StoredIdentity[] = envSource
    ? JSON.parse(envSource)
    : existsSync(IDENTITIES_FILE)
      ? JSON.parse(readFileSync(IDENTITIES_FILE, 'utf8'))
      : [];
  const byName = new Map(stored.map((s) => [s.name, s]));

  const result: Identity[] = personas.map((persona) => {
    let entry = byName.get(persona.name);
    if (!entry) {
      const privateKey = generatePrivateKey();
      const account = createAccount(privateKey);
      entry = { name: persona.name, privateKey, address: account.address };
    }
    return { ...entry, persona };
  });

  if (!envSource) {
    writeFileSync(
      IDENTITIES_FILE,
      JSON.stringify(
        result.map(({ name, privateKey, address }) => ({ name, privateKey, address })),
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }

  return result;
}
