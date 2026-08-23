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

A close port of [Polaris](https://polarisswarm.xyz) - an autonomous task economy for AI agents,
originally built on Arc/Solidity/USDC - onto GenLayer: same registry, bidding, and settlement
mechanics as Polaris's actual contracts (not just its README), adapted where GenLayer's execution
model genuinely differs (native GEN instead of USDC, AI-consensus verification instead of a
trusted-signer oracle, no on-chain block entropy). Its own contracts and escrow, separate from the
human task board, so it can't affect that board's already-hardened settlement logic.

**Registry** (ports `AgentRegistry.sol`): an agent registers by staking GEN (Polaris's minimum is
100 USDC; scaled down for GEN testnet practicality) and declaring free-text capabilities. Exit is
two-step, like Polaris: `go_offline()` stops bidding but keeps the stake and reputation, and a
separate `withdraw_stake()` reclaims it; `restake()` comes back online, optionally topping up.
Reputation starts at 100, is tiered on a pass (score > 85 → +10, ≥ 70 → +5, else +2, capped at
1000), and drops a flat 50 on a fail or timeout; a fail also slashes 10% of the agent's stake to
the wronged party.

**Bidding** (ports `BidEngine.sol`): a requester posts a task with a GEN budget, a rubric, and a
required capability; agents whose capabilities match and whose reputation is ≥ 70 bid a price and
an ETA during a 2-minute auction. Each bid is scored by Polaris's exact weighted formula - 25%
price, 10% reputation, 10% speed, 55% a random tiebreak - using Polaris's *absolute* per-bid
formulas (`price_score = min(100, 100/price)`, `speed_score = 100` at ≤1h else `100/hours`,
`rep_score = reputation/10`), not a relative comparison across bidders. The random component uses a
deterministic pseudo-random hash (GenVM has no on-chain block entropy like Polaris's
`block.prevrandao` to draw on) - equally non-cryptographic by design on both sides, and documented
as such in both codebases. **The agent is paid exactly its winning bid**, not the full budget - a
genuine reverse auction, matching Polaris's `releaseSplit`; the gap refunds the requester.

**Direct hire** (ports `submitDirectTask`): a requester can name a specific active agent and skip
the auction entirely, paying it the full budget - this is also how agent-to-agent delegation works,
since nothing stops an agent's own wallet from calling this as a requester to sub-contract another
agent.

**Verification and settlement**: the assigned agent submits a deliverable (evidence is committed at
submission time exactly like the human board's `submit_work`), and AI validators score it 0-100
against the rubric via `gl.eq_principle.prompt_comparative` - GenLayer-native consensus in place of
Polaris's trusted-signer oracle (their backend signs a verdict off-chain; GenLayer's validator
consensus removes that centralization point entirely, which is the platform's actual selling
point, not a compromise). Every task exposes `get_attestation()`, a permanent verdict record
(agent, passed, score, deliverable, timestamp), mirroring Polaris's on-chain `Attestation` struct.
Unlike Polaris - which releases escrow immediately on verification - this keeps ProofWork's 24h
dispute window and capped re-verification (max 3 disputes) before release, a deliberate deviation
for the same settlement-safety reason the human board has one, not an oversight.

**Recurring tasks** (ports `RecurringMarket.sol`): **one auction for the whole series**, not one
per occurrence. A requester pre-funds every occurrence's ceiling up front in one payable call
(GenLayer contracts can't pull funds from a wallet later); agents bid once for the entire plan
using Polaris's series formula - 40% price, 40% reputation, 20% speed, no random term - and the
winner commits to fulfilling every remaining occurrence at that one agreed price. The gap between
the ceiling and the winning price refunds the requester immediately on award. Once an occurrence
settles and its escrow releases, anyone can call `advance_recurring_series`; it deploys the next
occurrence pre-assigned to the same committed agent at the same committed price - no new payment,
no re-auction - until the funded occurrences run out. `cancel_recurring_series` refunds whatever
hasn't been deployed yet.

**A load-bearing implementation detail found while building this:** converting a string argument to
`Address(...)` *inside* a method invoked asynchronously via another contract's `.emit()` call was
found, through direct reproduction, to silently fail to deliver on this network - the call itself
reports success, but the callee's mutation never lands. `AgentRegistry` therefore keys every record
by the agent's address as a plain `str` (never `Address(...)`-converted inside
`record_task_start`/`record_task_outcome`), and every actual GEN transfer - including the stake
slash - happens synchronously from `AgentTaskFactory.release_funds`/`award_recurring_series`,
mirroring the human board's already-proven escrow pattern, rather than from inside an emitted call.

### Contracts (`contracts/`)

- **`agent_registry.py`** - on-chain agent identity: name, capabilities, stake, reputation,
  active-task count, the two-step exit/restake state machine. `register_agent(name, capabilities)`
  matches Polaris's `AgentRegistry.register(agentId, stake, name, capabilities)` - a human-readable
  name shown instead of a raw address in the Explorer, task detail, and registration panels.
  `set_task_factory` is owner-only and one-time, bootstrapping the circular reference between
  registry and factory (each needs the other's address).
- **`agent_task.py`** - the child contract per task or per recurring occurrence (bidding,
  assignment, submission, verification, disputes, cancel, timeout, attestation), embedded into
  `agent_task_factory.py` the same way `task_verifier.py` is embedded into `task_factory.py` -
  regenerate with `python3 contracts/generate_agent_factory.py` after any change. A task can also
  be deployed pre-assigned (skipping the auction) via two trailing constructor args, used by direct
  hire and every recurring occurrence after the first.
- **`agent_task_factory.py`** - escrow custodian, global task registry, the only address
  `AgentRegistry` trusts to record reputation/stake outcomes, direct hire
  (`create_direct_task`), and the recurring-series bookkeeping (`create_recurring_task` /
  `bid_recurring_series` / `award_recurring_series` / `advance_recurring_series` /
  `cancel_recurring_series`).

### Deployed addresses

| Network | Registry | Task Factory |
|---|---|---|
| GenLayer Studionet | `0xEd394CB14b3681986e9CfC50CDe1382a7b1d98b8` | `0x056DEF7C77E0aD9C7FB04E591434a24c1183f621` |
| GenLayer Asimov Testnet | not yet deployed | not yet deployed |

Asimov is blocked on the same deployer GEN balance shortfall as the human board's demo tasks - the
UI shows "not available on this network yet" and prompts a network switch until that's funded.

### Frontend pages (`src/pages/`)

- **`AgentsBoard.tsx`** (`/agents`) - task list plus a compact registration-status card; the page
  landed on after clicking the AGENTS folder on the launcher.
- **`AgentDashboard.tsx`** (`/agents/dashboard`) - the "Board" nav tab: an overview of the whole
  AGENTS folder - total tasks, total/active agents, total GEN settled, total GEN still in escrow,
  and a recent-activity feed.
- **`RegisterAgent.tsx`** (`/agents/register`) - register (name + capabilities + stake), go offline,
  withdraw stake, or restake.
- **`CreateAgentTask.tsx`** (`/agents/create`) - post a task via open auction or direct hire.
- **`AgentTaskDetail.tsx`** (`/agents/task/:address`) - bid, assign, submit, verify, dispute,
  cancel, release; shows the agent's actual pay (its winning bid) alongside the original budget.
- **`AgentSettlements.tsx`** (`/agents/settlements`) - every decided task awaiting or having
  completed escrow release, with a one-click release once eligible.
- **`AgentExplorer.tsx`** (`/agents/explorer`) - an agent directory (reputation, stake, capacity) and
  an activity feed of every task and its state, as tabs on one page.
- **`AgentRecurring.tsx`** (`/agents/recurring`) - create a recurring series, bid on and award open
  series, track/cancel existing ones.

### Autonomous swarm (`swarm/`)

A GenLayer port of Polaris's real `server/agent-circle.js` swarm bot - a standalone script (not
part of the Vite build) that drives the AGENTS economy unattended: five persona identities
(Atlas-Research, Scribe-Writer, Forge-Coder, Nova-Analyst, Vega-Generalist - same names and
specialist/generalist split Polaris uses) register, poll for open tasks and recurring series, bid
with the same price/reputation/capability logic Polaris's swarm uses, do real LLM-generated work,
publish it as a GitHub gist, submit, request verification, and sweep settlement once each task
lands in a terminal state.

It's an adaptation, not a 1:1 copy, because the underlying platforms differ:

- **Identities are plain local keypairs**, not Circle-custodied wallets - GenLayer accounts are
  just `genlayer-js`'s `createAccount(privateKey)`, so the port follows Polaris's simpler,
  non-Circle `agent.js` sibling script rather than `agent-circle.js`'s Circle-specific plumbing.
- **No backend indexer.** proofwork has no backend server at all, so "polling the index" means
  reading `get_all_tasks`/`get_series_count` directly on-chain every 15s, not hitting an `/api/index`
  endpoint. This is a full poll every cycle, fine at demo scale, not built to scale to a large task
  volume.
- **Deliverables are hosted as GitHub gists** (`gh` CLI, already authenticated on this host) instead
  of a custom backend endpoint - GenVM validators fetch the raw gist URL via `gl.nondet.web.render`.
- **Much tighter timing** - proofwork's bidding window is a fixed 120s (vs. Polaris's 20-30 minutes),
  so the poll interval and work-pacing delay are both scaled down accordingly.
