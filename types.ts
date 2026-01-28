export enum GameState {
  LOBBY = 'LOBBY',
  PICKING_LOSER = 'PICKING_LOSER',
  DEATH_NUMBER = 'DEATH_NUMBER',
  VOTING = 'VOTING',
  SPINNING_PENALTY = 'SPINNING_PENALTY',
  DECIDING_PENALTY = 'DECIDING_PENALTY',
  MINIGAME_DUEL = 'MINIGAME_DUEL',
  RESULT = 'RESULT',
}

export enum GameMode {
  RANDOM = 'RANDOM',
  DEATH_NUMBER = 'DEATH_NUMBER',
  VOTING = 'VOTING',
}

export enum MinigameType {
  RPS = 'RPS',
  FAST_HANDS = 'FAST_HANDS',
  MEMORY = 'MEMORY',
  TAP_WAR = 'TAP_WAR',
}

export interface Player {
  id: string;
  name: string;
  voteCount?: number;
  selectedNumber?: number;
  minigameMove?: string | null;
}

export interface SpinData {
  isSpinning: boolean;
  winnerIndex: number;
  winnerId: string;
  startTime: number;
}

export interface MinigameState {
  basePenalty: number;
  cards: string[];
  flipped: number[];
  currentTurn: string;
  canAttack: boolean;
  loser: string | null;
}

export interface Penalty {
  text: string;
  amount: number;
}

export interface GameData {
  id: string;
  hostId: string;
  players: Record<string, Player>;
  state: GameState;
  mode: GameMode;
  
  // Logic điều khiển
  nextControllerId?: string | null; // Người cầm cái (được quyền bấm quay)

  // Logic game
  deathNumber?: number | null;
  currentLoserId?: string | null;
  targetOpponentId?: string | null;
  minigameType?: MinigameType | null;
  
  winnerId?: string | null;
  winnerBeerAmount?: number | null;
  
  penalties: Penalty[];
  
  spinData?: SpinData | null;
  minigameState?: MinigameState | null;
}
