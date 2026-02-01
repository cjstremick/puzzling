// src/ui/referencePanel.ts - Floating reference image panel for peeking

import { GameStateManager } from '../game/gameState';
import type { PexelsPhoto } from '../api/imageSearch';

export class ReferencePanel {
  private element: HTMLElement;
  private imageElement: HTMLImageElement;
  private toggleButton: HTMLElement;
  private gameState: GameStateManager;
  private isVisible: boolean = false;
  private isDragging: boolean = false;
  private dragOffset = { x: 0, y: 0 };

  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
    this.element = this.createElement();
    this.imageElement = this.element.querySelector('.reference-image') as HTMLImageElement;
    this.toggleButton = this.element.querySelector('.reference-toggle') as HTMLElement;
    this.setupEventHandlers();
  }

  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'reference-panel';
    element.innerHTML = `
      <button class="reference-toggle">👁️</button>
      <div class="reference-content">
        <div class="reference-header">
          <span>Reference Image</span>
          <button class="reference-close">×</button>
        </div>
        <img class="reference-image" alt="Reference" />
      </div>
    `;
    document.body.appendChild(element);
    return element;
  }

  private setupEventHandlers(): void {
    const header = this.element.querySelector('.reference-header') as HTMLElement;
    const closeBtn = this.element.querySelector('.reference-close') as HTMLElement;

    this.toggleButton.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.hide());
    header.addEventListener('mousedown', (e) => this.startDrag(e));
    header.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));

    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('touchmove', (e) => this.drag(e.touches[0]));
    document.addEventListener('mouseup', () => this.endDrag());
    document.addEventListener('touchend', () => this.endDrag());

    this.gameState.setStateChangeHandler((state) => {
      if (state === 'playing') {
        this.showToggle();
      } else {
        this.hide();
      }
    });
  }

  private startDrag(event: MouseEvent | Touch): void {
    this.isDragging = true;
    const rect = this.element.getBoundingClientRect();
    this.dragOffset.x = event.clientX - rect.left;
    this.dragOffset.y = event.clientY - rect.top;
    this.element.style.cursor = 'grabbing';
  }

  private drag(event: MouseEvent | Touch): void {
    if (!this.isDragging) return;
    const x = event.clientX - this.dragOffset.x;
    const y = event.clientY - this.dragOffset.y;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.right = 'auto';
    this.element.style.bottom = 'auto';
  }

  private endDrag(): void {
    this.isDragging = false;
    this.element.style.cursor = 'grab';
  }

  setPhoto(photo: PexelsPhoto): void {
    this.imageElement.src = photo.src.large;
  }

  show(): void {
    this.element.classList.add('visible');
    this.isVisible = true;
  }

  hide(): void {
    this.element.classList.remove('visible');
    this.isVisible = false;
  }

  private toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private showToggle(): void {
    this.toggleButton.style.display = 'block';
  }

  destroy(): void {
    this.element.remove();
  }
}