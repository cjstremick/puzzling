// src/game/puzzleBoard.ts - Canvas rendering and interaction logic

import { PuzzlePiece } from './piece';
import type { PuzzleConfig } from './types';
import type { PieceConnection } from './piece';
import { PuzzleGenerator } from './puzzleGenerator';
import { TouchHandler, SnapDetector, type PointerEvent } from '../utils/touch';
import { APP_CONFIG } from '../config/appConfig';
import { SoundManager } from '../audio/soundManager';
import { Logger } from '../utils/logger';
import { eventBus } from '../utils/eventEmitter';
import { GameLoop } from '../utils/gameLoop';

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
  private onPiecesChanged?: (pieces: PuzzlePiece[]) => void;
  private soundManager?: SoundManager;
  private gameLoop: GameLoop;
  private needsRender = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.touchHandler = new TouchHandler(canvas);

    // Initialize game loop
    this.gameLoop = new GameLoop({
      update: this.update.bind(this),
      render: this.render.bind(this)
    });

    this.setupEventListeners();
    this.gameLoop.start();
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
     // If we have a selected piece, handle potential dragging
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
        this.needsRender = true;
        break;
      }
    }
  }

   private handlePointerDown(x: number, y: number): void {
     // Find all pieces under cursor, prioritizing smaller clusters
     let candidates: { piece: PuzzlePiece; groupSize: number }[] = [];

     // Iterate from top to bottom (back to front in array)
     for (let i = this.pieces.length - 1; i >= 0; i--) {
       const piece = this.pieces[i];
       if (!piece.isLocked && piece.containsPoint(x, y)) {
         const groupSize = this.getAllPiecesInGroup(piece).length;
         candidates.push({ piece, groupSize });
       }
     }

     if (candidates.length > 0) {
       // Select the piece from the smallest cluster (prioritize smaller groups)
       candidates.sort((a, b) => a.groupSize - b.groupSize);
       const selectedCandidate = candidates[0];
       const newSelected = selectedCandidate.piece;

        if (this.selectedPiece === newSelected) {
          // Clicking selected piece deselects it
          eventBus.emit('piece:deselected', {});
          this.selectedPiece = null;
        } else {
          // Select new piece
          this.selectedPiece = newSelected;
          this.bringToFront(this.selectedPiece);
          eventBus.emit('piece:selected', { piece: this.selectedPiece });

         // Set drag offset relative to the selected piece
         this.selectedPiece.dragOffset = {
           x: x - selectedCandidate.piece.x,
           y: y - selectedCandidate.piece.y
         };

         Logger.debug(`Selected piece ${selectedCandidate.piece.id} from cluster of ${selectedCandidate.groupSize} pieces`);
       }
     } else {
       // Clicked empty space, deselect any selected piece
       this.selectedPiece = null;
     }

     // Reset drag state
     this.isDragging = false;
     this.hasMovedBeyondThreshold = false;
     this.pointerDownPos = { x, y };
   }

   private handlePointerMove(x: number, y: number): void {
     if (!this.selectedPiece) return;

     // Check if we've moved beyond the drag threshold to start dragging
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
         this.bringToFront(this.selectedPiece);
         
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

        eventBus.emit('piece:moved', { piece: this.selectedPiece, x: newX, y: newY });
        this.needsRender = true;
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
            snapTarget: { targetPiece: PuzzlePiece; snapX: number; snapY: number; connection: PieceConnection; distance: number };
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
            eventBus.emit('piece:snapped', { piece: groupPiece, targetPiece: snapTarget.targetPiece });
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
         this.needsRender = true;

         // Deselect after drag operation
         this.selectedPiece = null;
       }
       // If we didn't move beyond threshold, it was just a click - keep piece selected
     }
     
     // Always check for correctly placed pieces after any interaction
     this.checkAndLockCorrectlyPlacedPieces();
     this.updateProgress();
     
     // Reset drag state
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
        this.needsRender = true;
       } catch (error) {
         Logger.error('Failed to load puzzle:', error instanceof Error ? error : undefined, error);
         // ErrorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'PuzzleBoard.loadPuzzle');
         throw error;
       }
   }

  private update(_deltaTime: number): void {
    // Update logic here (currently empty as the game is event-driven)
    // Could be used for animations, physics, etc. in the future
  }

  render(): void {
    // Only render if something has changed
    if (!this.needsRender) return;

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
      } else {
        piece.draw(this.ctx);
      }
    }

    this.needsRender = false;
  }

  // Public methods for external control
  flipSelectedPiece(): void {
    if (this.selectedPiece) {
      this.selectedPiece.flip();
      eventBus.emit('piece:flipped', { piece: this.selectedPiece });
      this.render();
      // Notify that pieces have changed
      this.onPiecesChanged?.(this.pieces);
    }
  }

  rotateSelectedPiece(): void {
    if (this.selectedPiece && this.selectedPiece.faceUp) {
      this.selectedPiece.rotate90();
      eventBus.emit('piece:rotated', { piece: this.selectedPiece });
      this.render();
      // Notify that pieces have changed
      this.onPiecesChanged?.(this.pieces);
    }
  }

  clearSelection(): void {
    this.selectedPiece = null;
    this.render();
  }

  setProgressHandler(handler: (placed: number, total: number) => void): void {
    this.onProgressUpdate = handler;
  }

  setPiecesChangedHandler(handler: (pieces: PuzzlePiece[]) => void): void {
    this.onPiecesChanged = handler;
  }

  hasConnectedPieces(): boolean {
    const connectedCount = this.pieces.filter(piece => piece.connectedPieces.size > 0).length;
    Logger.debug(`Checking for connected pieces: ${connectedCount} pieces connected out of ${this.pieces.length}`);
    return connectedCount > 0;
  }

  // Restore pieces from saved state
  restorePieces(pieces: PuzzlePiece[]): void {
    this.pieces = pieces;
  }

  // Force a render on the next frame (for external triggers)
  forceRender(): void {
    this.needsRender = true;
  }

  // Get current pieces (for saving state)
  getPieces(): PuzzlePiece[] {
    return [...this.pieces];
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
    // Count the size of the largest connected component (cluster)
    const largestClusterSize = this.getLargestClusterSize();
    const total = this.pieces.length;
    Logger.debug(`Progress update: ${largestClusterSize}/${total} pieces in largest cluster`);
    this.onProgressUpdate?.(largestClusterSize, total);
  }

  private getLargestClusterSize(): number {
    const visited = new Set<number>();
    let largestSize = 0;

    for (const piece of this.pieces) {
      if (!visited.has(piece.id)) {
        const cluster = this.getAllPiecesInGroup(piece);
        cluster.forEach(p => visited.add(p.id));
        largestSize = Math.max(largestSize, cluster.length);
      }
    }

    return largestSize;
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

    // Notify that pieces have changed
    this.onPiecesChanged?.(this.pieces);
  }

  private checkAndLockCorrectlyPlacedPieces(): void {
    for (const piece of this.pieces) {
      if (!piece.isLocked && this.isPieceCorrectlyPlaced(piece)) {
        piece.isLocked = true;
        Logger.info(`Piece ${piece.id} locked in place!`);
      }
    }
  }

  // Clean up resources and event listeners
  destroy(): void {
    // Clean up event listeners
    this.cleanupEventListeners();

    // Clear piece caches to free memory
    for (const piece of this.pieces) {
      // Clear cached canvas if it exists
      if ((piece as any).cachedCanvas) {
        (piece as any).cachedCanvas = undefined;
      }
    }

    // Clear pieces array
    this.pieces = [];

    // Clear canvas context
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    Logger.debug('PuzzleBoard destroyed and memory cleaned up');
  }

  // Clean up event listeners (called when destroying or re-initializing)
  private cleanupEventListeners(): void {
    // Remove all event listeners from canvas
    // Note: Since we don't store listener references, we clear by cloning and replacing
    const newCanvas = this.canvas.cloneNode() as HTMLCanvasElement;
    this.canvas.parentNode?.replaceChild(newCanvas, this.canvas);
    this.canvas = newCanvas;
    this.ctx = this.canvas.getContext('2d')!;

    // Re-setup event listeners if needed (not called during destroy)
    // this.setupEventListeners();
  }
}