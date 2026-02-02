// src/utils/gameLoop.ts - Main game loop with requestAnimationFrame

import { PerformanceMonitor } from './performanceMonitor';

export interface GameLoopCallbacks {
  update: (deltaTime: number) => void;
  render: () => void;
}

export class GameLoop {
  private running = false;
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private callbacks: GameLoopCallbacks;
  private frameInterval: number;
  private accumulator = 0;

  constructor(callbacks: GameLoopCallbacks, targetFPS = 60) {
    this.callbacks = callbacks;
    this.frameInterval = 1000 / targetFPS;
  }

  start(): void {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    // Fixed timestep for updates
    this.accumulator += deltaTime;
    while (this.accumulator >= this.frameInterval) {
      this.callbacks.update(this.frameInterval);
      this.accumulator -= this.frameInterval;
    }

    // Render every frame for smooth visuals
    PerformanceMonitor.measureRenderTime(() => {
      this.callbacks.render();
    });

    PerformanceMonitor.updateFPS();

    this.lastTime = currentTime;
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  isRunning(): boolean {
    return this.running;
  }

  setTargetFPS(fps: number): void {
    this.frameInterval = 1000 / fps;
  }
}