// src/utils/validators.ts - Input validation utilities

import type { Difficulty, GameSettings } from '../game/types';

export class Validators {
  static isValidDifficulty(difficulty: Difficulty): boolean {
    return (
      typeof difficulty.name === 'string' &&
      difficulty.name.length > 0 &&
      Number.isInteger(difficulty.rows) &&
      difficulty.rows > 0 &&
      Number.isInteger(difficulty.cols) &&
      difficulty.cols > 0 &&
      Number.isInteger(difficulty.totalPieces) &&
      difficulty.totalPieces === difficulty.rows * difficulty.cols
    );
  }

  static isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  static isValidCanvasSize(width: number, height: number): boolean {
    return (
      Number.isInteger(width) &&
      width > 0 &&
      Number.isInteger(height) &&
      height > 0
    );
  }

  static isValidGameSettings(settings: GameSettings): boolean {
    return (
      Validators.isValidDifficulty(settings.difficulty) &&
      typeof settings.edgeOnly === 'boolean' &&
      typeof settings.preFlip === 'boolean'
    );
  }

  static sanitizeQuery(query: string): string {
    return query.trim().replace(/[<>]/g, '').slice(0, 100);
  }

  static validatePointerEvent(event: unknown): event is { x: number; y: number; type: string; pointerId: number; isTouch: boolean } {
    return (
      event !== null &&
      typeof event === 'object' &&
      'x' in event && typeof (event as any).x === 'number' &&
      'y' in event && typeof (event as any).y === 'number' &&
      'type' in event && typeof (event as any).type === 'string' &&
      'pointerId' in event && typeof (event as any).pointerId === 'number' &&
      'isTouch' in event && typeof (event as any).isTouch === 'boolean'
    );
  }
}