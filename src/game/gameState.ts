// src/game/gameState.ts - Centralized game state management

import type { Difficulty, GameSettings, GameState, GameStats, PuzzleConfig } from './types';
import type { PexelsPhoto } from '../api/imageSearch';
import type { PuzzlePiece } from './piece';
import { APP_CONFIG } from '../config/appConfig';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { GamePersistence, type SavedGameState } from '../utils/gamePersistence';
import { eventBus } from '../utils/eventEmitter';

export class GameStateManager {
  private _currentState: GameState = 'menu';
  private _settings: GameSettings;
  private _stats: GameStats | null = null;
  private _timerInterval: number | null = null;

  // Game persistence state
  private _selectedPhoto: PexelsPhoto | null = null;
  private _puzzlePieces: PuzzlePiece[] = [];
  private _canvasWidth: number = 800;
  private _canvasHeight: number = 600;
  private _puzzleConfig: PuzzleConfig | null = null;

  // Predefined difficulties
  static readonly DIFFICULTIES: Difficulty[] = [
    { name: 'Easy', rows: 4, cols: 4, totalPieces: 16 },
    { name: 'Medium', rows: 6, cols: 6, totalPieces: 36 },
    { name: 'Hard', rows: 8, cols: 8, totalPieces: 64 }
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
    const endTime = this._stats.endTime || Date.now();
    return Math.floor((endTime - this._stats.startTime) / 1000); // seconds
  }

  get progress(): number {
    if (!this._stats) return 0;
    return Math.round((this._stats.piecesPlaced / this._stats.totalPieces) * 100);
  }

  get selectedPhoto(): PexelsPhoto | null {
    return this._selectedPhoto;
  }

  get puzzlePieces(): PuzzlePiece[] {
    return [...this._puzzlePieces];
  }

  get canvasWidth(): number {
    return this._canvasWidth;
  }

  get canvasHeight(): number {
    return this._canvasHeight;
  }

  get puzzleConfig(): PuzzleConfig | null {
    return this._puzzleConfig;
  }

  setStateChangeHandler(handler: (state: GameState) => void): void {
    // Legacy method for backward compatibility - use eventBus instead
    eventBus.on('game:state-changed', ({ state }) => handler(state));
  }

  setStatsUpdateHandler(handler: (stats: GameStats) => void): void {
    // Legacy method for backward compatibility - use eventBus instead
    eventBus.on('game:stats-updated', ({ stats }) => handler(stats));
  }

  updateSettings(newSettings: Partial<GameSettings>): void {
    this._settings = { ...this._settings, ...newSettings };
    this.saveSettings();
  }

  setPuzzleState(
    photo: PexelsPhoto,
    pieces: PuzzlePiece[],
    canvasWidth: number,
    canvasHeight: number,
    puzzleConfig: PuzzleConfig
  ): void {
    this._selectedPhoto = photo;
    this._puzzlePieces = [...pieces];
    this._canvasWidth = canvasWidth;
    this._canvasHeight = canvasHeight;
    this._puzzleConfig = puzzleConfig;
    this.saveGameState();
  }

  updatePuzzlePieces(pieces: PuzzlePiece[]): void {
    this._puzzlePieces = [...pieces];
    // Don't save state if the game is completed
    if (this._currentState !== 'completed') {
      this.saveGameState();
    }
  }

  private saveSettings(): void {
    ErrorHandler.withSyncErrorHandling(() => {
      localStorage.setItem('puzzleSettings', JSON.stringify(this._settings));
    }, ErrorHandler.persistenceContext('saving settings'));
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
    }, ErrorHandler.persistenceContext('loading settings'));
  }

  startGame(totalPieces: number): void {
    this._currentState = 'playing';
    this._stats = {
      startTime: Date.now(),
      piecesPlaced: 0,
      totalPieces
    };
    this.startTimer();
    Logger.info(`Game started with ${totalPieces} pieces`);
    eventBus.emit('game:state-changed', { state: 'playing' });
    eventBus.emit('game:stats-updated', { stats: this._stats });
  }

  updateProgress(piecesPlaced: number): void {
    if (!this._stats) return;

    this._stats.piecesPlaced = piecesPlaced;

    Logger.debug(`GameState progress update: ${piecesPlaced}/${this._stats.totalPieces}`);

    if (this._stats.piecesPlaced >= this._stats.totalPieces) {
      this.completeGame();
    } else {
      Logger.debug('Emitting progress update event');
      eventBus.emit('game:progress-updated', { placed: this._stats.piecesPlaced, total: this._stats.totalPieces });
      eventBus.emit('game:stats-updated', { stats: this._stats });
    }
  }

  private completeGame(): void {
    if (!this._stats) return;

    this._stats.endTime = Date.now();
    this._currentState = 'completed';
    this.stopTimer();
    Logger.info(`Game completed! Time: ${this.elapsedTime}s, Pieces: ${this._stats.piecesPlaced}/${this._stats.totalPieces}`);
    Logger.debug('Emitting completion events');
    eventBus.emit('game:stats-updated', { stats: this._stats });
    eventBus.emit('game:state-changed', { state: 'completed' });

    // Clear the saved game state since the puzzle is completed
    this.clearSavedGameState();
  }

  resetToMenu(): void {
    this._currentState = 'menu';
    this._stats = null;
    this.stopTimer();
    eventBus.emit('game:state-changed', { state: 'menu' });
  }

  private startTimer(): void {
    if (this._timerInterval) return;

    this._timerInterval = window.setInterval(() => {
      if (this._stats) {
        eventBus.emit('game:stats-updated', { stats: this._stats });
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
  }

  // Game persistence methods
  private saveGameState(): void {
    if (this._selectedPhoto && this._puzzlePieces.length > 0 && this._currentState !== 'completed') {
      GamePersistence.saveGameState(
        this._currentState,
        this._settings,
        this._stats,
        this._selectedPhoto,
        this._puzzlePieces,
        this._canvasWidth,
        this._canvasHeight,
        this._puzzleConfig
      );
    }
  }

  loadSavedGameState(): SavedGameState | null {
    const savedState = GamePersistence.loadGameState();
    if (savedState) {
      // Don't restore completed games - they're done and don't need to be replayed
      if (savedState.gameState === 'completed') {
        Logger.info('Found completed game state, clearing it since puzzle is finished');
        this.clearSavedGameState();
        return null;
      }
    }
    return savedState;
  }

  clearSavedGameState(): void {
    GamePersistence.clearGameState();
  }

  restoreGameState(savedState: SavedGameState): void {
    this._currentState = savedState.gameState;
    this._settings = savedState.settings;
    this._stats = savedState.stats;
    this._selectedPhoto = savedState.photo;
    this._canvasWidth = savedState.canvasWidth;
    this._canvasHeight = savedState.canvasHeight;
    this._puzzleConfig = savedState.puzzleConfig;

    // Restore pieces (imageData will be set later when image loads)
    this._puzzlePieces = savedState.pieces.map(serialized =>
      GamePersistence.deserializePiece(serialized)
    );

    // Restart timer if game was in progress
    if (this._currentState === 'playing' && this._stats) {
      this.startTimer();
    }

    // Notify listeners that state has been restored
    eventBus.emit('game:state-changed', { state: this._currentState });

    Logger.info(`Restored game state: ${this._puzzlePieces.length} pieces, state: ${this._currentState}`);
  }
}