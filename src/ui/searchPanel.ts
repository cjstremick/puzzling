// src/ui/searchPanel.ts - Image search UI component

import type { PexelsPhoto } from '../api/imageSearch';
import { imageSearchAPI } from '../api/imageSearch';
import { GameStateManager } from '../game/gameState';
import { ErrorHandler } from '../utils/errorHandler';

export class SearchPanel {
  private element!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private searchButton!: HTMLButtonElement;
  private randomButton!: HTMLButtonElement;
  private resultsGrid!: HTMLElement;
  private onImageSelected: (photo: PexelsPhoto) => void;
  private gameState: GameStateManager;
  private isVisible: boolean = true;

  private readonly randomTerms = [
    'mountain', 'beach', 'forest', 'tools', 'animal', 'desert', 'machines', 'snow',
    'classic car', 'muscle car', 'michigan', 'puppies', 'cat'
  ];

  constructor(onImageSelected: (photo: PexelsPhoto) => void, gameState: GameStateManager) {
    this.onImageSelected = onImageSelected;
    this.gameState = gameState;
    this.createElement();
    this.setupEventListeners();
  }

  private createElement(): void {
    this.element = document.createElement('div');
    this.element.id = 'search-panel';
    this.element.innerHTML = `
      <div class="search-container">
        <h2>Create a Puzzle</h2>
        <div class="search-bar">
          <input type="text" placeholder="Enter keywords (e.g., mountain, sunset, city)" />
          <button class="search-btn">Search</button>
          <button class="random-btn">Random</button>
        </div>
        <div class="settings-section">
          <h3>Puzzle Settings</h3>
          <div class="setting-group">
            <label for="difficulty-select">Difficulty:</label>
            <select id="difficulty-select">
              <!-- Options populated dynamically -->
            </select>
          </div>
           <div class="setting-group checkboxes">
             <label>
               <input type="checkbox" id="pre-flip"> Pre-flip pieces
             </label>
             <label>
               <input type="checkbox" id="pre-rotate"> Start pieces correctly oriented
             </label>
           </div>
        </div>
        <div class="results-grid"></div>
        <div class="attribution">Photos provided by <a href="https://www.pexels.com" target="_blank">Pexels</a></div>
      </div>
    `;

    // Style the element
    Object.assign(this.element.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      zIndex: '1000',
      minWidth: '500px',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflowY: 'auto'
    });

