// src/ui/settingsPanel.ts - Settings panel for difficulty and game options

import { GameStateManager } from '../game/gameState';
import type { Difficulty } from '../game/types';

export class SettingsPanel {
  private element: HTMLElement;
  private overlay: HTMLElement;
  private gameState: GameStateManager;
  private onSettingsChanged?: (settings: { difficulty: Difficulty; edgeOnly: boolean; preFlip: boolean }) => void;

  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
    this.overlay = this.createOverlay();
    this.element = this.overlay.querySelector('.settings-panel') as HTMLElement;
    this.populateDifficultyOptions();
    this.setupEventListeners();
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.innerHTML = `
      <div class="settings-panel">
        <h3>Game Settings</h3>
        <div class="setting-group">
          <label for="difficulty-select">Difficulty:</label>
          <select id="difficulty-select">
            <!-- Options populated dynamically -->
          </select>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" id="edge-only"> Edge-only mode
          </label>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" id="pre-flip"> Pre-flip pieces
          </label>
        </div>
        <div class="settings-buttons">
          <button id="apply-settings">Apply</button>
          <button id="cancel-settings">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  private populateDifficultyOptions(): void {
    const select = this.element.querySelector('#difficulty-select') as HTMLSelectElement;
    GameStateManager.DIFFICULTIES.forEach(difficulty => {
      const option = document.createElement('option');
      option.value = difficulty.name;
      option.textContent = `${difficulty.name} (${difficulty.rows}x${difficulty.cols} - ${difficulty.totalPieces} pieces)`;
      select.appendChild(option);
    });

    // Set current difficulty
    select.value = this.gameState.settings.difficulty.name;
  }

  private setupEventListeners(): void {
    const applyBtn = this.element.querySelector('#apply-settings') as HTMLButtonElement;
    const cancelBtn = this.element.querySelector('#cancel-settings') as HTMLButtonElement;
    const overlay = this.overlay;

    applyBtn.addEventListener('click', () => this.applySettings());
    cancelBtn.addEventListener('click', () => this.hide());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });
  }

  private applySettings(): void {
    const select = this.element.querySelector('#difficulty-select') as HTMLSelectElement;
    const edgeOnly = (this.element.querySelector('#edge-only') as HTMLInputElement).checked;
    const preFlip = (this.element.querySelector('#pre-flip') as HTMLInputElement).checked;

    const selectedDifficulty = GameStateManager.DIFFICULTIES.find(d => d.name === select.value);
    if (selectedDifficulty) {
      this.gameState.updateSettings({
        difficulty: selectedDifficulty,
        edgeOnly,
        preFlip
      });

      this.onSettingsChanged?.({ difficulty: selectedDifficulty, edgeOnly, preFlip });
      this.hide();
    }
  }

  setSettingsChangedHandler(handler: (settings: { difficulty: Difficulty; edgeOnly: boolean; preFlip: boolean }) => void): void {
    this.onSettingsChanged = handler;
  }

  show(): void {
    // Update UI with current settings
    const settings = this.gameState.settings;
    (this.element.querySelector('#difficulty-select') as HTMLSelectElement).value = settings.difficulty.name;
    (this.element.querySelector('#edge-only') as HTMLInputElement).checked = settings.edgeOnly;
    (this.element.querySelector('#pre-flip') as HTMLInputElement).checked = settings.preFlip;

    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  destroy(): void {
    this.overlay.remove();
  }
}