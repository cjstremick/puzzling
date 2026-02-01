// src/audio/soundManager.ts - Sound effect management

import { APP_CONFIG } from '../config/appConfig';
import { Logger } from '../utils/logger';

export class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = APP_CONFIG.SOUND.ENABLED_BY_DEFAULT; // Disabled by default for accessibility

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds(): void {
    const soundFiles = [
      { key: 'flip', file: 'flip.wav' },
      { key: 'rotate', file: 'rotate.wav' },
      { key: 'snap', file: 'snap.wav' },
      { key: 'pickup', file: 'pickup.wav' },
      { key: 'drop', file: 'drop.wav' },
      { key: 'complete', file: 'complete.wav' },
    ];

    soundFiles.forEach(({ key, file }) => {
      const audio = new Audio(`assets/audio/${file}`);
      audio.preload = 'auto';
      audio.volume = APP_CONFIG.SOUND.VOLUME; // Subtle volume
      this.sounds.set(key, audio);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(soundKey: string): void {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundKey);
    if (sound) {
      sound.currentTime = 0; // Reset to start for overlapping plays
      sound.play().catch(error => {
        Logger.warn(`Failed to play sound ${soundKey}:`, error);
      });
    }
  }
}