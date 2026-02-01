// src/game/gameState.ts - Centralized game state management

import type { Difficulty, GameSettings, GameState, GameStats } from './types';
import { APP_CONFIG } from '../config/appConfig';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

export class GameStateManager {
  private _currentState: GameState = 'menu';
  private _settings: GameSettings;
  private _stats: GameStats | null = null;
  private _timerInterval: number | null = null;
  private onStateChange?: (state: GameState) => void;
  private onStatsUpdate?: (stats: GameStats) => void;

  // Predefined difficulties
  static readonly DIFFICULTIES: Difficulty[] = [
    { name: 'Easy', rows: 4, cols: 4, totalPieces: 16 },
    { name: 'Medium', rows: 10, cols: 10, totalPieces: 100 },
    { name: 'Hard', rows: 16, cols: 16, totalPieces: 250 }
  ];

  constructor(settings: GameSettings = {
    difficulty: GameStateManager.DIFFICULTIES[0], // Easy default (16 pieces)
    edgeOnly: false,
    preFlip: true,
    preRotate: true
  }) {
    // Load settings from localStorage if available
    const savedSettings = this.loadSettings();
    this._settings = savedSettings || { ...settings };
  }

  get currentState(): GameState {
    return this._currentState;
  }

  get settings(): GameSettings {
    return { ...this._settings };
  }

  get stats(): GameStats | null {
    return this._stats ? { ...this._stats } : null;
  }

  get elapsedTime(): number {
    if (!this._stats) return 0;
    const endTime = this._stats.endTime || performance.now();
    return Math.floor((endTime - this._stats.startTime) / 1000); // seconds
  }

  get progress(): number {
    if (!this._stats) return 0;
    return Math.round((this._stats.piecesPlaced / this._stats.totalPieces) * 100);
  }

  setStateChangeHandler(handler: (state: GameState) => void): void {
    this.onStateChange = handler;
  }

  setStatsUpdateHandler(handler: (stats: GameStats) => void): void {
    this.onStatsUpdate = handler;
  }

  updateSettings(newSettings: Partial<GameSettings>): void {
    this._settings = { ...this._settings, ...newSettings };
    this.saveSettings();
  }

  private saveSettings(): void {
    ErrorHandler.withSyncErrorHandling(() => {
      localStorage.setItem('puzzleSettings', JSON.stringify(this._settings));
    }, 'saving settings');
  }

  private loadSettings(): GameSettings | null {
    return ErrorHandler.withSyncErrorHandling(() => {
      const saved = localStorage.getItem('puzzleSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that difficulty exists in DIFFICULTIES
        const difficulty = GameStateManager.DIFFICULTIES.find(
          d => d.totalPieces === parsed.difficulty?.totalPieces
        );
        if (difficulty) {
          return {
            ...parsed,
            difficulty
          };
        }
      }
      return null;
    }, 'loading settings');
  }

  startGame(totalPieces: number): void {
    this._currentState = 'playing';
    this._stats = {
      startTime: performance.now(),
      piecesPlaced: 0,
      totalPieces
    };
    this.startTimer();
    Logger.info(`Game started with ${totalPieces} pieces`);
    this.onStateChange?.('playing');
    this.onStatsUpdate?.(this._stats);
  }

  updateProgress(piecesPlaced: number): void {
    if (!this._stats) return;

    this._stats.piecesPlaced = piecesPlaced;

    Logger.debug(`GameState progress update: ${piecesPlaced}/${this._stats.totalPieces}`);

    if (this._stats.piecesPlaced >= this._stats.totalPieces) {
      this.completeGame();
    } else {
      Logger.debug('Calling stats update handler for progress');
      this.onStatsUpdate?.(this._stats);
    }
  }

  private completeGame(): void {
    if (!this._stats) return;

    this._stats.endTime = performance.now();
    this._currentState = 'completed';
    this.stopTimer();
    Logger.info(`Game completed! Time: ${this.elapsedTime}s, Pieces: ${this._stats.piecesPlaced}/${this._stats.totalPieces}`);
    Logger.debug('Calling stats update handler for completion');
    this.onStatsUpdate?.(this._stats);
    this.onStateChange?.('completed');
  }

  resetToMenu(): void {
    this._currentState = 'menu';
    this._stats = null;
    this.stopTimer();
    this.onStateChange?.('menu');
  }

  private startTimer(): void {
    if (this._timerInterval) return;

    this._timerInterval = window.setInterval(() => {
      if (this._stats && this.onStatsUpdate) {
        this.onStatsUpdate(this._stats);
      }
    }, APP_CONFIG.TIMING.TIMER_UPDATE_INTERVAL); // Update every second
  }

  private stopTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // Cleanup on destroy
  destroy(): void {
    this.stopTimer();
    this.onStateChange = undefined;
    this.onStatsUpdate = undefined;
  }
}