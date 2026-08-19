# ProofWork

**AI-verified task completion with real GEN escrow, built on GenLayer Intelligent Contracts.**

ProofWork is an on-chain task board: a creator posts work with a rubric and a reward, a worker
claims and submits evidence, and independent AI validators — not a human moderator — fetch that
evidence and reach consensus on whether it satisfies the rubric. The reward is real GEN, locked in
escrow from the moment the task is created, and only released once a verdict has stood unchallenged
for 24 hours.

## How it works

1. **Post & fund** — a creator describes the task, sets a rubric, a deadline, and a reward, then
   deploys it through the `TaskFactory` contract. The reward (in GEN) is sent with that same
   transaction and locked in escrow immediately.
2. **Claim** — any other address can claim the open task.
3. **Submit evidence** — the worker submits a URL (GitHub repo, live app, video, doc — whatever
   format the task specifies). This locks the submission; nothing else can be changed after.
4. **Request verification** — *either* the creator or the worker can trigger AI verification at
   any time after submission. Independent GenLayer validators fetch the evidence fresh, judge it
   against the rubric, and reach consensus on a verdict (with a confidence score and reasoning).
5. **Dispute (optional)** — if either party disagrees with the verdict, they can file a dispute
   with a reason. This blocks the escrow release and the next verification run is given that
   reason as context, so it's a genuine re-review, not a repeat.
6. **Escrow releases** — 24 hours after a verdict stands undisputed, anyone can call
   `release_funds`. Verified tasks pay the worker; rejected tasks refund the creator.

## Architecture

### Contracts (`contracts/`)

- **`task_factory.py`** — deployed once per network, this is the contract address the frontend
  actually talks to. It's the money custodian and the global task registry:
  - `create_task(...)` — `@gl.public.write.payable`. Asserts the attached GEN value matches the
    stated reward, deploys a new `TaskVerifier` child via `gl.deploy_contract(...)`, and records
    the escrow against that child's address.
  - `release_funds(task_address)` — reads the child's live state via a cross-contract view call,
    checks the 24h window and dispute status, then pays out via `emit_transfer`.
  - `get_all_tasks()` / `get_escrow_status(address)` — the views the frontend uses for global,
    all-users task discovery (no off-chain indexer or per-browser storage involved).
- **`task_verifier.py`** — the child contract holding one task's state machine
  (`open → claimed → submitted → verified/rejected ⇄ disputed`) and the AI verification logic
  itself, using `gl.nondet.web.render()` to fetch evidence and `gl.nondet.exec_prompt()` +
  `gl.eq_principle.prompt_comparative()` for the actual judgment, so validators independently
  re-derive a verdict and must agree rather than trusting a single leader's answer.
- **`generate_factory.py`** — `task_verifier.py` is the single source of truth for the child
  contract; this script base64-embeds its current source into `task_factory.py` (as
  `TASK_VERIFIER_CODE_B64`) so the factory can deploy it. Run it after any change to
  `task_verifier.py`:
  ```bash
  python3 contracts/generate_factory.py
  ```

### Deployed addresses

The factory is deployed once per network and hardcoded in `src/lib/networks.ts` — the frontend
never deploys a new factory, only new tasks through the existing one.

| Network | Chain ID | Factory address |
|---|---|---|
| GenLayer Asimov Testnet | 4221 | `0x5e005Fb91dc48F50d737C1F29F4D52F768898018` |
| GenLayer Studionet | 61999 | `0x685A79DD47EA5354aD98f7A1e5329Aa276AF7ffe` |

Switch between them from the network badge in the app's title bar. Studionet is a free, gasless
environment good for trying the full flow without real funds.

### Frontend (`src/`)

- **Shell** (`src/components/shell/`) — a persona-tab desktop-app-style shell (Board / Create /
  Dashboard / About) rather than a single-page marketing layout, wrapping every in-app page.
- **`src/lib/contract.ts`** — all factory + child contract calls, network-parameterized, with a
  `assertTxSucceeded` guard: a GenLayer transaction can reach `ACCEPTED` status while the actual
  contract call reverted (most visible on the AI-verification path's validator rounds), so every
  write checks the leader's real execution result before reporting success.
- **`src/lib/networks.ts`** — the two networks' chain definitions and hardcoded factory addresses.
- **`src/lib/reown.ts` + `src/contexts/WalletContext.tsx`** — wallet connection is exclusively
  through [Reown AppKit](https://cloud.reown.com) (WalletConnect). Its modal handles injected
  wallet detection, the WalletConnect QR/deep-link flow for mobile, and switching between the two
  GenLayer networks natively.
- **`src/hooks/useTasks.ts`** — fetches every task from the active network's factory plus its
  escrow status, used by the Board, Dashboard, and Landing page's live stats.

## Tech stack

- React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui, Framer Motion
- `genlayer-js` for all contract reads/writes
- `@reown/appkit` + `@reown/appkit-adapter-ethers` for wallet connection
- Python (GenVM) intelligent contracts, deployed via the `genlayer` CLI

## Local development

```bash
bun install       # or npm install
bun run dev        # or npm run dev
```

### Environment variables (`.env`)

```bash
# Required for wallet connect to work at all — get a free one at https://cloud.reown.com
VITE_REOWN_PROJECT_ID=""

# Supabase project (provisioned, not currently load-bearing for app logic)
VITE_SUPABASE_PROJECT_ID="..."
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="..."
```

Without `VITE_REOWN_PROJECT_ID` set, the app runs but wallet connect is disabled — reads (Board,
task detail, stats) still work against either network without a connected wallet.

### Working on the contracts

```bash
# Lint after any contract change
uvx --from genvm-linter genvm-lint check contracts/task_verifier.py
uvx --from genvm-linter genvm-lint check contracts/task_factory.py

# Re-embed task_verifier.py into task_factory.py after editing the former
python3 contracts/generate_factory.py

# Deploy (see GenLayer CLI docs for account/network setup)
genlayer deploy --contract contracts/task_factory.py
```

If you deploy a new factory, update the address in `src/lib/networks.ts` and this README.

## Deploying the frontend

A `netlify.toml` is included with a SPA redirect (`/* → /index.html`) so client-side routes like
`/create` or `/task/:address` don't 404 on a direct load or refresh. Set `VITE_REOWN_PROJECT_ID` in
your host's environment variables.

## License

MIT
