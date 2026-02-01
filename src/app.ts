// src/app.ts - Main game controller
import './style.css'; // Import styles
import confetti from 'canvas-confetti';
import { SearchPanel } from './ui/searchPanel';
import { PuzzleBoard } from './game/puzzleBoard';
import { GameStateManager } from './game/gameState';
import { StatusBar } from './ui/statusBar';
import { ReferencePanel } from './ui/referencePanel';
import { SoundManager } from './audio/soundManager';
import { PuzzleGenerator } from './game/puzzleGenerator';
import type { PexelsPhoto } from './api/imageSearch';
import type { PuzzlePiece } from './game/piece';

export class App {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private searchPanel: SearchPanel;
  private puzzleBoard: PuzzleBoard;
  private gameState: GameStateManager;
  private statusBar: StatusBar;
  private referencePanel: ReferencePanel;
  private completionOverlay: HTMLElement;
  private selectedPhoto: PexelsPhoto | null = null;
  private soundManager: SoundManager;

  constructor() {
    this.canvas = document.getElementById('puzzle-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas not found');

    this.ctx = this.canvas.getContext('2d')!;
    if (!this.ctx) throw new Error('Canvas 2D context not available');

    this.gameState = new GameStateManager();
    this.soundManager = new SoundManager();
    this.statusBar = new StatusBar(this.gameState);
    this.referencePanel = new ReferencePanel(this.gameState);
     this.puzzleBoard = new PuzzleBoard(this.canvas);
     this.puzzleBoard.setSoundManager(this.soundManager);
     this.puzzleBoard.setProgressHandler((connected, _total) => {
       // Update game state with connected pieces count (not correctly placed)
       this.gameState.updateProgress(connected);
     });
     this.puzzleBoard.setPiecesChangedHandler((pieces) => {
       // Save updated pieces to game state
       this.gameState.updatePuzzlePieces(pieces);
     });
     this.searchPanel = new SearchPanel((photo) => this.onImageSelected(photo), this.gameState);
     this.completionOverlay = this.createCompletionOverlay();
     this.setupCanvas();
     this.setupGameStateHandlers();

    // Try to restore saved game state
    this.restoreSavedGameState();
  }

