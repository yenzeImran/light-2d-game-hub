export interface Profile {
  name: string;
  avatar: string; // emoji or data URL
}

export interface RoomInfo {
  code: string;
  players: PlayerPresence[];
  public: boolean;
  createdAt: number;
}

export interface PlayerPresence {
  id: string;
  name: string;
  avatar: string;
}

export interface GameState {
  // Common base for game states
  current: 'white' | 'black' | 'red' | 'yellow' | string;
  winner: string | null;
  board: any;
}