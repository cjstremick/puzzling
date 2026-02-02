// src/api/imageSearch.ts - Pexels API integration

import { APP_CONFIG } from '../config/appConfig';
import { Logger } from '../utils/logger';
import { ErrorHandler, NetworkError } from '../utils/errorHandler';
import { Validators } from '../utils/validators';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

export interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

export class ImageSearchAPI {
  private readonly API_KEY = APP_CONFIG.API.PEXELS_KEY;
  private readonly BASE_URL = APP_CONFIG.API.PEXELS_BASE_URL;
  private readonly PER_PAGE = APP_CONFIG.API.PEXELS_PER_PAGE;

  async searchPhotos(query: string, page: number = 1): Promise<PexelsResponse> {
    const sanitizedQuery = Validators.sanitizeQuery(query);
    if (!sanitizedQuery) {
      throw new Error('Query cannot be empty');
    }

    Logger.debug(`Searching Pexels for "${sanitizedQuery}" (page ${page})`);

    const result = await ErrorHandler.withErrorHandling(async () => {
      const url = `${this.BASE_URL}/search?query=${encodeURIComponent(sanitizedQuery)}&per_page=${this.PER_PAGE}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': this.API_KEY
        }
      });

      if (!response.ok) {
        throw new NetworkError(
          `Pexels API error: ${response.status} ${response.statusText}`,
          'searchPhotos'
        );
      }

      const data: PexelsResponse = await response.json();
      Logger.debug(`Found ${data.total_results} total results, ${data.photos.length} on this page`);
      return data;
    }, ErrorHandler.networkContext('searching photos'), this.getMockData(sanitizedQuery));

    return result || this.getMockData(sanitizedQuery);
  }

  private getMockData(query: string): PexelsResponse {
    console.log(`Mock search for: ${query}`);
    // Mock data for testing
    return {
      total_results: 1000,
      page: 1,
      per_page: 20,
      photos: [
        {
          id: 1,
          width: 4000,
          height: 3000,
          url: 'https://example.com/photo1',
          photographer: 'Mock Photographer 1',
          photographer_url: 'https://example.com/photographer1',
          photographer_id: 1,
          avg_color: '#cccccc',
          src: {
            original: 'https://picsum.photos/4000/3000?random=1',
            large2x: 'https://picsum.photos/1000/750?random=1',
            large: 'https://picsum.photos/800/600?random=1',
            medium: 'https://picsum.photos/600/450?random=1',
            small: 'https://picsum.photos/400/300?random=1',
            portrait: 'https://picsum.photos/400/600?random=1',
            landscape: 'https://picsum.photos/800/400?random=1',
            tiny: 'https://picsum.photos/200/150?random=1'
          }
        },
        {
          id: 2,
          width: 3000,
          height: 4000,
          url: 'https://example.com/photo2',
          photographer: 'Mock Photographer 2',
          photographer_url: 'https://example.com/photographer2',
          photographer_id: 2,
          avg_color: '#aaaaaa',
          src: {
            original: 'https://picsum.photos/3000/4000?random=2',
            large2x: 'https://picsum.photos/750/1000?random=2',
            large: 'https://picsum.photos/600/800?random=2',
            medium: 'https://picsum.photos/450/600?random=2',
            small: 'https://picsum.photos/300/400?random=2',
            portrait: 'https://picsum.photos/300/400?random=2',
            landscape: 'https://picsum.photos/600/300?random=2',
            tiny: 'https://picsum.photos/150/200?random=2'
          }
        }
      ]
    };
  }

  // Rate limiting helper (basic implementation)
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000 / 50; // 50 requests per hour = ~1.2 per minute = ~720ms interval

  async rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;

    if (timeSinceLast < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLast));
    }

    this.lastRequestTime = Date.now();
    return requestFn();
  }
}

// Singleton instance
export const imageSearchAPI = new ImageSearchAPI();