    // Style the container
    const container = this.element.querySelector('.search-container') as HTMLElement;
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    });

    // Style the search bar
    const searchBar = this.element.querySelector('.search-bar') as HTMLElement;
    Object.assign(searchBar.style, {
      display: 'flex',
      gap: '10px'
    });

    const input = this.element.querySelector('input') as HTMLInputElement;
    Object.assign(input.style, {
      flex: '1',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      fontSize: '16px'
    });

    const button = this.element.querySelector('.search-bar button') as HTMLButtonElement;
    Object.assign(button.style, {
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '16px'
    });

    button.addEventListener('mouseover', () => button.style.backgroundColor = '#0056b3');
    button.addEventListener('mouseout', () => button.style.backgroundColor = '#007bff');

    const randomButton = this.element.querySelector('.random-btn') as HTMLButtonElement;
    Object.assign(randomButton.style, {
      padding: '10px 20px',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '16px'
    });

    randomButton.addEventListener('mouseover', () => randomButton.style.backgroundColor = '#1e7e34');
    randomButton.addEventListener('mouseout', () => randomButton.style.backgroundColor = '#28a745');

    // Style settings section
    const settingsSection = this.element.querySelector('.settings-section') as HTMLElement;
    Object.assign(settingsSection.style, {
      border: '1px solid #ddd',
      borderRadius: '5px',
      padding: '10px',
      backgroundColor: '#f9f9f9'
    });

    const settingGroups = settingsSection.querySelectorAll('.setting-group');
    settingGroups.forEach(group => {
      Object.assign((group as HTMLElement).style, {
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      });
    });

    // Style results grid
    const grid = this.element.querySelector('.results-grid') as HTMLElement;
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      maxHeight: '400px',
      overflowY: 'auto'
    });

    // Style attribution
    const attribution = this.element.querySelector('.attribution') as HTMLElement;
    Object.assign(attribution.style, {
      textAlign: 'center',
      fontSize: '12px',
      color: '#666',
      marginTop: '10px'
    });

    const link = attribution.querySelector('a') as HTMLAnchorElement;
    Object.assign(link.style, {
      color: '#007bff',
      textDecoration: 'none'
    });

    this.searchInput = input;
    this.searchButton = button;
    this.randomButton = this.element.querySelector('.random-btn') as HTMLButtonElement;
    this.resultsGrid = grid;
    this.populateDifficultyOptions();
    this.setupSettingsEventListeners();
  }

  private setupEventListeners(): void {
    this.searchButton.addEventListener('click', () => this.performSearch());
    this.randomButton.addEventListener('click', () => this.performRandomSearch());
    this.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
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

  private setupSettingsEventListeners(): void {
    const select = this.element.querySelector('#difficulty-select') as HTMLSelectElement;
    const preFlip = this.element.querySelector('#pre-flip') as HTMLInputElement;
    const preRotate = this.element.querySelector('#pre-rotate') as HTMLInputElement;

    // Set initial values
    preFlip.checked = this.gameState.settings.preFlip;
    preRotate.checked = this.gameState.settings.preRotate;

    // Add change handlers
    select.addEventListener('change', () => {
      const selected = GameStateManager.DIFFICULTIES.find(d => d.name === select.value);
      if (selected) {
        this.gameState.updateSettings({ difficulty: selected });
      }
    });

    preFlip.addEventListener('change', () => {
      this.gameState.updateSettings({ preFlip: preFlip.checked });
    });

    preRotate.addEventListener('change', () => {
      this.gameState.updateSettings({ preRotate: preRotate.checked });
    });
  }

  private async performRandomSearch(): Promise<void> {
    const randomTerm = this.randomTerms[Math.floor(Math.random() * this.randomTerms.length)];
    this.searchInput.value = randomTerm;
    this.randomButton.disabled = true;
    this.randomButton.textContent = 'Searching...';

    try {
      // Get total results for the random term
      const firstResponse = await imageSearchAPI.searchPhotos(randomTerm, 1);
      const totalResults = firstResponse.total_results;
      const perPage = firstResponse.per_page;
      const totalPages = Math.ceil(totalResults / perPage);

      // Generate 6 unique random page numbers
      const selectedPages = new Set<number>();
      while (selectedPages.size < 6 && selectedPages.size < totalPages) {
        const randomPage = Math.floor(Math.random() * Math.min(totalPages, 100)) + 1;
        selectedPages.add(randomPage);
      }

      // Fetch photos from the selected random pages
      const allPhotos: PexelsPhoto[] = [];
      for (const page of selectedPages) {
        const response = page === 1 ? firstResponse : await imageSearchAPI.searchPhotos(randomTerm, page);
        // Take 1 random photo from each page
        const randomIndex = Math.floor(Math.random() * response.photos.length);
        allPhotos.push(response.photos[randomIndex]);
      }

      this.displayResults(allPhotos);

    } catch (error) {
      ErrorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'SearchPanel.performRandomSearch');
      this.showError('Random search failed. Please try again.');
    } finally {
      this.randomButton.disabled = false;
      this.randomButton.textContent = 'Random';
    }
  }

  private async performSearch(): Promise<void> {
    const query = this.searchInput.value.trim();
    if (!query) return;

    this.searchButton.disabled = true;
    this.searchButton.textContent = 'Searching...';

    try {
      // First, get page 1 to know total_results
      const firstResponse = await imageSearchAPI.searchPhotos(query, 1);
      
      // Calculate how many pages are available
      const totalPages = Math.ceil(firstResponse.total_results / firstResponse.per_page);
      
      // Pick a random page (limit to first 100 pages to avoid bad results)
      const maxPage = Math.min(totalPages, 100);
      const randomPage = Math.floor(Math.random() * maxPage) + 1;
      
      // Fetch the random page
      const response = randomPage === 1 ? firstResponse : await imageSearchAPI.searchPhotos(query, randomPage);
      
       // Shuffle and take 6 random results from that page
       const shuffled = response.photos.sort(() => Math.random() - 0.5);
        this.displayResults(shuffled.slice(0, 6));
     } catch (error) {
       ErrorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'SearchPanel.performSearch');
       this.showError('Search failed. Please try again.');
     } finally {
      this.searchButton.disabled = false;
      this.searchButton.textContent = 'Search';
    }
  }

  private displayResults(photos: PexelsPhoto[]): void {
    this.resultsGrid.innerHTML = '';

    photos.forEach(photo => {
      const item = document.createElement('div');
      item.className = 'result-item';

      Object.assign(item.style, {
        cursor: 'pointer',
        border: '1px solid #ddd',
        borderRadius: '5px',
        overflow: 'hidden',
        transition: 'transform 0.2s'
      });

      const img = document.createElement('img');
      img.src = photo.src.medium;
      img.alt = photo.photographer;
      img.loading = 'lazy';

      Object.assign(img.style, {
        width: '100%',
        height: '120px',
        objectFit: 'cover',
        display: 'block'
      });

      const credit = document.createElement('div');
      credit.textContent = `by ${photo.photographer}`;
      Object.assign(credit.style, {
        padding: '5px',
        fontSize: '10px',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        height: '20px',
        overflow: 'hidden'
      });

      item.appendChild(img);
      item.appendChild(credit);

      item.addEventListener('mouseover', () => item.style.transform = 'scale(1.05)');
      item.addEventListener('mouseout', () => item.style.transform = 'scale(1)');

      item.addEventListener('click', () => {
        this.onImageSelected(photo);
        this.hide();
      });

      this.resultsGrid.appendChild(item);
    });
  }

  private showError(message: string): void {
    this.resultsGrid.innerHTML = `<div style="grid-column: 1 / -1; color: red; text-align: center; padding: 20px;">${message}</div>`;
  }

  show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'block';
    this.isVisible = true;
  }

  hide(): void {
    this.element.style.display = 'none';
    this.isVisible = false;
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}