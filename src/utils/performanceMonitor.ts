/**
 * Performance monitoring utilities for the puzzle game
 */

export class PerformanceMonitor {
  private static frameCount = 0;
  private static lastTime = performance.now();
  private static fps = 0;
  private static renderTimes: number[] = [];
  private static readonly MAX_SAMPLES = 60;

  // Track FPS
  static updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) { // Update every second
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastTime = now;

      // Log FPS if below threshold
      if (this.fps < 30) {
        console.warn(`Low FPS detected: ${this.fps}`);
      }
    }
  }

  // Track render performance
  static measureRenderTime(renderFn: () => void): void {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    const renderTime = end - start;

    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > this.MAX_SAMPLES) {
      this.renderTimes.shift();
    }

    // Log slow renders
    if (renderTime > 16.67) { // Slower than 60 FPS
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }
  }

  // Get performance stats
  static getStats(): {
    fps: number;
    avgRenderTime: number;
    maxRenderTime: number;
    memoryUsage?: number;
  } {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;

    const maxRenderTime = this.renderTimes.length > 0
      ? Math.max(...this.renderTimes)
      : 0;

    // Memory usage (if available)
    const memoryUsage = (performance as any).memory?.usedJSHeapSize;

    return {
      fps: this.fps,
      avgRenderTime,
      maxRenderTime,
      memoryUsage
    };
  }

  // Log performance stats periodically
  static logStats(): void {
    const stats = this.getStats();
    console.log(`Performance: ${stats.fps} FPS, Avg render: ${stats.avgRenderTime.toFixed(2)}ms${stats.memoryUsage ? `, Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB` : ''}`);
  }
}