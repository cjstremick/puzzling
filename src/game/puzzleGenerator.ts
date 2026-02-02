// src/game/puzzleGenerator.ts - Generates puzzle pieces from image

import { PuzzlePiece } from './piece';
import type { PuzzleConfig } from './types';
import type { PieceConnection } from './piece';

export class PuzzleGenerator {
  // private static readonly PIECE_OVERLAP = 10; // pixels pieces can overlap for snapping - TODO: implement snapping
  private static readonly TAB_SIZE = 20; // size of tabs/blanks

  static async generatePuzzle(image: HTMLImageElement, config: PuzzleConfig): Promise<PuzzlePiece[]> {
    const { rows, cols, shuffle, preFlip, preRotate, canvasWidth, canvasHeight } = config;

    // Calculate piece dimensions
    const pieceWidth = Math.floor(image.width / cols);
    const pieceHeight = Math.floor(image.height / rows);

    const pieces: PuzzlePiece[] = [];

    // Create canvas for image processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    // Generate pieces
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pieceId = row * cols + col;

        // Calculate piece position with some randomization
        const baseX = col * pieceWidth;
        const baseY = row * pieceHeight;

        // Add some jitter to make pieces unique
        const jitterX = (Math.random() - 0.5) * 4;
        const jitterY = (Math.random() - 0.5) * 4;

        const piece = new PuzzlePiece(
          pieceId,
          baseX + jitterX,
          baseY + jitterY,
          pieceWidth,
          pieceHeight
        );

        // Use the non-jittered grid position as the solved/original position.
        // This ensures snapping/locking aligns pieces perfectly.
        piece.originalPosition = { x: baseX, y: baseY };

        // Extract image data for this piece
        try {
          const imageData = ctx.getImageData(baseX, baseY, pieceWidth, pieceHeight);
          piece.imageData = imageData;
         } catch {
           console.warn('Could not extract image data for piece', pieceId);
        }

        // Set initial face state based on preFlip setting
        // preFlip = true (CHECKED): all pieces start face-UP (image visible, all ready to play)
        // preFlip = false (UNCHECKED): pieces randomly face-UP or face-DOWN (approximately half flipped)
        if (preFlip) {
          piece.faceUp = true;
        } else {
          piece.faceUp = Math.random() > 0.5;
        }

        // Set initial rotation based on preRotate setting
        // preRotate = true (CHECKED): all pieces start at 0° rotation (correct orientation)
        // preRotate = false (UNCHECKED): pieces randomly rotated in 90° increments
        if (preRotate) {
          piece.rotation = 0;
        } else {
          piece.rotation = Math.floor(Math.random() * 4) * 90; // 0°, 90°, 180°, or 270°
        }

        // Generate edge connections (simplified for now)
        this.generateEdgeConnections(piece, row, col, rows, cols);

        pieces.push(piece);
      }
    }

    // Shuffle pieces if requested
    if (shuffle) {
      this.shufflePieces(pieces, canvasWidth, canvasHeight);
    }

    return pieces;
  }

  private static generateEdgeConnections(
    piece: PuzzlePiece,
    row: number,
    col: number,
    totalRows: number,
    totalCols: number
  ): void {
    // Top edge
    if (row > 0) {
      piece.connections[0] = {
        edge: 'top',
        type: Math.random() > 0.5 ? 'tab' : 'blank',
        matingPieceId: (row - 1) * totalCols + col,
        matingEdge: 'bottom'
      };
    }

    // Right edge
    if (col < totalCols - 1) {
      piece.connections[1] = {
        edge: 'right',
        type: Math.random() > 0.5 ? 'tab' : 'blank',
        matingPieceId: row * totalCols + col + 1,
        matingEdge: 'left'
      };
    }

    // Bottom edge
    if (row < totalRows - 1) {
      piece.connections[2] = {
        edge: 'bottom',
        type: Math.random() > 0.5 ? 'tab' : 'blank',
        matingPieceId: (row + 1) * totalCols + col,
        matingEdge: 'top'
      };
    }

    // Left edge
    if (col > 0) {
      piece.connections[3] = {
        edge: 'left',
        type: Math.random() > 0.5 ? 'tab' : 'blank',
        matingPieceId: row * totalCols + col - 1,
        matingEdge: 'right'
      };
    }
  }

  private static shufflePieces(pieces: PuzzlePiece[], canvasWidth: number, canvasHeight: number): void {
    // Ensure minimum canvas size for proper spreading
    canvasWidth = Math.max(canvasWidth, 800);
    canvasHeight = Math.max(canvasHeight, 600);

    // Calculate piece dimensions (assume square pieces for scattering)
    const maxPieceSize = Math.max(...pieces.map(p => Math.max(p.width, p.height)));

    // Shuffle pieces array for randomization
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    // Scatter pieces randomly across canvas, allowing some overlap
    for (let i = 0; i < pieces.length; i++) {
      // Add random jitter to create chaotic distribution
      const jitterX = (Math.random() - 0.5) * canvasWidth * 0.8; // 80% of canvas width for spread
      const jitterY = (Math.random() - 0.5) * canvasHeight * 0.8; // 80% of canvas height for spread

      // Center the distribution around the canvas center
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      pieces[i].x = centerX + jitterX;
      pieces[i].y = centerY + jitterY;

      // Ensure pieces stay within canvas bounds (with some tolerance for overlap)
      pieces[i].x = Math.max(-maxPieceSize * 0.3, Math.min(pieces[i].x, canvasWidth - maxPieceSize * 0.7));
      pieces[i].y = Math.max(-maxPieceSize * 0.3, Math.min(pieces[i].y, canvasHeight - maxPieceSize * 0.7));
    }
  }

  // Create interlocking bezier curve path for piece edges
  static createPiecePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    connections: PieceConnection[]
  ): void {
    // This is a simplified implementation
    // In a full implementation, this would use the connection data
    // to create proper interlocking bezier curves

    ctx.beginPath();
    ctx.moveTo(0, 0);

    // Top edge
    if (connections[0]?.type === 'tab') {
      // Draw tab
      this.drawTab(ctx, 0, 0, width, 0, false);
    } else if (connections[0]?.type === 'blank') {
      // Draw blank (inverse of tab)
      this.drawTab(ctx, 0, 0, width, 0, true);
    } else {
      ctx.lineTo(width, 0);
    }

    // Right edge
    if (connections[1]?.type === 'tab') {
      this.drawTab(ctx, width, 0, width, height, false);
    } else if (connections[1]?.type === 'blank') {
      this.drawTab(ctx, width, 0, width, height, true);
    } else {
      ctx.lineTo(width, height);
    }

    // Bottom edge
    if (connections[2]?.type === 'tab') {
      this.drawTab(ctx, width, height, 0, height, false);
    } else if (connections[2]?.type === 'blank') {
      this.drawTab(ctx, width, height, 0, height, true);
    } else {
      ctx.lineTo(0, height);
    }

    // Left edge
    if (connections[3]?.type === 'tab') {
      this.drawTab(ctx, 0, height, 0, 0, false);
    } else if (connections[3]?.type === 'blank') {
      this.drawTab(ctx, 0, height, 0, 0, true);
    } else {
      ctx.lineTo(0, 0);
    }

    // Right edge
    if (connections[1]?.type === 'tab') {
      this.drawTab(ctx, width, 0, width, height, false);
    } else if (connections[1]?.type === 'blank') {
      this.drawTab(ctx, width, 0, width, height, true);
    } else {
      ctx.lineTo(width, height);
    }

    // Bottom edge
    if (connections[2]?.type === 'tab') {
      this.drawTab(ctx, width, height, 0, height, false);
    } else if (connections[2]?.type === 'blank') {
      this.drawTab(ctx, width, height, 0, height, true);
    } else {
      ctx.lineTo(0, height);
    }

    // Left edge
    if (connections[3]?.type === 'tab') {
      this.drawTab(ctx, 0, height, 0, 0, false);
    } else if (connections[3]?.type === 'blank') {
      this.drawTab(ctx, 0, height, 0, 0, true);
    } else {
      ctx.lineTo(0, 0);
    }

    ctx.closePath();
  }

  private static drawTab(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    invert: boolean
  ): void {
    // TODO: Use controlPoints for proper bezier curves
    // Simplified bezier curve drawing
    // In full implementation, this would create proper interlocking shapes
    const dx = endX - startX;
    const dy = endY - startY;

    // Draw a simple curve for now
    const midX = startX + dx * 0.5;
    const midY = startY + dy * 0.5;
    const bulge = invert ? -this.TAB_SIZE : this.TAB_SIZE;

    ctx.quadraticCurveTo(midX + bulge, midY + bulge, endX, endY);
  }
}
