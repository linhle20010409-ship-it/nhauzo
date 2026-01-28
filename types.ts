export enum GameState {
  LOBBY = 'LOBBY',
  PICKING_LOSER = 'PICKING_LOSER',
  DEATH_NUMBER = 'DEATH_NUMBER', // Chọn số tử thần
  VOTING = 'VOTING',             // Bỏ phiếu
  SPINNING_PENALTY = 'SPINNING_PENALTY',
  DECIDING_PENALTY = 'DECIDING_PENALTY', // Người thua chọn hình phạt/game
  MINIGAME_DUEL = 'MINIGAME_DUEL',       // Đang đấu minigame
  RESULT = 'RESULT',
}

export enum GameMode {
  RANDOM = 'RANDOM',
  DEATH_NUMBER = 'DEATH_NUMBER',
  VOTING = 'VOTING',
}

export enum MinigameType {
  RPS = 'RPS',               // Oẳn tù tì
  FAST_HANDS = 'FAST_HANDS', // Nhanh tay
  MEMORY = 'MEMORY',         // Lật thẻ (Bomb)
}

export interface Player {
  id: string;
  name: string;
  voteCount?: number;
  selectedNumber?: number;
  minigameMove?: string | null; // Lưu nước đi (Búa/Kéo/Bao hoặc Time bấm nút)
}

// Dữ liệu cho hiệu ứng vòng quay đồng bộ
export interface SpinData {
  isSpinning: boolean;
  winnerIndex: number;
  winnerId: string;
  startTime: number;
}

// Dữ liệu trạng thái của Minigame (Mới thêm)
export interface MinigameState {
  basePenalty: number;      // Mức cược (0.1 - 0.5)
  cards: string[];          // Danh sách thẻ bài (game lật thẻ)
  flipped: number[];        // Các thẻ đã lật
  currentTurn: string;      // Lượt của ai
  canAttack: boolean;       // Cho phép bấm nút (game nhanh tay)
  loser: string | null;     // Ai đã thua game này
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
  
  // Các biến logic game
  deathNumber?: number | null;
  currentLoserId?: string | null;
  targetOpponentId?: string | null; // Đối thủ bị thách đấu
  minigameType?: MinigameType | null;
  
  winnerId?: string | null;         // Người phải uống (Kết quả cuối)
  winnerBeerAmount?: number | null; // Số ly phải uống
  
  penalties: Penalty[];
  
  // Dữ liệu mới thêm vào
  spinData?: SpinData | null;
  minigameState?: MinigameState | null;
}
