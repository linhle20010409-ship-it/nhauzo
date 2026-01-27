
export enum GameMode {
  RANDOM = 'RANDOM',
  DEATH_NUMBER = 'DEATH_NUMBER',
  VOTING = 'VOTING'
}

export enum GameState {
  LOBBY = 'LOBBY',
  PICKING_LOSER = 'PICKING_LOSER',
  DECIDING_PENALTY = 'DECIDING_PENALTY',
  SPINNING_PENALTY = 'SPINNING_PENALTY',
  MINIGAME_DUEL = 'MINIGAME_DUEL',
  RESULT = 'RESULT'
}

export enum MinigameType {
  RPS = 'RPS',
  FAST_HANDS = 'FAST_HANDS',
  MEMORY = 'MEMORY'
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  voteCount?: number;
  selectedNumber?: number;
}

export interface Penalty {
  text: string;
  amount: number;
}

export interface GameData {
  id: string;
  hostId: string;
  mode: GameMode;
  state: GameState;
  players: Record<string, Player>;
  currentLoserId?: string;
  targetOpponentId?: string;
  penalties: Penalty[];
  deathNumber?: number;
  minigameType?: MinigameType;
  winnerId?: string;
  winnerBeerAmount?: number;
  lastUpdate: number;
}
