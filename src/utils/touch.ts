// src/utils/touch.ts - Touch and mouse event handling utilities

import { APP_CONFIG } from '../config/appConfig';
import { eventBus } from './eventEmitter';
import type { PieceConnection, PuzzlePiece } from '../game/piece';

export interface PointerEvent {
  x: number;
  y: number;
  type: 'start' | 'move' | 'end';
  pointerId: number;
  isTouch: boolean;
}

export class TouchHandler {
  private canvas: HTMLCanvasElement;
  private lastTapTime: number = 0;
  private tapCount: number = 0;
  private readonly DOUBLE_TAP_DELAY = APP_CONFIG.TIMING.DOUBLE_TAP_DELAY;
  private readonly LONG_PRESS_DELAY = APP_CONFIG.TIMING.LONG_PRESS_DELAY;
  private readonly POINTER_MOVE_DEBOUNCE = 16; // ~60fps debounce for move events

  // Debounce timers for different event types
  private pointerMoveTimeout: number | null = null;
  private pointerStartTimeout: number | null = null;
  private pointerEndTimeout: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private debounce<T extends (...args: any[]) => void>(
    func: T,
    delay: number,
    timeoutRef: 'pointerMoveTimeout' | 'pointerStartTimeout' | 'pointerEndTimeout'
  ): T {
    return ((...args: Parameters<T>) => {
      if (this[timeoutRef]) {
        clearTimeout(this[timeoutRef]);
      }
      this[timeoutRef] = window.setTimeout(() => {
        func(...args);
        this[timeoutRef] = null;
      }, delay);
    }) as T;
  }

  // Convert mouse/touch events to unified pointer events
  setupPointerEvents(
    onPointerStart: (event: PointerEvent) => void,
    onPointerMove: (event: PointerEvent) => void,
    onPointerEnd: (event: PointerEvent) => void,
    onDoubleTap?: (x: number, y: number) => void,
    onLongPress?: (x: number, y: number) => void
  ): void {
    let longPressTimer: number | null = null;

    // Create debounced versions of callbacks
    const debouncedPointerMove = this.debounce(onPointerMove, this.POINTER_MOVE_DEBOUNCE, 'pointerMoveTimeout');
    const debouncedPointerStart = this.debounce(onPointerStart, 0, 'pointerStartTimeout'); // No debounce for start
    const debouncedPointerEnd = this.debounce(onPointerEnd, 0, 'pointerEndTimeout'); // No debounce for end

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const event = this.createPointerEvent(e.clientX, e.clientY, 'start', 0, false);
      eventBus.emit('input:pointer-down', { x: event.x, y: event.y });
      debouncedPointerStart(event);
      this.handleTapDetection(e.clientX, e.clientY, onDoubleTap);
      longPressTimer = window.setTimeout(() => {
        if (onLongPress) onLongPress(e.clientX, e.clientY);
      }, this.LONG_PRESS_DELAY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const event = this.createPointerEvent(e.clientX, e.clientY, 'move', 0, false);
      eventBus.emit('input:pointer-move', { x: event.x, y: event.y });
      debouncedPointerMove(event);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const event = this.createPointerEvent(e.clientX, e.clientY, 'end', 0, false);
      eventBus.emit('input:pointer-up', { x: event.x, y: event.y });
      debouncedPointerEnd(event);
    });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const event = this.createPointerEvent(touch.clientX, touch.clientY, 'start', touch.identifier, true);
        eventBus.emit('input:pointer-down', { x: event.x, y: event.y });
        debouncedPointerStart(event);
        this.handleTapDetection(touch.clientX, touch.clientY, onDoubleTap);
        longPressTimer = window.setTimeout(() => {
          if (onLongPress) onLongPress(touch.clientX, touch.clientY);
        }, this.LONG_PRESS_DELAY);
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const event = this.createPointerEvent(touch.clientX, touch.clientY, 'move', touch.identifier, true);
        eventBus.emit('input:pointer-move', { x: event.x, y: event.y });
        debouncedPointerMove(event);
      }
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const event = this.createPointerEvent(touch.clientX, touch.clientY, 'end', touch.identifier, true);
        eventBus.emit('input:pointer-up', { x: event.x, y: event.y });
        debouncedPointerEnd(event);
      }
    });

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Cleanup method to clear pending timeouts
  destroy(): void {
    if (this.pointerMoveTimeout) {
      clearTimeout(this.pointerMoveTimeout);
      this.pointerMoveTimeout = null;
    }
    if (this.pointerStartTimeout) {
      clearTimeout(this.pointerStartTimeout);
      this.pointerStartTimeout = null;
    }
    if (this.pointerEndTimeout) {
      clearTimeout(this.pointerEndTimeout);
      this.pointerEndTimeout = null;
    }
  }

  private createPointerEvent(clientX: number, clientY: number, type: PointerEvent['type'], pointerId: number, isTouch: boolean): PointerEvent {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      type,
      pointerId,
      isTouch
    };
  }

  private handleTapDetection(
    x: number,
    y: number,
    onDoubleTap?: (x: number, y: number) => void
  ): void {
    // TODO: Use onLongPress for future features

    const now = Date.now();
    const timeDiff = now - this.lastTapTime;

    if (timeDiff < this.DOUBLE_TAP_DELAY) {
      this.tapCount++;
      if (this.tapCount === 2 && onDoubleTap) {
        eventBus.emit('input:double-tap', { x, y });
        onDoubleTap(x, y);
        this.tapCount = 0;
      }
    } else {
      this.tapCount = 1;
    }

    this.lastTapTime = now;

    // Reset tap count after delay
    setTimeout(() => {
      this.tapCount = 0;
    }, this.DOUBLE_TAP_DELAY);
  }
}