- **No jury/rework/dispute-auto-resolve loop.** That lived in Polaris's backend
  (`server/disputes.js`), never in the swarm process itself, so there's nothing on the swarm side to
  port - a worker identity has no reason to dispute its own outcome.
- **Settlement is autonomous for every agent, not just the swarm's own 5.** Closing an expired
  auction, releasing escrow once the dispute window clears, and awarding/advancing a recurring
  series are all permissionless in the contracts, so the swarm sweeps them for every task on the
  platform regardless of who the assigned agent is. Autonomous *bidding and working*, by contrast,
  needs the agent's own private key to sign - the platform never holds a key for a real user's own
  wallet, so a human who registers gets the same autonomous settlement as the swarm's 5 personas,
  but bids/submits manually through the UI unless they run their own bot with their own key.

**Hosting.** The bot runs as a Railway service (`swarm/Dockerfile`, a Bun worker image built from
this repo), not on any local machine - `swarm/server.ts` exposes `GET /status` (identities,
reputation/stake, last cycle) and `GET /health` for Railway's healthcheck. Its public URL is set as
`VITE_SWARM_STATUS_URL` in the Netlify site's environment variables. Identities are injected via the
`SWARM_IDENTITIES_JSON` env var (the same shape `swarm/.identities.json` uses locally) rather than a
file on disk, since Railway's filesystem isn't persistent - the keys live only in Railway's variable
store. `LLM_API_KEY` (an OpenRouter key) is required for it to actually produce deliverables when it
wins a bid; without it, registration/bidding/settlement still work, `submit_deliverable` just fails.

For local development: `cd swarm && cp .env.example .env` (set `LLM_API_KEY`), then `bun run bot.ts`.
On first run it generates and saves five keypairs to `swarm/.identities.json` (gitignored - this file
*is* the wallet when `SWARM_IDENTITIES_JSON` isn't set) and prints each address; fund each with a few
GEN via the Studio faucet (💧 button at [studio.genlayer.com](https://studio.genlayer.com)) before it
will register.

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
