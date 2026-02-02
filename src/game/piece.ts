import type { SerializedPuzzlePiece } from './types';

export interface PieceConnection {
  edge: 'top' | 'right' | 'bottom' | 'left';
  type: 'tab' | 'blank' | null; // null means straight edge
  matingPieceId?: number;
  matingEdge?: 'top' | 'right' | 'bottom' | 'left';
}

export class PuzzlePiece {
  public id: number;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public rotation: number = 0; // degrees
  public faceUp: boolean = false;
  public imageData: ImageData | undefined;
  public connections: PieceConnection[] = [];
  public isDragging: boolean = false;
  public dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  public isLocked: boolean = false;
  public originalPosition: { x: number; y: number };
  public connectedPieces: Set<number> = new Set(); // IDs of pieces snapped together
  public groupId: number | null = null; // ID of the group this piece belongs to

  private cachedCanvas?: OffscreenCanvas | HTMLCanvasElement;
  private cacheValid: boolean = false;

  constructor(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    imageData?: ImageData
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.imageData = imageData;
    this.originalPosition = { x, y };
  }

  // Get the bounding box of the piece (including any protruding tabs)
  getBounds(): { x: number; y: number; width: number; height: number } {
    // Account for rotation - for 90/270 degrees, swap width/height
    const isRotated90 = Math.abs(this.rotation % 180) === 90;
    return {
      x: this.x,
      y: this.y,
      width: isRotated90 ? this.height : this.width,
      height: isRotated90 ? this.width : this.height
    };
  }

  // Check if point is inside piece (for mouse interaction)
  containsPoint(x: number, y: number): boolean {
    if (Math.abs(this.rotation % 180) === 0) {
      // No rotation or 180 degrees - use simple bounds
      return x >= this.x && x <= this.x + this.width &&
             y >= this.y && y <= this.y + this.height;
    } else {
      // 90 or 270 degrees rotation - check if point is within rotated bounds
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      
      // Transform point to piece's local coordinates (unrotated)
      const dx = x - centerX;
      const dy = y - centerY;
      const cos = Math.cos(-this.rotation * Math.PI / 180);
      const sin = Math.sin(-this.rotation * Math.PI / 180);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      
      // Check if transformed point is within original bounds
      return localX >= -this.width / 2 && localX <= this.width / 2 &&
             localY >= -this.height / 2 && localY <= this.height / 2;
    }
  }

  // Flip the piece (face up/down)
  flip(): void {
    this.faceUp = !this.faceUp;
    this.invalidateCache();
  }

  // Rotate the piece (only when face up)
  rotate90(): void {
    if (this.faceUp) {
      this.rotation = (this.rotation + 90) % 360;
      this.invalidateCache();
    }
  }

  // Invalidate the render cache when piece state changes
  private invalidateCache(): void {
    this.cacheValid = false;
  }

  // Draw the piece on canvas
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply transformations for rotation (around piece center)
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-this.width / 2, -this.height / 2);

    // Use cached rendering if available and valid
    if (this.cacheValid && this.cachedCanvas) {
      ctx.drawImage(this.cachedCanvas, 0, 0, this.width, this.height);
    } else {
      // Render piece content
      this.renderPieceContent(ctx);
      // Cache the rendering for future use
      this.cacheRendering();
    }

    ctx.restore();
  }

  // Render the piece content (image or placeholder)
  private renderPieceContent(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    if (this.imageData && this.faceUp) {
      // Draw image data - putImageData doesn't respect transforms, so use a temporary canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.imageData.width;
      tempCanvas.height = this.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(this.imageData, 0, 0);

      // Draw the temp canvas as an image (which respects transforms)
      ctx.drawImage(tempCanvas, 0, 0, this.width, this.height);
    } else {
      // Draw placeholder (face down or no image)
      ctx.fillStyle = this.faceUp ? '#ffffff' : '#F4A460';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, this.width, this.height);
    }
  }

  // Cache the piece rendering for performance
  private cacheRendering(): void {
    // Create or reuse offscreen canvas
    if (!this.cachedCanvas) {
      try {
        // Try OffscreenCanvas first (better performance)
        this.cachedCanvas = new OffscreenCanvas(this.width, this.height);
      } catch {
        // Fallback to regular canvas
        this.cachedCanvas = document.createElement('canvas');
        this.cachedCanvas.width = this.width;
        this.cachedCanvas.height = this.height;
      }
    }

    const cacheCtx = this.cachedCanvas.getContext('2d')!;
    cacheCtx.clearRect(0, 0, this.width, this.height);

    // Render piece content to cache
    this.renderPieceContent(cacheCtx);
    this.cacheValid = true;
  }

  // Clone piece for state management
  clone(): PuzzlePiece {
    const cloned = new PuzzlePiece(this.id, this.x, this.y, this.width, this.height, this.imageData);
    cloned.rotation = this.rotation;
    cloned.faceUp = this.faceUp;
    cloned.connections = [...this.connections];
    cloned.connectedPieces = new Set(this.connectedPieces);
    cloned.groupId = this.groupId;
    return cloned;
  }

  // Serialize piece for persistence
  toJSON(): SerializedPuzzlePiece {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
      faceUp: this.faceUp,
      connections: this.connections,
      isDragging: this.isDragging,
      dragOffset: this.dragOffset,
      isLocked: this.isLocked,
      originalPosition: this.originalPosition,
      connectedPieces: Array.from(this.connectedPieces),
      groupId: this.groupId
      // Note: imageData is not serialized - will be recreated from photo
    };
  }
}