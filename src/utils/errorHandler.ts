// src/utils/errorHandler.ts - Error handling utilities

import { Logger } from './logger';

export class ErrorHandler {
  static handleError(error: Error, context?: string): void {
    Logger.error(`Error in ${context || 'unknown context'}: ${error.message}`, error);

    // In development, rethrow to get full stack traces
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      throw error;
    }
  }

  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error as Error, context);
      return fallback;
    }
  }

  static withSyncErrorHandling<T>(
    operation: () => T,
    context: string,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.handleError(error as Error, context);
      return fallback;
    }
  }
}

export class GameError extends Error {
  public code: string;
  public context?: string;
  public originalError?: Error;

  constructor(message: string, code: string, context?: string, originalError?: Error) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
  }
}

export class ValidationError extends GameError {
  constructor(message: string, context?: string) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends GameError {
  constructor(message: string, context?: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', context, originalError);
    this.name = 'NetworkError';
  }
}

export class RenderingError extends GameError {
  constructor(message: string, context?: string, originalError?: Error) {
    super(message, 'RENDERING_ERROR', context, originalError);
    this.name = 'RenderingError';
  }
}