// Snapping utilities
export class SnapDetector {
  private static readonly SNAP_DISTANCE = APP_CONFIG.SNAPPING.DISTANCE;

   static findSnapTarget(
     draggedPiece: PuzzlePiece,
     allPieces: PuzzlePiece[],
     draggedX: number,
     draggedY: number
   ): { targetPiece: PuzzlePiece; snapX: number; snapY: number; connection: PieceConnection; distance: number } | null {
     // Only snap if piece is face-up
     if (!draggedPiece.faceUp) {
       return null;
     }

    let closestSnap: {
      targetPiece: PuzzlePiece;
      snapX: number;
      snapY: number;
      connection: PieceConnection;
      distance: number;
    } | null = null;

    for (const piece of allPieces) {
      if (piece.id === draggedPiece.id) continue;
      
      // Skip pieces that are already connected to the dragged piece (same group)
      if (draggedPiece.connectedPieces.has(piece.id)) continue;
      
       // Target piece must also be face-up
       if (!piece.faceUp) continue;

      // Find the explicit connection between draggedPiece and this candidate target.
      const connection = this.getConnection(draggedPiece, piece);
      if (!connection) continue;

      // Snap to the position that preserves the pieces' original relative offset.
      const snapX = piece.x + (draggedPiece.originalPosition.x - piece.originalPosition.x);
      const snapY = piece.y + (draggedPiece.originalPosition.y - piece.originalPosition.y);

      const distance = Math.hypot(draggedX - snapX, draggedY - snapY);

      if (distance < this.SNAP_DISTANCE && (!closestSnap || distance < closestSnap.distance)) {
        closestSnap = {
          targetPiece: piece,
          snapX,
          snapY,
          connection,
          distance,
        };
      }
    }

    return closestSnap ? {
      targetPiece: closestSnap.targetPiece,
      snapX: closestSnap.snapX,
      snapY: closestSnap.snapY,
      connection: closestSnap.connection,
      distance: closestSnap.distance,
    } : null;
  }

  private static getConnection(piece1: PuzzlePiece, piece2: PuzzlePiece): PieceConnection | null {
    for (const maybeConnection of piece1.connections) {
      if (!maybeConnection) continue;
      if (maybeConnection.type === null) continue;
      if (maybeConnection.matingPieceId !== piece2.id) continue;
      return maybeConnection;
    }
    return null;
  }

  static checkConnection(piece1: PuzzlePiece, piece2: PuzzlePiece): boolean {
    return this.getConnection(piece1, piece2) !== null;
  }
}
