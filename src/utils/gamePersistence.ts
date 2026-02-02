// src/utils/gamePersistence.ts - Game state persistence utilities

import { PuzzlePiece } from '../game/piece';
import type { PieceConnection } from '../game/piece';
import type { GameState, GameSettings, GameStats, PuzzleConfig } from '../game/types';
import type { PexelsPhoto } from '../api/imageSearch';
import { Logger } from './logger';
import { ErrorHandler } from './errorHandler';

export interface SerializedPuzzlePiece {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  faceUp: boolean;
  connections: PieceConnection[];
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  isLocked: boolean;
  originalPosition: { x: number; y: number };
  connectedPieces: number[];
  groupId: number | null;
  // Note: imageData is not serialized - will be recreated from photo
}

export interface SavedGameState {
  version: string;
  gameState: GameState;
  settings: GameSettings;
  stats: GameStats | null;
  photo: PexelsPhoto | null;
  pieces: SerializedPuzzlePiece[];
  canvasWidth: number;
  canvasHeight: number;
  puzzleConfig: PuzzleConfig | null;
  timestamp: number;
}

export class GamePersistence {
  private static readonly STORAGE_KEY = 'puzzlingGameState';
  private static readonly VERSION = '1.0.0';

  /**
   * Save the complete game state to localStorage
   */
  static saveGameState(
    gameState: GameState,
    settings: GameSettings,
    stats: GameStats | null,
    photo: PexelsPhoto | null,
    pieces: PuzzlePiece[],
    canvasWidth: number,
    canvasHeight: number,
    puzzleConfig: PuzzleConfig | null
  ): void {
    ErrorHandler.withSyncErrorHandling(() => {
      const serializedPieces = pieces.map(piece => this.serializePiece(piece));

      const savedState: SavedGameState = {
        version: this.VERSION,
        gameState,
        settings,
        stats,
        photo,
        pieces: serializedPieces,
        canvasWidth,
        canvasHeight,
        puzzleConfig,
        timestamp: Date.now()
      };

      const jsonString = JSON.stringify(savedState);
      localStorage.setItem(this.STORAGE_KEY, jsonString);

      Logger.info(`Game state saved: ${pieces.length} pieces, state: ${gameState}`);
    }, ErrorHandler.persistenceContext('saving game state'));
  }

  /**
   * Load the complete game state from localStorage
   */
  static loadGameState(): SavedGameState | null {
    return ErrorHandler.withSyncErrorHandling(() => {
      const jsonString = localStorage.getItem(this.STORAGE_KEY);
      if (!jsonString) {
        Logger.debug('No saved game state found');
        return null;
      }

      const savedState: SavedGameState = JSON.parse(jsonString);

      // Validate version compatibility
      if (!this.isVersionCompatible(savedState.version)) {
        Logger.warn(`Saved game version ${savedState.version} is incompatible with current ${this.VERSION}`);
        this.clearGameState();
        return null;
      }

      // Check if the saved state is too old (e.g., more than 24 hours)
      const age = Date.now() - savedState.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (age > maxAge) {
        Logger.info('Saved game state is too old, clearing');
        this.clearGameState();
        return null;
      }

      Logger.info(`Game state loaded: ${savedState.pieces.length} pieces, state: ${savedState.gameState}`);
      return savedState;
    }, ErrorHandler.persistenceContext('loading game state')) || null;
  }

  /**
   * Clear the saved game state
   */
  static clearGameState(): void {
    ErrorHandler.withSyncErrorHandling(() => {
      localStorage.removeItem(this.STORAGE_KEY);
      Logger.info('Game state cleared');
    }, ErrorHandler.persistenceContext('clearing game state'));
  }

  /**
   * Check if a saved version is compatible with current version
   */
  private static isVersionCompatible(savedVersion: string): boolean {
    // For now, only accept exact version matches
    // In the future, we could implement version migration logic
    return savedVersion === this.VERSION;
  }

  /**
   * Serialize a PuzzlePiece for storage
   */
  private static serializePiece(piece: PuzzlePiece): SerializedPuzzlePiece {
    return {
      id: piece.id,
      x: piece.x,
      y: piece.y,
      width: piece.width,
      height: piece.height,
      rotation: piece.rotation,
      faceUp: piece.faceUp,
      connections: [...piece.connections],
      isDragging: piece.isDragging,
      dragOffset: { ...piece.dragOffset },
      isLocked: piece.isLocked,
      originalPosition: { ...piece.originalPosition },
      connectedPieces: Array.from(piece.connectedPieces),
      groupId: piece.groupId
    };
  }

  /**
   * Deserialize a SerializedPuzzlePiece back to a PuzzlePiece
   */
  static deserializePiece(serialized: SerializedPuzzlePiece, imageData?: ImageData): PuzzlePiece {
    const piece = new PuzzlePiece(
      serialized.id,
      serialized.x,
      serialized.y,
      serialized.width,
      serialized.height,
      imageData
    );

    piece.rotation = serialized.rotation;
    piece.faceUp = serialized.faceUp;
    piece.connections = [...serialized.connections];
    piece.isDragging = serialized.isDragging;
    piece.dragOffset = { ...serialized.dragOffset };
    piece.isLocked = serialized.isLocked;
    piece.originalPosition = { ...serialized.originalPosition };
    piece.connectedPieces = new Set(serialized.connectedPieces);
    piece.groupId = serialized.groupId;

    return piece;
  }
}