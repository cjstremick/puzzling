// src/ui/statusBar.ts - Bottom status bar with timer, progress, and attribution

import { GameStateManager } from '../game/gameState';
import type { PexelsPhoto } from '../api/imageSearch';

export class StatusBar {
  private element!: HTMLElement;
  private timerElement!: HTMLElement;
  private progressElement!: HTMLElement;
  private attributionElement!: HTMLElement;
  private peekButton!: HTMLElement;
  private newPuzzleButton!: HTMLElement;
  private fitButton!: HTMLElement;
  private peekOverlay!: HTMLElement;
  private gameState: GameStateManager;
  private currentPhoto?: PexelsPhoto;
  private onNewPuzzleRequest?: () => void;
  private onFitViewRequest?: () => void;

  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
    this.element = this.createElement();
    this.timerElement = this.element.querySelector('.status-timer') as HTMLElement;
    this.progressElement = this.element.querySelector('.status-progress') as HTMLElement;
    this.attributionElement = this.element.querySelector('.status-attribution') as HTMLElement;
    this.peekButton = this.element.querySelector('.peek-button') as HTMLElement;
    this.fitButton = this.element.querySelector('.fit-button') as HTMLElement;
    this.newPuzzleButton = this.element.querySelector('.new-puzzle-button') as HTMLElement;
    this.peekOverlay = this.createPeekOverlay();

    this.setupEventHandlers();
    this.updateDisplay();
    this.hide(); // Hide initially
  }

  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'status-bar';
    element.innerHTML = `
      <div class="status-left" style="display: flex; align-items: center; gap: 20px;">
        <div class="status-timer">00:00</div>
        <div class="status-progress">0/0</div>
      </div>
      <div class="status-center" style="flex: 1; display: flex; justify-content: center; gap: 10px;">
        <button class="peek-button">Peek</button>
        <button class="fit-button">Fit</button>
        <button class="new-puzzle-button">New Puzzle</button>
      </div>
      <div class="status-attribution"></div>
    `;
    document.body.appendChild(element);

    // Style the status bar for visual distinction
    Object.assign(element.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: '2px solid #007bff',
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.3)',
      zIndex: '1000',
      backdropFilter: 'blur(5px)'
    });

    // Style the peek button
    const peekButton = element.querySelector('.peek-button') as HTMLElement;
    Object.assign(peekButton.style, {
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s'
    });

    peekButton.addEventListener('mouseover', () => peekButton.style.backgroundColor = '#0056b3');
    peekButton.addEventListener('mouseout', () => peekButton.style.backgroundColor = '#007bff');

    // Style the new puzzle button
    const newPuzzleButton = element.querySelector('.new-puzzle-button') as HTMLElement;
    Object.assign(newPuzzleButton.style, {
      backgroundColor: '#fd7e14',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s'
    });

    newPuzzleButton.addEventListener('mouseover', () => newPuzzleButton.style.backgroundColor = '#c46610');
    newPuzzleButton.addEventListener('mouseout', () => newPuzzleButton.style.backgroundColor = '#fd7e14');

    // Style the fit button
    const fitButton = element.querySelector('.fit-button') as HTMLElement;
    Object.assign(fitButton.style, {
      backgroundColor: '#20c997',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s'
    });

    fitButton.addEventListener('mouseover', () => fitButton.style.backgroundColor = '#148f77');
    fitButton.addEventListener('mouseout', () => fitButton.style.backgroundColor = '#20c997');

    return element;
  }

  private createPeekOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'peek-overlay';
    overlay.innerHTML = `
      <div class="peek-content">
        <div class="peek-close">×</div>
        <img class="peek-image" alt="Original image" />
        <div class="peek-attribution"></div>
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
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '2000',
      backdropFilter: 'blur(5px)'
    });

    // Style the content
    const content = overlay.querySelector('.peek-content') as HTMLElement;
    Object.assign(content.style, {
      position: 'relative',
      maxWidth: '90vw',
      maxHeight: '90vh',
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
    });

    // Style the close button
    const closeButton = overlay.querySelector('.peek-close') as HTMLElement;
    Object.assign(closeButton.style, {
      position: 'absolute',
      top: '10px',
      right: '15px',
      fontSize: '24px',
      color: '#333',
      cursor: 'pointer',
      zIndex: '1',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '50%',
      width: '30px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    // Style the image
    const image = overlay.querySelector('.peek-image') as HTMLImageElement;
    Object.assign(image.style, {
      maxWidth: '100%',
      maxHeight: '80vh',
      display: 'block'
    });

    // Style the attribution
    const attribution = overlay.querySelector('.peek-attribution') as HTMLElement;
    Object.assign(attribution.style, {
      padding: '10px',
      textAlign: 'center',
      fontSize: '12px',
      color: '#666',
      borderTop: '1px solid #eee'
    });

    return overlay;
  }

  private setupEventHandlers(): void {
    this.gameState.setStatsUpdateHandler(() => {
      this.updateDisplay();
    });

    // Peek button handler
    this.peekButton.addEventListener('click', () => {
      this.showPeek();
    });

    // Fit button handler
    this.fitButton.addEventListener('click', () => {
      this.requestFitView();
    });

    // New puzzle button handler
    this.newPuzzleButton.addEventListener('click', () => {
      this.requestNewPuzzle();
    });

    // Overlay click handlers for dismissal
    this.peekOverlay.addEventListener('click', (e) => {
      if (e.target === this.peekOverlay || e.target === this.peekOverlay.querySelector('.peek-close')) {
        this.hidePeek();
      }
    });

    // ESC key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.peekOverlay.style.display !== 'none') {
        this.hidePeek();
      }
    });
  }

  private updateDisplay(): void {
    // Timer
    const elapsed = this.gameState.elapsedTime;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Progress (without percentage)
    const stats = this.gameState.stats;
    if (stats) {
      this.progressElement.textContent = `${stats.piecesPlaced}/${stats.totalPieces}`;
    } else {
      this.progressElement.textContent = '0/0';
    }

    // Attribution
    if (this.currentPhoto) {
      this.attributionElement.innerHTML = `
        Photo by <a href="${this.currentPhoto.photographer_url}" target="_blank">${this.currentPhoto.photographer}</a> on
        <a href="https://www.pexels.com" target="_blank">Pexels</a>
      `;
    }
  }

  setPhoto(photo: PexelsPhoto): void {
    this.currentPhoto = photo;
    this.updateDisplay();
  }

  show(): void {
    this.element.style.display = 'flex';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  private showPeek(): void {
    if (!this.currentPhoto) return;

    const image = this.peekOverlay.querySelector('.peek-image') as HTMLImageElement;
    const attribution = this.peekOverlay.querySelector('.peek-attribution') as HTMLElement;

    image.src = this.currentPhoto.src.large;
    attribution.innerHTML = `
      Photo by <a href="${this.currentPhoto.photographer_url}" target="_blank">${this.currentPhoto.photographer}</a> on
      <a href="https://www.pexels.com" target="_blank">Pexels</a>
    `;

    this.peekOverlay.style.display = 'flex';
  }

  private hidePeek(): void {
    this.peekOverlay.style.display = 'none';
  }

  private requestNewPuzzle(): void {
    this.onNewPuzzleRequest?.();
  }

  private requestFitView(): void {
    this.onFitViewRequest?.();
  }

  setNewPuzzleRequestHandler(handler: () => void): void {
    this.onNewPuzzleRequest = handler;
  }

  setFitViewRequestHandler(handler: () => void): void {
    this.onFitViewRequest = handler;
  }

  destroy(): void {
    this.element.remove();
    this.peekOverlay.remove();
  }
}
