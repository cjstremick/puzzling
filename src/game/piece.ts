// src/game/piece.ts - Individual puzzle piece class

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
    const bounds = this.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
  }

  // Flip the piece (face up/down)
  flip(): void {
    this.faceUp = !this.faceUp;
  }

  // Rotate the piece (only when face up)
  rotate90(): void {
    if (this.faceUp) {
      this.rotation = (this.rotation + 90) % 360;
    }
  }

  // Draw the piece on canvas
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply transformations for rotation (around piece center)
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-this.width / 2, -this.height / 2);

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
      ctx.fillStyle = this.faceUp ? '#ffffff' : '#8B4513';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, this.width, this.height);

      // Draw piece ID for debugging
      ctx.fillStyle = this.faceUp ? '#000000' : '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.id.toString(), this.width / 2, this.height / 2 + 4);
    }

    ctx.restore();
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
}