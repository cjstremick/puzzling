// src/app.ts - Main game controller
import './style.css'; // Import styles
import confetti from 'canvas-confetti';
import { SearchPanel } from './ui/searchPanel';
import { PuzzleBoard } from './game/puzzleBoard';
import { GameStateManager } from './game/gameState';
import { StatusBar } from './ui/statusBar';
import { ReferencePanel } from './ui/referencePanel';
import { SoundManager } from './audio/soundManager';
import type { PexelsPhoto } from './api/imageSearch';

export class App {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private searchPanel: SearchPanel;
  private puzzleBoard: PuzzleBoard;
  private gameState: GameStateManager;
  private statusBar: StatusBar;
  private referencePanel: ReferencePanel;
  private confirmationDialog: HTMLElement;
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
    this.searchPanel = new SearchPanel((photo) => this.onImageSelected(photo), this.gameState);
    this.confirmationDialog = this.createConfirmationDialog();
    this.completionOverlay = this.createCompletionOverlay();
    this.setupCanvas();
    this.setupGameStateHandlers();
    this.searchPanel.show();
    this.drawPlaceholder();
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
    // Check if any pieces are connected
    const hasConnectedPieces = this.checkIfPiecesAreConnected();

    if (hasConnectedPieces) {
      // Show custom confirmation dialog
      this.confirmationDialog.style.display = 'flex';
      return;
    }

    // Reset to menu
    this.gameState.resetToMenu();
    this.searchPanel.show();
  }

  private checkIfPiecesAreConnected(): boolean {
    const hasConnected = this.puzzleBoard.hasConnectedPieces();
    console.log('Checking for connected pieces:', hasConnected);
    return hasConnected;
  }

  private createConfirmationDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    dialog.innerHTML = `
      <div class="confirmation-content">
        <h3>Start New Puzzle?</h3>
        <p>You have connected pieces in your current puzzle. Starting a new puzzle will lose your progress.</p>
        <div class="confirmation-buttons">
          <button class="cancel-btn">Cancel</button>
          <button class="confirm-btn">Start New Puzzle</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    // Style the dialog
    Object.assign(dialog.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '2500'
    });

    // Style the content
    const content = dialog.querySelector('.confirmation-content') as HTMLElement;
    Object.assign(content.style, {
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '12px',
      textAlign: 'center',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      maxWidth: '400px',
      width: '90%'
    });

    // Style buttons
    const buttons = dialog.querySelector('.confirmation-buttons') as HTMLElement;
    Object.assign(buttons.style, {
      display: 'flex',
      gap: '15px',
      justifyContent: 'center',
      marginTop: '20px'
    });

    const cancelBtn = dialog.querySelector('.cancel-btn') as HTMLElement;
    Object.assign(cancelBtn.style, {
      padding: '10px 20px',
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px'
    });

    const confirmBtn = dialog.querySelector('.confirm-btn') as HTMLElement;
    Object.assign(confirmBtn.style, {
      padding: '10px 20px',
      backgroundColor: '#dc3545',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px'
    });

    // Add event listeners
    cancelBtn.addEventListener('click', () => {
      dialog.style.display = 'none';
    });

    confirmBtn.addEventListener('click', () => {
      dialog.style.display = 'none';
      this.gameState.resetToMenu();
      this.searchPanel.show();
    });

    return dialog;
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
        origin: { x: 0 }
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
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
        origin: { x: 0, y: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 135,
        spread: 90,
        origin: { x: 1, y: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 225,
        spread: 90,
        origin: { x: 1, y: 1 }
      });
      confetti({
        particleCount: 50,
        angle: 315,
        spread: 90,
        origin: { x: 0, y: 1 }
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