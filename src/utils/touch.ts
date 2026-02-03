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
  pointerType: string;
}

export class TouchHandler {
  private canvas: HTMLCanvasElement;
  private lastTapTime: number = 0;
  private tapCount: number = 0;
  private readonly DOUBLE_TAP_DELAY = APP_CONFIG.TIMING.DOUBLE_TAP_DELAY;
  private readonly LONG_PRESS_DELAY = APP_CONFIG.TIMING.LONG_PRESS_DELAY;
  private readonly POINTER_MOVE_DEBOUNCE = 16; // ~60fps debounce for move events
  private abortController: AbortController | null = null;
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
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Create debounced versions of callbacks
    const debouncedPointerMove = this.debounce(onPointerMove, this.POINTER_MOVE_DEBOUNCE, 'pointerMoveTimeout');
    const debouncedPointerStart = this.debounce(onPointerStart, 0, 'pointerStartTimeout');
    const debouncedPointerEnd = this.debounce(onPointerEnd, 0, 'pointerEndTimeout');

    // Pointer events (mouse, touch, pen)
    const handlePointerDown = (e: globalThis.PointerEvent) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      const event = this.createPointerEvent(e.clientX, e.clientY, 'start', e.pointerId, e.pointerType === 'touch', e.pointerType);
      eventBus.emit('input:pointer-down', { x: event.x, y: event.y });
      debouncedPointerStart(event);
      this.handleTapDetection(e.clientX, e.clientY, onDoubleTap);
      longPressTimer = window.setTimeout(() => {
        if (onLongPress) onLongPress(e.clientX, e.clientY);
      }, this.LONG_PRESS_DELAY);
    };

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const event = this.createPointerEvent(e.clientX, e.clientY, 'move', e.pointerId, e.pointerType === 'touch', e.pointerType);
      eventBus.emit('input:pointer-move', { x: event.x, y: event.y });
      debouncedPointerMove(event);
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const event = this.createPointerEvent(e.clientX, e.clientY, 'end', e.pointerId, e.pointerType === 'touch', e.pointerType);
      eventBus.emit('input:pointer-up', { x: event.x, y: event.y });
      debouncedPointerEnd(event);
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    };

    this.canvas.addEventListener('pointerdown', handlePointerDown, { passive: false, signal });
    this.canvas.addEventListener('pointermove', handlePointerMove, { passive: false, signal });
    this.canvas.addEventListener('pointerup', handlePointerUp, { passive: false, signal });
    this.canvas.addEventListener('pointercancel', handlePointerUp, { passive: false, signal });

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  }

  // Cleanup method to clear pending timeouts
  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.clearDebounceTimeouts();
  }

  private createPointerEvent(
    clientX: number,
    clientY: number,
    type: PointerEvent['type'],
    pointerId: number,
    isTouch: boolean,
    pointerType: string
  ): PointerEvent {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      type,
      pointerId,
      isTouch,
      pointerType
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

  private clearDebounceTimeouts(): void {
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

  static rotateVector(x: number, y: number, degrees: number): { x: number; y: number } {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos
    };
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
      
       // Target piece must also be face-up and share rotation
       if (!piece.faceUp) continue;
       if (piece.rotation !== draggedPiece.rotation) continue;

      // Find the explicit connection between draggedPiece and this candidate target.
      const connection = this.getConnection(draggedPiece, piece);
      if (!connection) continue;

      // Snap based on rotated solved-space offset between piece centers.
      const draggedCenter = {
        x: draggedX + draggedPiece.width / 2,
        y: draggedY + draggedPiece.height / 2
      };
      const targetCenter = {
        x: piece.x + piece.width / 2,
        y: piece.y + piece.height / 2
      };
      const originalDelta = {
        x: (draggedPiece.originalPosition.x + draggedPiece.width / 2) - (piece.originalPosition.x + piece.width / 2),
        y: (draggedPiece.originalPosition.y + draggedPiece.height / 2) - (piece.originalPosition.y + piece.height / 2)
      };
      const rotatedDelta = TouchHandler.rotateVector(originalDelta.x, originalDelta.y, draggedPiece.rotation);
      const expectedCenter = {
        x: targetCenter.x + rotatedDelta.x,
        y: targetCenter.y + rotatedDelta.y
      };

      const snapX = expectedCenter.x - draggedPiece.width / 2;
      const snapY = expectedCenter.y - draggedPiece.height / 2;

      const distance = Math.hypot(draggedCenter.x - expectedCenter.x, draggedCenter.y - expectedCenter.y);

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