  private async restoreSavedGameState(): Promise<void> {
    try {
      const savedState = this.gameState.loadSavedGameState();
      if (!savedState) {
        // No saved state, show search panel
        this.searchPanel.show();
        this.drawPlaceholder();
        return;
      }

      // Restore the game state
      this.gameState.restoreGameState(savedState);

      // If we have a saved photo and puzzle config, try to restore the puzzle
      if (savedState.photo && savedState.puzzleConfig) {
        this.selectedPhoto = savedState.photo;

        // Update UI components with restored photo
        this.statusBar.setPhoto(savedState.photo);
        this.referencePanel.setPhoto(savedState.photo);

        try {
          // Recreate the image and puzzle pieces
          const image = new Image();
          image.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = savedState.photo!.src.large;
          });

          // Generate puzzle with saved config
          const pieces = await PuzzleGenerator.generatePuzzle(image, savedState.puzzleConfig);

          // Restore piece states from saved data
          const restoredPieces = this.restorePieceStates(pieces, this.gameState.puzzlePieces);

          // Update puzzle board with restored pieces
          this.puzzleBoard.restorePieces(restoredPieces);

          // Set canvas size to saved dimensions
          this.canvas.width = savedState.canvasWidth;
          this.canvas.height = savedState.canvasHeight;

          this.puzzleBoard.render();

          console.log(`Restored puzzle: ${restoredPieces.length} pieces, ${this.gameState.currentState} state`);
        } catch (error) {
          console.warn('Failed to restore puzzle from saved state:', error);
          // Clear corrupted save and start fresh
          this.gameState.clearSavedGameState();
          this.searchPanel.show();
          this.drawPlaceholder();
        }
      } else {
        // No photo/config, but we restored other state
        this.searchPanel.show();
        this.drawPlaceholder();
      }
    } catch (error) {
      console.error('Error restoring saved game state:', error);
      // Clear corrupted save and start fresh
      this.gameState.clearSavedGameState();
      this.searchPanel.show();
      this.drawPlaceholder();
    }
  }

  private restorePieceStates(generatedPieces: PuzzlePiece[], savedPieces: PuzzlePiece[]): PuzzlePiece[] {
    // Create a map of saved pieces by ID for quick lookup
    const savedPiecesMap = new Map<number, PuzzlePiece>();
    savedPieces.forEach(piece => savedPiecesMap.set(piece.id, piece));

    // Update generated pieces with saved state
    return generatedPieces.map(generatedPiece => {
      const savedPiece = savedPiecesMap.get(generatedPiece.id);
      if (savedPiece) {
        // Restore all state except imageData (which is already set in generated piece)
        generatedPiece.x = savedPiece.x;
        generatedPiece.y = savedPiece.y;
        generatedPiece.rotation = savedPiece.rotation;
        generatedPiece.faceUp = savedPiece.faceUp;
        generatedPiece.connections = [...savedPiece.connections];
        generatedPiece.isDragging = savedPiece.isDragging;
        generatedPiece.dragOffset = { ...savedPiece.dragOffset };
        generatedPiece.isLocked = savedPiece.isLocked;
        generatedPiece.originalPosition = { ...savedPiece.originalPosition };
        generatedPiece.connectedPieces = new Set(savedPiece.connectedPieces);
        generatedPiece.groupId = savedPiece.groupId;
      }
      return generatedPiece;
    });
  }

  private setupGameStateHandlers(): void {
    this.gameState.setStateChangeHandler((state) => {
      console.log('Game state changed to:', state);
      if (state === 'playing') {
        this.statusBar.show();
        this.searchPanel.hide();
      } else if (state === 'menu') {
        this.statusBar.hide();
        this.searchPanel.show();
      } else if (state === 'completed') {
        this.showCompletionScreen();
        this.triggerCelebration();
      }
    });

    // Set up hint handler
    this.statusBar.setNewPuzzleRequestHandler(() => {
      this.handleNewPuzzleRequest();
    });
  }

  private handleNewPuzzleRequest(): void {
    // Always show the search panel (Create Puzzle dialog)
    // The search panel has a close button to cancel and return to current puzzle
    this.searchPanel.show();
  }

  private createCompletionOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'completion-overlay';
    overlay.innerHTML = `
      <div class="completion-content">
        <h1>🎉 Congratulations! 🎉</h1>
        <p>You completed the puzzle!</p>
        <div class="completion-stats">
          <div>Time: <span id="completion-time">00:00</span></div>
          <div>Pieces: <span id="completion-pieces">0/0</span></div>
        </div>
        <button class="play-again-btn">Play Again</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Style the overlay
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '3000',
      backdropFilter: 'blur(5px)'
    });

    // Style the content
    const content = overlay.querySelector('.completion-content') as HTMLElement;
    Object.assign(content.style, {
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '16px',
      textAlign: 'center',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      maxWidth: '400px',
      width: '90%'
    });

    // Style the button
    const button = overlay.querySelector('.play-again-btn') as HTMLElement;
    Object.assign(button.style, {
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      marginTop: '20px'
    });

    button.addEventListener('click', () => {
      overlay.style.display = 'none';
      this.gameState.resetToMenu();
      this.searchPanel.show();
    });

    return overlay;
  }

  private showCompletionScreen(): void {
    const stats = this.gameState.stats;
    if (!stats) return;

    const timeSpan = this.completionOverlay.querySelector('#completion-time') as HTMLElement;
    const piecesSpan = this.completionOverlay.querySelector('#completion-pieces') as HTMLElement;

    const elapsed = this.gameState.elapsedTime;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timeSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    piecesSpan.textContent = `${stats.piecesPlaced}/${stats.totalPieces}`;

    this.completionOverlay.style.display = 'flex';
    this.soundManager.play('complete');
  }

  private triggerCelebration(): void {
    // Continuous falling confetti
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        zIndex: 4000
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        zIndex: 4000
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Burst from corners
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 45,
        spread: 90,
        origin: { x: 0, y: 0 },
        zIndex: 4000
      });
      confetti({
        particleCount: 50,
        angle: 135,
        spread: 90,
        origin: { x: 1, y: 0 },
        zIndex: 4000
      });
      confetti({
        particleCount: 50,
        angle: 225,
        spread: 90,
        origin: { x: 1, y: 1 },
        zIndex: 4000
      });
      confetti({
        particleCount: 50,
        angle: 315,
        spread: 90,
        origin: { x: 0, y: 1 },
        zIndex: 4000
      });
    }, 500);
  }

  private setupCanvas(): void {
    // Make canvas responsive
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(rect.width || 0, 800);
    this.canvas.height = Math.max(rect.height || 0, 600);
    this.drawPlaceholder(); // Redraw after resize
  }

  private drawPlaceholder(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.selectedPhoto) {
      // No placeholder text needed - dialog handles UI
    } else {
      // Puzzle is loaded, let PuzzleBoard handle rendering
    }
  }

  private async onImageSelected(photo: PexelsPhoto): Promise<void> {
    this.selectedPhoto = photo;
    this.statusBar.setPhoto(photo);
    this.referencePanel.setPhoto(photo);

    try {
      // Load puzzle with current difficulty
      const difficulty = this.gameState.settings.difficulty;
      await this.puzzleBoard.loadPuzzle(photo.src.large, {
        rows: difficulty.rows,
        cols: difficulty.cols,
        shuffle: true,
        preFlip: this.gameState.settings.preFlip,
        preRotate: this.gameState.settings.preRotate,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height
      });

      // Start the game
      this.gameState.startGame(difficulty.totalPieces);
      this.soundManager.setEnabled(true);

      // Save the complete game state
      const puzzleConfig = {
        rows: difficulty.rows,
        cols: difficulty.cols,
        shuffle: true,
        preFlip: this.gameState.settings.preFlip,
        preRotate: this.gameState.settings.preRotate,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height
      };
      this.gameState.setPuzzleState(
        photo,
        this.puzzleBoard.getPieces(),
        this.canvas.width,
        this.canvas.height,
        puzzleConfig
      );
    } catch (error) {
      console.error('Failed to load puzzle:', error);
      // Show error message
      this.ctx.fillStyle = '#ff0000';
      this.ctx.font = '18px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        'Failed to load puzzle. Please try another image.',
        this.canvas.width / 2,
        this.canvas.height / 2
      );
    }
  }
}

// Export for main.ts
export default App;