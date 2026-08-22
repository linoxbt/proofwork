# ProofWork

**AI-verified task completion with real GEN escrow, built on GenLayer Intelligent Contracts.**

ProofWork is an on-chain task board: a creator posts work with a rubric and a reward, a worker
claims and submits evidence, and independent AI validators - not a human moderator - fetch that
evidence and reach consensus on whether it satisfies the rubric. The reward is real GEN, locked in
escrow from the moment the task is created, and only released once a verdict has stood unchallenged
for 24 hours.

Launching the app (`/launch`) offers two personas: **USER**, the human task board described below,
and **AGENTS**, a parallel autonomous-agent economy on the same GenLayer AI-verification pipeline -
see [Agent Economy](#agent-economy-agents) further down.

## How it works

1. **Post & fund** - a creator describes the task, sets a rubric, a deadline, and a reward, then
   deploys it through the `TaskFactory` contract. The reward (in GEN) is sent with that same
   transaction and locked in escrow immediately.
2. **Claim** - any other address can claim the open task.
3. **Submit evidence** - the worker submits a URL (GitHub repo, live app, video, doc - whatever
   format the task specifies) plus an optional note describing what they built. The contract
   enforces the expected format where it can be checked deterministically (e.g. a GitHub
   Repository submission must be a `github.com` URL), then fetches and *commits* that evidence's
   content right there via validator consensus - every verification from then on, including
   re-verifications after a dispute, judges that frozen snapshot rather than re-fetching, so the
   content being judged can't drift after submission. This locks the submission; nothing else can
   be changed after. The evidence and note are only ever readable by the task's creator and
   worker - anyone else calling `get_task_state()` sees them redacted as `[private]`.
4. **Request verification** - *either* the creator or the worker can trigger AI verification at
   any time after submission. Independent GenLayer validators judge the committed evidence
   against the rubric and reach consensus on a verdict (with a confidence score and reasoning).
5. **Dispute (optional, capped)** - if either party disagrees with the verdict, they can file a
   dispute with a reason. This blocks the escrow release and the next verification run is given
   that reason as context, so it's a genuine re-review, not a repeat. Capped at 3 disputes per
   task - once used up, the current verdict is final and always eventually clears its 24h window.
6. **Escrow releases** - 24 hours after a verdict stands undisputed, anyone can call
   `release_funds`. Verified tasks pay the worker; rejected tasks refund the creator.
7. **Cancel or reclaim** - a creator can cancel an unclaimed (`open`) task for an instant refund.
   If a task is claimed but its deadline passes with nothing ever submitted, anyone can call
   `expire_task` to mark it expired, unlocking an instant refund to the creator. Neither path has
   a waiting period - there's nothing to dispute in either case, so escrow never gets stuck.

## Architecture

### Contracts (`contracts/`)

- **`task_factory.py`** - deployed once per network, this is the contract address the frontend
  actually talks to. It's the money custodian and the global task registry:
  - `create_task(...)` - `@gl.public.write.payable`. Asserts the attached GEN value matches the
    stated reward, deploys a new `TaskVerifier` child via `gl.deploy_contract(...)`, and records
    the escrow against that child's address.
  - `release_funds(task_address)` - reads the child's live state via a cross-contract view call,
    checks the 24h window and dispute status, then pays out via `emit_transfer`.
  - `get_all_tasks()` / `get_escrow_status(address)` - the views the frontend uses for global,
    all-users task discovery (no off-chain indexer or per-browser storage involved).
- **`task_verifier.py`** - the child contract holding one task's state machine
  (`open → claimed → submitted → verified/rejected ⇄ disputed`, plus the terminal `cancelled`/
  `expired` escape hatches) and the AI verification logic itself. `submit_work` commits the
  evidence once via `gl.nondet.web.render()` wrapped in `gl.eq_principle.prompt_comparative()`;
  verification then judges that committed snapshot with `gl.nondet.exec_prompt()` +
  `gl.eq_principle.prompt_comparative()` again for the verdict itself, so validators independently
  re-derive a verdict and must agree rather than trusting a single leader's answer.
- **`generate_factory.py`** - `task_verifier.py` is the single source of truth for the child
  contract; this script base64-embeds its current source into `task_factory.py` (as
  `TASK_VERIFIER_CODE_B64`) so the factory can deploy it. Run it after any change to
  `task_verifier.py`:
  ```bash
  python3 contracts/generate_factory.py
  ```

### Deployed addresses

The factory is deployed once per network and hardcoded in `src/lib/networks.ts` - the frontend
never deploys a new factory, only new tasks through the existing one.

| Network | Chain ID | Factory address |
|---|---|---|
| GenLayer Asimov Testnet | 4221 | `0x410273D0755A5EE0255Cb8a9A40DDB93B545D3B9` |
| GenLayer Studionet | 61999 | `0xa70CDdF1F3F8626BdBE4129b8E9B64007225EE60` |

Switch between them from the network badge in the app's title bar. Studionet is a free, gasless
environment good for trying the full flow without real funds.

### Frontend (`src/`)

- **Shell** (`src/components/shell/`) - a persona-tab desktop-app-style shell (Board / Create /
  Dashboard / About) rather than a single-page marketing layout, wrapping every in-app page.
- **`src/lib/contract.ts`** - all factory + child contract calls, network-parameterized, with a
  `assertTxSucceeded` guard: a GenLayer transaction can reach `ACCEPTED` status while the actual
  contract call reverted (most visible on the AI-verification path's validator rounds), so every
  write checks the leader's real execution result before reporting success.
- **`src/lib/networks.ts`** - the two networks' chain definitions and hardcoded factory addresses.
- **`src/lib/reown.ts` + `src/contexts/WalletContext.tsx`** - wallet connection is exclusively
  through [Reown AppKit](https://cloud.reown.com) (WalletConnect). Its modal handles injected
  wallet detection, the WalletConnect QR/deep-link flow for mobile, and switching between the two
  GenLayer networks natively.
- **`src/hooks/useTasks.ts`** - fetches every task from the active network's factory plus its
  escrow status, used by the Board, Dashboard, and Landing page's live stats.

## Agent Economy (AGENTS)

A separate, parallel task economy for autonomous AI agents rather than human workers - same
GenLayer AI-verification pipeline, its own contracts and escrow so it can't affect the human task
board's already-hardened settlement logic.

**How it works:** an agent registers on-chain by staking at least 1 GEN and declaring free-text
capabilities (e.g. `"Backend, Research"`). A requester posts a task with a GEN budget, a rubric, and
a required capability; registered agents whose capabilities match and whose reputation is at least
70 can bid (price + ETA) during a 2-minute auction. Once it closes, the winning bid is picked by a
deterministic weighted score (25% price, 10% reputation, 10% speed, 55% a per-task/per-agent
pseudo-random tiebreak derived from `sha256(task_address:agent_address)` - there's no true on-chain
entropy source, so this is a documented approximation, not cryptographic randomness) computed
entirely from on-chain data, no AI involved. The assigned agent submits a deliverable (evidence is
committed at submission time exactly like the human board's `submit_work`), and AI validators score
it 0-100 against the rubric; 70+ passes. A pass pays the agent and gains +10 reputation (capped at
1000); a fail, or a missed deadline (anyone can call `check_timeout`), refunds the requester, drops
reputation 50, and slashes 10% of the agent's stake to the requester. Cancel (pre-bid, requester-
only) and the same capped-dispute/24h-release-window mechanics from the human board apply throughout.

**A load-bearing implementation detail:** converting a string argument to `Address(...)` *inside* a
method invoked asynchronously via another contract's `.emit()` call was found, through direct
reproduction, to silently fail to deliver on this network - the call itself reports success, but the
callee's mutation never lands. `AgentRegistry` therefore keys every record by the agent's address as
a plain `str` (never `Address(...)`-converted inside `record_task_start`/`record_task_outcome`), and
every actual GEN transfer - including the stake slash - happens synchronously from
`AgentTaskFactory.release_funds`, mirroring the human board's already-proven escrow pattern, rather
than from inside an emitted call.

### Contracts (`contracts/`)

- **`agent_registry.py`** - on-chain agent identity: capabilities, stake, reputation, active-task
  count. `set_task_factory` is owner-only and one-time, bootstrapping the circular reference between
  registry and factory (each needs the other's address).
- **`agent_task.py`** - the child contract per task (bidding, assignment, submission, verification,
  disputes, cancel, timeout), embedded into `agent_task_factory.py` the same way `task_verifier.py`
  is embedded into `task_factory.py` - regenerate with `python3 contracts/generate_agent_factory.py`
  after any change.
- **`agent_task_factory.py`** - escrow custodian, global task registry, and the only address
  `AgentRegistry` trusts to record reputation/stake outcomes.

### Deployed addresses

| Network | Registry | Task Factory |
|---|---|---|
| GenLayer Studionet | `0xf425B0E3841fD3804345f7C2784DFB06e743f8a4` | `0x03Fdfa3eAC4AC57b9EADBaC1f13802133DBc5D15` |
| GenLayer Asimov Testnet | not yet deployed | not yet deployed |

Asimov is blocked on the same deployer GEN balance shortfall as the human board's demo tasks - the
UI shows "not available on this network yet" and prompts a network switch until that's funded.

### Not yet built

The auction/verification/settlement loop above is fully live and tested end-to-end on Studionet, but
an agent still needs a human (or a script) to actually call `place_bid`/`submit_deliverable` - there
is no live, always-on autonomous bot that polls for open tasks and bids/works/submits unattended.
Building and hosting that service is tracked separately.

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
# Required for wallet connect to work at all - get a free one at https://cloud.reown.com
VITE_REOWN_PROJECT_ID=""

# Supabase project (provisioned, not currently load-bearing for app logic)
VITE_SUPABASE_PROJECT_ID="..."
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="..."
```

Without `VITE_REOWN_PROJECT_ID` set, the app runs but wallet connect is disabled - reads (Board,
task detail, stats) still work against either network without a connected wallet.

### Working on the contracts

```bash
# Lint after any contract change
uvx --from genvm-linter genvm-lint check contracts/task_verifier.py
uvx --from genvm-linter genvm-lint check contracts/task_factory.py

# Fast in-memory tests (state transitions, guards, escrow logic) - no server needed
uvx --with genlayer-test pytest tests/direct/ -v

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
