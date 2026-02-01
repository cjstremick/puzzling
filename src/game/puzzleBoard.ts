// src/game/puzzleBoard.ts - Canvas rendering and interaction logic

import { PuzzlePiece } from './piece';
import type { PuzzleConfig } from './types';
import { PuzzleGenerator } from './puzzleGenerator';
import { TouchHandler, SnapDetector, type PointerEvent } from '../utils/touch';
import { APP_CONFIG } from '../config/appConfig';
import { SoundManager } from '../audio/soundManager';
import { Logger } from '../utils/logger';

export class PuzzleBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pieces: PuzzlePiece[] = [];
  private selectedPiece: PuzzlePiece | null = null;
  private isDragging: boolean = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private hasMovedBeyondThreshold: boolean = false;
  private touchHandler: TouchHandler;
  private onProgressUpdate?: (placed: number, total: number) => void;
  private soundManager?: SoundManager;
  private hintedPieces: Set<number> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.touchHandler = new TouchHandler(canvas);

    this.setupEventListeners();
  }

  setSoundManager(manager: SoundManager): void {
    this.soundManager = manager;
  }

  private setupEventListeners(): void {
    this.touchHandler.setupPointerEvents(
      (event) => this.onPointerStart(event),
      (event) => this.onPointerMove(event),
      (event) => this.onPointerEnd(event),
      (x, y) => this.onDoubleTap(x, y)
    );
  }

  private onPointerStart(event: PointerEvent): void {
    this.handlePointerDown(event.x, event.y);
  }

  private onPointerMove(event: PointerEvent): void {
    // Allow pointer move to be called if we have a selected piece (even if not dragging yet)
    if (!this.selectedPiece) return;
    this.handlePointerMove(event.x, event.y);
  }

   private onPointerEnd(event: PointerEvent): void {
     Logger.debug('Pointer end:', event.type);
     this.handlePointerUp();
   }

  private onDoubleTap(x: number, y: number): void {
    // Find piece under tap
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (piece.containsPoint(x, y)) {
        // Get the entire connected group and rotate it as a unit
        const group = this.getAllPiecesInGroup(piece);
        this.rotateGroup(group);
        this.render();
        break;
      }
    }
  }

  private handlePointerDown(x: number, y: number): void {
    // Store initial pointer position
    this.pointerDownPos = { x, y };
    this.hasMovedBeyondThreshold = false;

    // Find piece under cursor, considering groups and z-order
    let selectedGroup: PuzzlePiece[] | null = null;
    let selectedPiece: PuzzlePiece | null = null;

    // Iterate from top to bottom (back to front in array)
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (!piece.isLocked && piece.containsPoint(x, y)) {
        selectedPiece = piece;
        selectedGroup = this.getAllPiecesInGroup(piece);
        break; // Found the topmost piece/group under cursor
      }
    }

    if (selectedPiece && selectedGroup) {
      // Bring the selected group to the front immediately upon selection
      this.bringToFront(selectedPiece);

      // Reset drag state for the selected group
      this.isDragging = false;
      this.selectedPiece = selectedPiece; // Keep track of initially clicked piece

      // Set drag offset relative to the initially clicked piece
      this.selectedPiece.dragOffset = {
        x: x - selectedPiece.x,
        y: y - selectedPiece.y
      };

      // Note: We don't start dragging yet - wait for movement threshold
    }
  }

  private handlePointerMove(x: number, y: number): void {
    if (!this.selectedPiece) return;

    // Check if we've moved beyond the drag threshold
    if (!this.hasMovedBeyondThreshold && this.pointerDownPos) {
      const distance = Math.sqrt(
        Math.pow(x - this.pointerDownPos.x, 2) + 
        Math.pow(y - this.pointerDownPos.y, 2)
      );
      
       if (distance > APP_CONFIG.SNAPPING.DRAG_THRESHOLD) {
        // Start dragging
        this.hasMovedBeyondThreshold = true;
        this.isDragging = true;
        this.selectedPiece.isDragging = true;
        
        // Bring entire group to front
        this.bringToFront(this.selectedPiece); // This now handles the whole group
        
        this.soundManager?.play('pickup');
      }
    }

    // Only move pieces if we've started dragging
    if (this.isDragging && this.selectedPiece) {
      // Calculate the delta movement
      const newX = x - this.selectedPiece.dragOffset.x;
      const newY = y - this.selectedPiece.dragOffset.y;
      const deltaX = newX - this.selectedPiece.x;
      const deltaY = newY - this.selectedPiece.y;

      // Move the selected piece
      this.selectedPiece.x = newX;
      this.selectedPiece.y = newY;

      // Move all connected pieces in the group
      const group = this.getAllPiecesInGroup(this.selectedPiece);
      for (const groupPiece of group) {
        if (groupPiece.id !== this.selectedPiece.id) {
          groupPiece.x += deltaX;
          groupPiece.y += deltaY;
        }
      }

      this.render();
    }
  }

  private handlePointerUp(): void {
    if (this.selectedPiece) {
      this.selectedPiece.isDragging = false;
      
      // Only process drop if we actually dragged (moved beyond threshold)
      if (this.hasMovedBeyondThreshold) {
        // Check for snapping - consider all pieces in the dragged group
        const draggedGroup = this.getAllPiecesInGroup(this.selectedPiece);
        let bestSnap: {
          snapTarget: { targetPiece: PuzzlePiece; snapX: number; snapY: number; connection: any; distance: number };
          groupPiece: PuzzlePiece;
        } | null = null;

        // Check snapping for each piece in the dragged group
        for (const groupPiece of draggedGroup) {
          const snapTarget = SnapDetector.findSnapTarget(
            groupPiece,
            this.pieces,
            groupPiece.x,
            groupPiece.y
          );

          Logger.debug(`Checking snap for piece ${groupPiece.id}: ${snapTarget ? 'found target' : 'no target'}`);
          if (snapTarget) {
            Logger.debug(`  Target: piece ${snapTarget.targetPiece.id}, distance: ${snapTarget.distance.toFixed(2)}`);
          }

          if (snapTarget && (!bestSnap || snapTarget.distance < bestSnap.snapTarget.distance)) {
            bestSnap = { snapTarget, groupPiece };
          }
        }

        if (bestSnap) {
          const { snapTarget, groupPiece } = bestSnap;

          // Calculate the delta needed to snap the entire group
          const deltaX = snapTarget.snapX - groupPiece.x;
          const deltaY = snapTarget.snapY - groupPiece.y;

          // Move the entire dragged group to the snap position
          for (const piece of draggedGroup) {
            piece.x += deltaX;
            piece.y += deltaY;
          }
          
          // Connect the pieces
          groupPiece.connectedPieces.add(snapTarget.targetPiece.id);
          snapTarget.targetPiece.connectedPieces.add(groupPiece.id);
          
          // Merge groups if target piece is already in a group
          this.mergeGroups(groupPiece, snapTarget.targetPiece);
          
          Logger.debug(
            `Snapped group piece ${groupPiece.id} to ${snapTarget.targetPiece.id} on edge ${snapTarget.connection.edge} (distance: ${snapTarget.distance.toFixed(2)})`
          );
          this.soundManager?.play('snap');

          // Check if the entire snapped group is correctly placed and lock all pieces
          const snappedGroup = this.getAllPiecesInGroup(this.selectedPiece);
          if (this.isGroupCorrectlyPlaced(snappedGroup)) {
            for (const piece of snappedGroup) {
              piece.isLocked = true;
              Logger.info(`Piece ${piece.id} locked in place!`);
            }
          }
        } else {
          this.soundManager?.play('drop');
        }

        // Update progress
        this.updateProgress();
        this.render();
      }
      // If we didn't move beyond threshold, it was just a click - do nothing
    }
     // Always check for correctly placed pieces after any interaction
     this.checkAndLockCorrectlyPlacedPieces();
     this.updateProgress();
     this.selectedPiece = null;
     this.isDragging = false;
     this.pointerDownPos = null;
     this.hasMovedBeyondThreshold = false;
  }

  private bringToFront(piece: PuzzlePiece): void {
    // If piece is part of a group, bring entire group to front
    const group = this.getAllPiecesInGroup(piece);

    // Remove all group pieces from array
    this.pieces = this.pieces.filter(p => !group.includes(p));

    // Add group pieces back in their original relative order
    // Sort group by their current z-index (position in original array)
    const sortedGroup = group.sort((a, b) => {
      const aIndex = this.pieces.findIndex(p => p === a);
      const bIndex = this.pieces.findIndex(p => p === b);
      return aIndex - bIndex;
    });

    // Add sorted group to end of array
    this.pieces.push(...sortedGroup);
  }

  private getAllPiecesInGroup(piece: PuzzlePiece): PuzzlePiece[] {
    const group: PuzzlePiece[] = [piece];
    const visited = new Set<number>([piece.id]);
    const toVisit = [...piece.connectedPieces];

    while (toVisit.length > 0) {
      const pieceId = toVisit.pop()!;
      if (visited.has(pieceId)) continue;
      visited.add(pieceId);

      const connectedPiece = this.pieces.find(p => p.id === pieceId);
      if (connectedPiece) {
        group.push(connectedPiece);
        for (const id of connectedPiece.connectedPieces) {
          if (!visited.has(id)) {
            toVisit.push(id);
          }
        }
      }
    }

    return group;
  }

  private mergeGroups(piece1: PuzzlePiece, piece2: PuzzlePiece): void {
    // Get all pieces in both groups
    const group1 = this.getAllPiecesInGroup(piece1);
    const group2 = this.getAllPiecesInGroup(piece2);

    // Merge the connected pieces sets
    const allPieceIds = new Set<number>();
    for (const p of [...group1, ...group2]) {
      allPieceIds.add(p.id);
    }

    // Update all pieces in the merged group
    for (const p of [...group1, ...group2]) {
      p.connectedPieces = new Set(allPieceIds);
      p.connectedPieces.delete(p.id); // Don't include self
    }

     Logger.debug(`Merged groups: ${group1.length} + ${group2.length} = ${allPieceIds.size} pieces`);
  }

  async loadPuzzle(imageUrl: string, config: PuzzleConfig): Promise<void> {
    try {
      // Load image
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
      });

      // Generate puzzle
      const puzzleConfig: PuzzleConfig = {
        rows: config.rows,
        cols: config.cols,
        shuffle: config.shuffle,
        preFlip: config.preFlip,
        preRotate: config.preRotate,
        canvasWidth: config.canvasWidth,
        canvasHeight: config.canvasHeight
      };

       this.pieces = await PuzzleGenerator.generatePuzzle(image, puzzleConfig);
       this.render();
      } catch (error) {
        Logger.error('Failed to load puzzle:', error instanceof Error ? error : undefined, error);
        // ErrorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'PuzzleBoard.loadPuzzle');
        throw error;
      }
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw pieces with visual feedback
    for (const piece of this.pieces) {
      // Highlight selected piece
      if (piece === this.selectedPiece) {
        this.ctx.save();
        this.ctx.shadowColor = '#007bff';
        this.ctx.shadowBlur = 10;
        piece.draw(this.ctx);
        this.ctx.restore();
      } else if (this.hintedPieces.has(piece.id)) {
        // Highlight hinted piece with green glow
        this.ctx.save();
        this.ctx.shadowColor = '#28a745';
        this.ctx.shadowBlur = 15;
        this.ctx.strokeStyle = '#28a745';
        this.ctx.lineWidth = 3;
        piece.draw(this.ctx);
        // Draw outline
        this.ctx.strokeRect(piece.x, piece.y, piece.width, piece.height);
        this.ctx.restore();
      } else {
        piece.draw(this.ctx);
      }
    }
  }

  // Public methods for external control
  flipSelectedPiece(): void {
    if (this.selectedPiece) {
      this.selectedPiece.flip();
      this.render();
    }
  }

  rotateSelectedPiece(): void {
    if (this.selectedPiece && this.selectedPiece.faceUp) {
      this.selectedPiece.rotate90();
      this.render();
    }
  }

  setProgressHandler(handler: (placed: number, total: number) => void): void {
    this.onProgressUpdate = handler;
  }

  private isPieceCorrectlyPlaced(piece: PuzzlePiece): boolean {
    // Use a fixed tolerance for piece placement accuracy
    const tolerance = APP_CONFIG.SNAPPING.DISTANCE; // 30 pixels
    const dx = piece.x - piece.originalPosition.x;
    const dy = piece.y - piece.originalPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isPlaced = distance < tolerance;
    Logger.debug(`Piece ${piece.id} distance: ${distance.toFixed(2)}, tolerance: ${tolerance}, placed: ${isPlaced}`);
    return isPlaced;
  }

  private isGroupCorrectlyPlaced(group: PuzzlePiece[]): boolean {
    // Check if all pieces in the group are correctly placed
    return group.every(piece => this.isPieceCorrectlyPlaced(piece));
  }

  private updateProgress(): void {
    // Count pieces that are connected to at least one other piece
    const connected = this.pieces.filter(p => p.connectedPieces.size > 0).length;
    const total = this.pieces.length;
    Logger.debug(`Progress update: ${connected}/${total} pieces connected`);
    this.onProgressUpdate?.(connected, total);
  }

  private rotateGroup(group: PuzzlePiece[]): void {
    if (group.length === 0) return;

    // Calculate the center of the group
    let centerX = 0;
    let centerY = 0;
    for (const piece of group) {
      centerX += piece.x + piece.width / 2;
      centerY += piece.y + piece.height / 2;
    }
    centerX /= group.length;
    centerY /= group.length;

    // Rotate each piece around the group center
    for (const piece of group) {
      // Calculate vector from center to piece center
      const pieceCenterX = piece.x + piece.width / 2;
      const pieceCenterY = piece.y + piece.height / 2;
      const dx = pieceCenterX - centerX;
      const dy = pieceCenterY - centerY;

      // Rotate the vector by 90 degrees counterclockwise
      const newDx = -dy;  // x' = -y, y' = x for 90° counterclockwise
      const newDy = dx;

      // Update piece position
      piece.x = centerX + newDx - piece.width / 2;
      piece.y = centerY + newDy - piece.height / 2;

      // Rotate the piece itself
      if (!piece.faceUp) {
        piece.flip();
        this.soundManager?.play('flip');
      } else {
        piece.rotate90();
        this.soundManager?.play('rotate');
      }
    }
  }

  private checkAndLockCorrectlyPlacedPieces(): void {
    for (const piece of this.pieces) {
      if (!piece.isLocked && this.isPieceCorrectlyPlaced(piece)) {
        piece.isLocked = true;
        Logger.info(`Piece ${piece.id} locked in place!`);
      }
    }
  }

  findHintPieces(): PuzzlePiece[] {
    const hintPieces: PuzzlePiece[] = [];

    for (const piece of this.pieces) {
      if (piece.isLocked) continue;
      if (!piece.faceUp) continue;

      // Check if this piece has any potential connections to pieces not in its group
      const group = this.getAllPiecesInGroup(piece);
      const groupIds = new Set(group.map(p => p.id));

      for (const otherPiece of this.pieces) {
        if (otherPiece.id === piece.id) continue;
        if (groupIds.has(otherPiece.id)) continue; // Skip pieces already in the group
        if (!otherPiece.faceUp) continue;

        // Check if these pieces can connect
        if (SnapDetector.checkConnection(piece, otherPiece)) {
          hintPieces.push(piece);
          break; // Only need one potential connection per piece
        }
      }
    }

    return hintPieces;
  }

  setHintPieces(pieces: PuzzlePiece[]): void {
    this.hintedPieces.clear();
    for (const piece of pieces) {
      this.hintedPieces.add(piece.id);
    }
    this.render();
  }

  clearHints(): void {
    this.hintedPieces.clear();
    this.render();
  }
}