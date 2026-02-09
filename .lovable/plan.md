
# 🔍 TaskVerify — AI-Verified Task Completion DApp

## Concept
A decentralized task verification platform where an AI (running as a GenLayer Intelligent Contract) analyzes GitHub submissions to verify work completion. All verification is done through on-chain AI consensus — no humans needed.

---

## Page 1: Landing Page
- Hero section with "AI-Verified Task Completion" headline
- 4-step visual flow: Post Task → Submit Proof → AI Verifies → Consensus
- Preview of recent tasks with status badges
- Connect wallet CTA

## Page 2: Task Board
- Filterable list of all tasks (open, claimed, verified, rejected)
- Search by title
- Quick view of reward amounts and status

## Page 3: Create Task
- Form to define task title, description, verification criteria, and reward
- Deploys a TaskVerifier Intelligent Contract on Asimov testnet

## Page 4: Task Detail
- Full task specification with criteria
- Claim task action for workers
- Submit GitHub URL for AI verification
- Verification result display with confidence score and reasoning
- Visual VERIFIED ✓ / REJECTED ✗ result

---

## Design System
- **Dev/hacker aesthetic**: Dark background, GitHub-inspired UI, monospace code blocks
- Neon green accents for primary actions, blue for secondary
- Status badges with color coding (green=verified, red=rejected, amber=claimed, blue=submitted)
- Grid background pattern, subtle glow effects
- Clean card components with branch icon headers

## Technical Approach
- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **GenLayer SDK**: `genlayer-js` to interact with TaskVerifier contracts on Asimov testnet
- **Wallet**: MetaMask integration via WalletContext
- **Contract**: Python Intelligent Contract using `gl.get_webpage()` to fetch GitHub repos and `gl.exec_prompt()` for AI verification

## Key Flow
1. Creator posts task with criteria → deploys contract
2. Worker claims the task → write transaction
3. Worker submits GitHub URL → triggers AI verification
4. AI validators fetch repo, analyze code, reach consensus
5. Result: VERIFIED ✓ or REJECTED ✗ with confidence score and reasoning
