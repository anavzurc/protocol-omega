export interface ScoreData {
  score: number;
  gameMode: "story" | "arcade";
}

export interface ProgressData {
  currentLevel: number;
  coins: number;
  lastCheckpoint: string;
}

export interface MatchData {
  score: number;
  duration: number;
  mode: "story" | "arcade";
}
