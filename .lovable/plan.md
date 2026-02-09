
# 🎮 GenLayer Quest — Multiplayer Choose Your Adventure DApp

## Concept
A multiplayer text-based adventure game where an AI Game Master (running as a GenLayer Intelligent Contract) narrates a branching story. Players vote on choices together, and the AI validators reach consensus on story outcomes. All decisions are recorded on-chain.

---

## Page 1: Landing Page
- Dark terminal-style hero with glowing green/amber text on black background
- Game title with retro ASCII art header
- "Connect Wallet" button to connect to GenLayer testnet (Asimov)
- Brief explanation of how the game works
- List of active game sessions players can join

## Page 2: Game Lobby
- Create a new game session (sets the story theme/genre)
- Join an existing game session by contract address
- Show connected players in the lobby with their addresses (truncated)
- "Start Adventure" button (when enough players have joined)

## Page 3: Game Screen (Core Experience)
- Terminal-style chat log showing the AI Game Master's narration
- Story text appears with a typewriter animation effect
- 2-4 choice buttons displayed after each story beat
- Players vote on which choice to take — majority wins
- Live vote count shown next to each option
- Player list sidebar showing who's in the session
- Transaction status indicator (pending/confirmed) for on-chain actions
- History scroll showing past story chapters and choices made

## Page 4: Game Over / Summary
- Final story recap with all choices made
- Player participation stats
- Option to start a new adventure
- Link to view the game's on-chain history

---

## Design System
- **Dark retro terminal aesthetic**: Black/very dark background, monospace fonts, glowing green or amber text
- Scanline overlay effect for CRT monitor feel
- Blinking cursor animations
- Subtle glow/shadow effects on text and buttons
- Card components styled as terminal windows with title bars

## Technical Approach
- **Frontend**: React + TypeScript + Tailwind CSS with custom terminal theme
- **GenLayer SDK**: `genlayer-js` package to connect to testnet Asimov, read contract state, and send transactions
- **Wallet**: Built-in account creation via `genlayer-js` SDK's `createAccount()`
- **State management**: React Query for polling contract state (story text, votes, player list)
- **Note**: The Intelligent Contract (Python) needs to be deployed separately via GenLayer Studio — the frontend will interact with it by contract address

## Key Interactions
1. Player connects → creates/joins a game session on the contract
2. AI Game Master generates story text (via GenLayer's on-chain AI)
3. Players vote on choices → votes are write transactions
4. Contract resolves the vote → AI generates next story beat
5. Repeat until story concludes
