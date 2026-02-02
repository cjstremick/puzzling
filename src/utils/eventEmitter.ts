import type { PexelsPhoto } from '../api/imageSearch';
import type { PuzzlePiece } from '../game/piece';
import type { GameState, GameStats } from '../game/types';

export interface GameEvents {
  'game:state-changed': { state: GameState };
  'game:progress-updated': { placed: number; total: number };
  'game:stats-updated': { stats: GameStats };
  'puzzle:loaded': { photo: PexelsPhoto; pieces: PuzzlePiece[] };
  'piece:selected': { piece: PuzzlePiece };
  'piece:deselected': {};
  'piece:moved': { piece: PuzzlePiece; x: number; y: number };
  'piece:snapped': { piece: PuzzlePiece; targetPiece: PuzzlePiece };
  'piece:flipped': { piece: PuzzlePiece };
  'piece:rotated': { piece: PuzzlePiece };
  'input:pointer-down': { x: number; y: number };
  'input:pointer-move': { x: number; y: number };
  'input:pointer-up': { x: number; y: number };
  'input:double-tap': { x: number; y: number };
}

type EventName = keyof GameEvents;
type EventData<T extends EventName> = GameEvents[T];

export class EventEmitter {
  private listeners: Map<EventName, Set<(data: any) => void>> = new Map();

  on<T extends EventName>(event: T, listener: (data: EventData<T>) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  off<T extends EventName>(event: T, listener: (data: EventData<T>) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T extends EventName>(event: T, data: EventData<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Global event bus instance
export const eventBus = new EventEmitter();