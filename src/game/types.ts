// src/game/types.ts - Core game type definitions and interfaces

import type { PuzzlePiece } from './piece';

export interface Difficulty {
  name: string;
  rows: number;
  cols: number;
  totalPieces: number;
}

export interface GameSettings {
  difficulty: Difficulty;
  edgeOnly: boolean;
  preFlip: boolean;
  preRotate: boolean;
}

export type GameState = 'menu' | 'playing' | 'completed';

export interface GameStats {
  startTime: number;
  endTime?: number;
  piecesPlaced: number;
  totalPieces: number;
}

export interface PuzzleConfig {
  rows: number;
  cols: number;
  shuffle: boolean;
  preFlip: boolean;
  preRotate: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IGameEngine {
  loadPuzzle(imageUrl: string, config: PuzzleConfig): Promise<void>;
  handleInput(event: PointerEvent): void;
  getProgress(): { placed: number; total: number };
}

export interface IRenderer {
  render(pieces: PuzzlePiece[], selectedPiece?: PuzzlePiece): void;
  clear(): void;
}

export interface ISoundManager {
  setEnabled(enabled: boolean): void;
  play(soundKey: string): void;
}

export interface IGameStateManager {
  get currentState(): GameState;
  get settings(): GameSettings;
  get stats(): GameStats | null;
  get elapsedTime(): number;
  get progress(): number;

  setStateChangeHandler(handler: (state: GameState) => void): void;
  setStatsUpdateHandler(handler: (stats: GameStats) => void): void;
  updateSettings(newSettings: Partial<GameSettings>): void;
  updateProgress(piecesPlaced: number): void;
  startGame(totalPieces: number): void;
  resetToMenu(): void;
  destroy(): void;
}