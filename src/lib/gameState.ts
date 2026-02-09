// Mock game state for the frontend - will connect to contract later
export interface StoryBeat {
  id: number;
  text: string;
  choices: string[];
  chosenIndex?: number;
  votes: Record<number, number>;
}

export interface GameSession {
  id: string;
  theme: string;
  players: string[];
  maxPlayers: number;
  started: boolean;
  finished: boolean;
  currentBeat: number;
  storyBeats: StoryBeat[];
}

// Demo data for the frontend until contract is deployed
export const MOCK_SESSIONS: GameSession[] = [
  {
    id: '0x1a2b...3c4d',
    theme: 'Dark Fantasy Dungeon',
    players: ['0xAbC1...dEf2', '0x9876...5432'],
    maxPlayers: 4,
    started: false,
    finished: false,
    currentBeat: 0,
    storyBeats: [],
  },
  {
    id: '0x5e6f...7a8b',
    theme: 'Cyberpunk Heist',
    players: ['0xFeDc...BaA9', '0x1122...3344', '0x5566...7788'],
    maxPlayers: 4,
    started: true,
    finished: false,
    currentBeat: 2,
    storyBeats: [],
  },
];

export const DEMO_STORY: StoryBeat[] = [
  {
    id: 0,
    text: "You stand at the entrance of the Obsidian Catacombs. The air is thick with the scent of ancient stone and something... else. A faint green glow pulses from deep within. Your party of adventurers looks to you for guidance.",
    choices: [
      "Light a torch and proceed cautiously",
      "Send the rogue ahead to scout",
      "Call out into the darkness",
      "Search for traps near the entrance"
    ],
    votes: { 0: 2, 1: 1, 2: 0, 3: 1 },
    chosenIndex: 0,
  },
  {
    id: 1,
    text: "The torch crackles to life, casting dancing shadows along the carved walls. Ancient runes shimmer with a fading enchantment. As you advance, you reach a fork — one path slopes downward into darkness, the other leads to a door covered in crystallized frost.",
    choices: [
      "Take the descending path",
      "Examine the frozen door",
      "Try to read the runes on the wall"
    ],
    votes: { 0: 1, 1: 3, 2: 0 },
    chosenIndex: 1,
  },
  {
    id: 2,
    text: "You approach the frozen door. Ice crackles beneath your fingers as you touch its surface. Through the frost, you see shapes moving — shadows of creatures pacing on the other side. The runes beside the door begin to glow as you draw near.",
    choices: [
      "Break through the ice with force",
      "Attempt to melt the ice with the torch",
      "Read the glowing runes aloud",
      "Retreat and take the other path"
    ],
    votes: {},
  },
];
