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
  private pointerDownScreenPos: { x: number; y: number } | null = null;
  private hasMovedBeyondThreshold: boolean = false;
  private touchHandler: TouchHandler;
  private onProgressUpdate?: (placed: number, total: number) => void;
  private onPiecesChanged?: (pieces: PuzzlePiece[]) => void;
  private soundManager?: SoundManager;
  private gameLoop: GameLoop;
  private needsRender = false;
  private camera = { scale: 1, offsetX: 0, offsetY: 0 };
  private readonly MIN_SCALE = 0.25;
  private readonly MAX_SCALE = 4;
  private activePointers = new Map<number, { x: number; y: number; pointerType: string }>();
  private dragPointerId: number | null = null;
  private panPointerId: number | null = null;
  private isPinching = false;
  private pinchStart: {
    distance: number;
    midpoint: { x: number; y: number };
    scale: number;
    offsetX: number;
    offsetY: number;
    worldPoint: { x: number; y: number };
  } | null = null;
  private panLast: { x: number; y: number } | null = null;
  private activeAnimation:
    | {
        startTime: number;
        duration: number;
        startPieces: Map<number, { x: number; y: number; rotation: number }>;
        targetPieces: Map<number, { x: number; y: number; rotation: number }>;
        startCamera: { scale: number; offsetX: number; offsetY: number };
        targetCamera: { scale: number; offsetX: number; offsetY: number };
        onComplete?: () => void;
      }
    | null = null;
  private wheelHandler?: (event: WheelEvent) => void;

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

    this.wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      const zoomIntensity = 0.0015;
      const scaleFactor = Math.exp(-event.deltaY * zoomIntensity);
      this.zoomAtScreenPoint(event.offsetX, event.offsetY, scaleFactor);
    };
    this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  private onPointerStart(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, { x: event.x, y: event.y, pointerType: event.pointerType });

    if (this.activePointers.size === 2) {
      this.cancelDragIfActive();
      this.startPinchGesture();
      return;
    }

    if (this.isPinching) return;

    const world = this.screenToWorld(event.x, event.y);
    this.handlePointerDown(world.x, world.y, event.x, event.y, event.pointerId);
  }

   private onPointerMove(event: PointerEvent): void {
     const pointer = this.activePointers.get(event.pointerId);
     if (pointer) {
       pointer.x = event.x;
       pointer.y = event.y;
     }

     if (this.activePointers.size === 2) {
       this.updatePinchGesture();
       return;
     }

     if (this.isPinching) return;

     if (this.dragPointerId === event.pointerId && this.selectedPiece) {
       const world = this.screenToWorld(event.x, event.y);
       this.handlePointerMove(world.x, world.y, event.x, event.y);
       return;
     }

     if (this.panPointerId === event.pointerId) {
       this.handlePanMove(event.x, event.y);
     }
   }

   private onPointerEnd(event: PointerEvent): void {
     Logger.debug('Pointer end:', event.type);
     this.activePointers.delete(event.pointerId);

     if (this.isPinching && this.activePointers.size < 2) {
       this.isPinching = false;
       this.pinchStart = null;
     }

     if (this.dragPointerId === event.pointerId) {
       this.handlePointerUp();
       this.dragPointerId = null;
     }

     if (this.panPointerId === event.pointerId) {
       this.panPointerId = null;
       this.panLast = null;
     }
   }

  private onDoubleTap(x: number, y: number): void {
    if (this.isPinching) return;
    const world = this.screenToWorld(x, y);
    // Find piece under tap
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (piece.containsPoint(world.x, world.y)) {
        // Get the entire connected group and rotate it as a unit
        const group = this.getAllPiecesInGroup(piece);
        this.rotateGroup(group);
        this.needsRender = true;
        break;
      }
    }
  }

  private handlePointerDown(
    x: number,
    y: number,
    screenX: number,
    screenY: number,
    pointerId: number
  ): void {
    if (this.activeAnimation) return;
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
     this.pointerDownScreenPos = { x: screenX, y: screenY };

     if (this.selectedPiece) {
       this.dragPointerId = pointerId;
       this.panPointerId = null;
       this.panLast = null;
     } else {
       this.dragPointerId = null;
       this.panPointerId = pointerId;
       this.panLast = { x: screenX, y: screenY };
     }
    }

  private handlePointerMove(x: number, y: number, screenX: number, screenY: number): void {
    if (this.activeAnimation) return;
    if (!this.selectedPiece) return;

     // Check if we've moved beyond the drag threshold to start dragging
     if (!this.hasMovedBeyondThreshold && this.pointerDownScreenPos) {
      const distance = Math.sqrt(
        Math.pow(screenX - this.pointerDownScreenPos.x, 2) + 
        Math.pow(screenY - this.pointerDownScreenPos.y, 2)
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
    if (this.activeAnimation) return;
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
      this.pointerDownScreenPos = null;
      this.hasMovedBeyondThreshold = false;
    }

  private bringToFront(piece: PuzzlePiece): void {
    // If piece is part of a group, bring entire group to front
    const group = this.getAllPiecesInGroup(piece);

    const orderedPieces = [...this.pieces];
    const groupSet = new Set(group);
    // Remove all group pieces from array
    this.pieces = this.pieces.filter(p => !groupSet.has(p));

    // Add group pieces back in their original relative order
    const sortedGroup = group
      .map((p) => ({ p, index: orderedPieces.findIndex(piece => piece === p) }))
      .sort((a, b) => a.index - b.index)
      .map(({ p }) => p);

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
      this.resetInteractionState();

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

  private resetInteractionState(): void {
    this.selectedPiece = null;
    this.isDragging = false;
    this.hasMovedBeyondThreshold = false;
    this.pointerDownScreenPos = null;
    this.dragPointerId = null;
    this.panPointerId = null;
    this.panLast = null;
    this.activePointers.clear();
    this.isPinching = false;
    this.pinchStart = null;
    this.activeAnimation = null;
    this.camera = { scale: 1, offsetX: 0, offsetY: 0 };
  }

  private update(_deltaTime: number): void {
    // Update logic here (currently empty as the game is event-driven)
    // Could be used for animations, physics, etc. in the future
    if (!this.activeAnimation) return;

    const now = performance.now();
    const elapsed = now - this.activeAnimation.startTime;
    const progress = Math.min(1, elapsed / this.activeAnimation.duration);
    const eased = this.easeInOutCubic(progress);

    for (const piece of this.pieces) {
      const start = this.activeAnimation.startPieces.get(piece.id);
      const target = this.activeAnimation.targetPieces.get(piece.id);
      if (!start || !target) continue;

      piece.x = this.lerp(start.x, target.x, eased);
      piece.y = this.lerp(start.y, target.y, eased);
      piece.rotation = this.lerpAngle(start.rotation, target.rotation, eased);
    }

    this.camera.scale = this.lerp(this.activeAnimation.startCamera.scale, this.activeAnimation.targetCamera.scale, eased);
    this.camera.offsetX = this.lerp(this.activeAnimation.startCamera.offsetX, this.activeAnimation.targetCamera.offsetX, eased);
    this.camera.offsetY = this.lerp(this.activeAnimation.startCamera.offsetY, this.activeAnimation.targetCamera.offsetY, eased);

    this.needsRender = true;

    if (progress >= 1) {
      this.finishAnimation();
    }
  }

  render(): void {
    // Only render if something has changed
    if (!this.needsRender && !this.activeAnimation) return;

    // Clear canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform
    this.ctx.setTransform(
      this.camera.scale,
      0,
      0,
      this.camera.scale,
      this.camera.offsetX,
      this.camera.offsetY
    );

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

  resetView(): void {
    this.camera = { scale: 1, offsetX: 0, offsetY: 0 };
    this.needsRender = true;
  }

  fitViewToPieces(): void {
    if (this.pieces.length === 0) return;

    const targets = new Map<number, { x: number; y: number; rotation: number }>();
    for (const piece of this.pieces) {
      targets.set(piece.id, { x: piece.x, y: piece.y, rotation: piece.rotation });
    }

    const bounds = this.getPiecesBounds(targets);
    this.camera = this.getFitCamera(bounds);
    this.needsRender = true;
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
    this.resetInteractionState();
    this.needsRender = true;
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
    return group.every(piece => piece.rotation === 0 && this.isPieceCorrectlyPlaced(piece));
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

  public animateCompletionNormalize(onComplete?: () => void): void {
    if (this.pieces.length === 0) {
      onComplete?.();
      return;
    }

    this.clearSelection();
    const solutionRotation = this.normalizeRotation(this.pieces[0].rotation);
    const centroid = this.getGroupCentroid(this.pieces);

    const targetPieces = new Map<number, { x: number; y: number; rotation: number }>();
    for (const piece of this.pieces) {
      const center = { x: piece.x + piece.width / 2, y: piece.y + piece.height / 2 };
      const rotatedCenter = this.rotatePoint(center, centroid, -solutionRotation);
      const rotatedX = rotatedCenter.x - piece.width / 2;
      const rotatedY = rotatedCenter.y - piece.height / 2;
      targetPieces.set(piece.id, { x: rotatedX, y: rotatedY, rotation: 0 });
    }

    const anchor = this.pieces[0];
    const anchorTarget = targetPieces.get(anchor.id);
    if (anchorTarget) {
      const dx = anchor.originalPosition.x - anchorTarget.x;
      const dy = anchor.originalPosition.y - anchorTarget.y;
      for (const [id, target] of targetPieces) {
        targetPieces.set(id, {
          x: target.x + dx,
          y: target.y + dy,
          rotation: target.rotation
        });
      }
    }

    const bounds = this.getPiecesBounds(targetPieces);
    const targetCamera = this.getFitCamera(bounds);

    this.animateToState(targetPieces, targetCamera, 350, () => {
      for (const piece of this.pieces) {
        piece.rotation = 0;
      }
      this.onPiecesChanged?.(this.pieces);
      onComplete?.();
    });
  }

  private screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.offsetX) / this.camera.scale,
      y: (y - this.camera.offsetY) / this.camera.scale
    };
  }

  private zoomAtScreenPoint(screenX: number, screenY: number, scaleFactor: number): void {
    const worldPoint = this.screenToWorld(screenX, screenY);
    const newScale = this.clampScale(this.camera.scale * scaleFactor);
    if (newScale === this.camera.scale) return;

    this.camera.scale = newScale;
    this.camera.offsetX = screenX - worldPoint.x * newScale;
    this.camera.offsetY = screenY - worldPoint.y * newScale;
    this.needsRender = true;
  }

  private clampScale(value: number): number {
    return Math.min(this.MAX_SCALE, Math.max(this.MIN_SCALE, value));
  }

  private handlePanMove(screenX: number, screenY: number): void {
    if (!this.panLast) return;
    const deltaX = screenX - this.panLast.x;
    const deltaY = screenY - this.panLast.y;
    this.camera.offsetX += deltaX;
    this.camera.offsetY += deltaY;
    this.panLast = { x: screenX, y: screenY };
    this.needsRender = true;
  }

  private startPinchGesture(): void {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) return;

    const [p1, p2] = points;
    const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const worldPoint = this.screenToWorld(midpoint.x, midpoint.y);

    this.isPinching = true;
    this.pinchStart = {
      distance,
      midpoint,
      scale: this.camera.scale,
      offsetX: this.camera.offsetX,
      offsetY: this.camera.offsetY,
      worldPoint
    };
  }

  private updatePinchGesture(): void {
    if (!this.pinchStart) return;
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) return;

    const [p1, p2] = points;
    const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const scaleFactor = distance / this.pinchStart.distance;
    const newScale = this.clampScale(this.pinchStart.scale * scaleFactor);

    this.camera.scale = newScale;
    this.camera.offsetX = midpoint.x - this.pinchStart.worldPoint.x * newScale;
    this.camera.offsetY = midpoint.y - this.pinchStart.worldPoint.y * newScale;
    this.needsRender = true;
  }

  private cancelDragIfActive(): void {
    if (!this.selectedPiece) return;
    this.selectedPiece.isDragging = false;
    this.isDragging = false;
    this.hasMovedBeyondThreshold = false;
    this.pointerDownScreenPos = null;
    this.dragPointerId = null;
  }

  private animateToState(
    targetPieces: Map<number, { x: number; y: number; rotation: number }>,
    targetCamera: { scale: number; offsetX: number; offsetY: number },
    duration: number,
    onComplete?: () => void
  ): void {
    const startPieces = new Map<number, { x: number; y: number; rotation: number }>();
    for (const piece of this.pieces) {
      startPieces.set(piece.id, { x: piece.x, y: piece.y, rotation: piece.rotation });
    }

    this.activeAnimation = {
      startTime: performance.now(),
      duration,
      startPieces,
      targetPieces,
      startCamera: { ...this.camera },
      targetCamera,
      onComplete
    };
  }

  private finishAnimation(): void {
    if (!this.activeAnimation) return;

    for (const piece of this.pieces) {
      const target = this.activeAnimation.targetPieces.get(piece.id);
      if (!target) continue;
      piece.x = target.x;
      piece.y = target.y;
      piece.rotation = target.rotation;
    }

    this.camera = { ...this.activeAnimation.targetCamera };

    const onComplete = this.activeAnimation.onComplete;
    this.activeAnimation = null;
    this.needsRender = true;
    onComplete?.();
  }

  private getGroupCentroid(pieces: PuzzlePiece[]): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    for (const piece of pieces) {
      totalX += piece.x + piece.width / 2;
      totalY += piece.y + piece.height / 2;
    }
    return { x: totalX / pieces.length, y: totalY / pieces.length };
  }

  private rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, degrees: number): { x: number; y: number } {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  }

  private normalizeRotation(degrees: number): number {
    const value = degrees % 360;
    return value < 0 ? value + 360 : value;
  }

  private getPiecesBounds(targetPieces: Map<number, { x: number; y: number; rotation: number }>): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const piece of this.pieces) {
      const target = targetPieces.get(piece.id);
      if (!target) continue;
      minX = Math.min(minX, target.x);
      minY = Math.min(minY, target.y);
      maxX = Math.max(maxX, target.x + piece.width);
      maxY = Math.max(maxY, target.y + piece.height);
    }

    return { minX, minY, maxX, maxY };
  }

  private getFitCamera(bounds: { minX: number; minY: number; maxX: number; maxY: number }): {
    scale: number;
    offsetX: number;
    offsetY: number;
  } {
    const padding = 48;
    const statusBarHeight = APP_CONFIG.CANVAS.STATUS_BAR_HEIGHT;
    const viewWidth = this.canvas.width - padding * 2;
    const viewHeight = this.canvas.height - statusBarHeight - padding * 2;
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

    const scale = this.clampScale(Math.min(viewWidth / boundsWidth, viewHeight / boundsHeight));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const viewCenterX = this.canvas.width / 2;
    const viewCenterY = (this.canvas.height - statusBarHeight) / 2;

    return {
      scale,
      offsetX: viewCenterX - centerX * scale,
      offsetY: viewCenterY - centerY * scale
    };
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private lerpAngle(start: number, end: number, t: number): number {
    const delta = ((end - start + 540) % 360) - 180;
    return start + delta * t;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private checkAndLockCorrectlyPlacedPieces(): void {
    for (const piece of this.pieces) {
      if (!piece.isLocked && piece.rotation === 0 && this.isPieceCorrectlyPlaced(piece)) {
        piece.isLocked = true;
        Logger.info(`Piece ${piece.id} locked in place!`);
      }
    }
  }

  // Clean up resources and event listeners
  destroy(): void {
    // Clean up event listeners
    this.cleanupEventListeners();
    this.activeAnimation = null;

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

  rebindInputHandlers(): void {
    this.touchHandler.destroy();
    this.touchHandler = new TouchHandler(this.canvas);
    if (this.wheelHandler) {
      this.canvas.removeEventListener('wheel', this.wheelHandler);
    }
    this.setupEventListeners();
  }

  // Clean up event listeners (called when destroying or re-initializing)
  private cleanupEventListeners(): void {
    this.touchHandler.destroy();
    if (this.wheelHandler) {
      this.canvas.removeEventListener('wheel', this.wheelHandler);
    }
  }
}
