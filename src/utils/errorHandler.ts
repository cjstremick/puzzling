// src/utils/errorHandler.ts - Enhanced error handling utilities

import { Logger } from './logger';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 'network' | 'validation' | 'rendering' | 'persistence' | 'audio' | 'configuration' | 'unknown';

// Constants for enum values
export const ErrorSeverities = {
  LOW: 'low' as ErrorSeverity,
  MEDIUM: 'medium' as ErrorSeverity,
  HIGH: 'high' as ErrorSeverity,
  CRITICAL: 'critical' as ErrorSeverity
} as const;

export const ErrorCategories = {
  NETWORK: 'network' as ErrorCategory,
  VALIDATION: 'validation' as ErrorCategory,
  RENDERING: 'rendering' as ErrorCategory,
  PERSISTENCE: 'persistence' as ErrorCategory,
  AUDIO: 'audio' as ErrorCategory,
  CONFIGURATION: 'configuration' as ErrorCategory,
  UNKNOWN: 'unknown' as ErrorCategory
} as const;

export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  operation?: string;
  userMessage?: string;
  recoveryAction?: () => void | Promise<void>;
  retryable?: boolean;
  maxRetries?: number;
}

export class GameError extends Error {
  public code: string;
  public category: ErrorCategory;
  public severity: ErrorSeverity;
  public context?: string;
  public originalError?: Error;
  public recoveryAction?: () => void | Promise<void>;
  public retryable: boolean;
  public timestamp: Date;
  public userMessage?: string;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory = ErrorCategories.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverities.MEDIUM,
    context?: string,
    originalError?: Error,
    recoveryAction?: () => void | Promise<void>,
    retryable = false,
    userMessage?: string
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.originalError = originalError;
    this.recoveryAction = recoveryAction;
    this.retryable = retryable;
    this.timestamp = new Date();
    this.userMessage = userMessage;
  }
}

export class NetworkError extends GameError {
  constructor(message: string, context?: string, originalError?: Error, recoveryAction?: () => void | Promise<void>) {
    super(message, 'NETWORK_ERROR', ErrorCategories.NETWORK, ErrorSeverities.HIGH, context, originalError, recoveryAction, true);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends GameError {
  constructor(message: string, context?: string, recoveryAction?: () => void | Promise<void>) {
    super(message, 'VALIDATION_ERROR', ErrorCategories.VALIDATION, ErrorSeverities.MEDIUM, context, undefined, recoveryAction, false);
    this.name = 'ValidationError';
  }
}

export class RenderingError extends GameError {
  constructor(message: string, context?: string, originalError?: Error, recoveryAction?: () => void | Promise<void>) {
    super(message, 'RENDERING_ERROR', ErrorCategories.RENDERING, ErrorSeverities.HIGH, context, originalError, recoveryAction, true);
    this.name = 'RenderingError';
  }
}

export class PersistenceError extends GameError {
  constructor(message: string, context?: string, originalError?: Error, recoveryAction?: () => void | Promise<void>) {
    super(message, 'PERSISTENCE_ERROR', ErrorCategories.PERSISTENCE, ErrorSeverities.MEDIUM, context, originalError, recoveryAction, true);
    this.name = 'PersistenceError';
  }
}

export class AudioError extends GameError {
  constructor(message: string, context?: string, originalError?: Error, recoveryAction?: () => void | Promise<void>) {
    super(message, 'AUDIO_ERROR', ErrorCategories.AUDIO, ErrorSeverities.LOW, context, originalError, recoveryAction, true);
    this.name = 'AudioError';
  }
}

export class ConfigurationError extends GameError {
  constructor(message: string, context?: string, recoveryAction?: () => void | Promise<void>) {
    super(message, 'CONFIGURATION_ERROR', ErrorCategories.CONFIGURATION, ErrorSeverities.CRITICAL, context, undefined, recoveryAction, false);
    this.name = 'ConfigurationError';
  }
}

export class ErrorHandler {
  private static errorCounts = new Map<string, number>();
  private static maxRetries = 3;
  private static retryDelays = [1000, 2000, 5000]; // Progressive backoff

  static handleError(error: unknown, context?: ErrorContext): GameError {
    // Convert unknown error to GameError
    const gameError = this.normalizeError(error, context);

    // Log the error
    this.logError(gameError);

    // Track error frequency
    this.trackError(gameError);

    // Handle critical errors
    if (gameError.severity === ErrorSeverities.CRITICAL) {
      this.handleCriticalError(gameError);
    }

    return gameError;
  }

  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallback?: T
  ): Promise<T | undefined> {
    let lastError: GameError | null = null;

    for (let attempt = 0; attempt <= (context.maxRetries ?? this.maxRetries); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error, context);

        // Don't retry if not retryable or max attempts reached
        if (!lastError.retryable || attempt >= (context.maxRetries ?? this.maxRetries)) {
          break;
        }

        // Wait before retrying
        const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
        Logger.warn(`Retrying operation in ${delay}ms (attempt ${attempt + 1})`);
        await this.delay(delay);
      }
    }

    // If we have a fallback, return it
    if (fallback !== undefined) {
      Logger.info('Using fallback value due to error');
      return fallback;
    }

    // If error has recovery action, execute it
    if (lastError?.recoveryAction) {
      try {
        Logger.info('Executing recovery action');
        const result = lastError.recoveryAction();
        if (result instanceof Promise) {
          await result;
        }
      } catch (recoveryError) {
        Logger.error('Recovery action failed:', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
      }
    }

    // Re-throw the last error if no fallback
    throw lastError;
  }

  static withSyncErrorHandling<T>(
    operation: () => T,
    context: ErrorContext,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      const gameError = this.handleError(error, context);

      // If we have a fallback, return it
      if (fallback !== undefined) {
        Logger.info('Using fallback value due to error');
        return fallback;
      }

      // If error has recovery action, execute it
      if (gameError.recoveryAction) {
        try {
          Logger.info('Executing recovery action');
          const result = gameError.recoveryAction();
          if (result instanceof Promise) {
            result.catch(recoveryError => 
              Logger.error('Recovery action failed:', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)))
            );
          }
        } catch (recoveryError) {
          Logger.error('Recovery action failed:', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
        }
      }

      // Re-throw the error if no fallback
      throw gameError;
    }
  }

  private static normalizeError(error: unknown, context?: ErrorContext): GameError {
    if (error instanceof GameError) {
      // Already a GameError, just update context if provided
      if (context) {
        error.category = context.category;
        error.severity = context.severity;
        error.context = context.operation;
        error.userMessage = context.userMessage;
        error.recoveryAction = context.recoveryAction;
        error.retryable = context.retryable ?? error.retryable;
      }
      return error;
    }

    if (error instanceof Error) {
      // Convert standard Error to appropriate GameError type
      return new GameError(
        error.message,
        'UNKNOWN_ERROR',
        context?.category ?? ErrorCategories.UNKNOWN,
        context?.severity ?? ErrorSeverities.MEDIUM,
        context?.operation,
        error,
        context?.recoveryAction,
        context?.retryable
      );
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : String(error);
    return new GameError(
      message,
      'UNKNOWN_ERROR',
        context?.category ?? ErrorCategories.UNKNOWN,
        context?.severity ?? ErrorSeverities.MEDIUM,
      context?.operation,
      undefined,
      context?.recoveryAction,
      context?.retryable
    );
  }

  private static logError(error: GameError): void {
    const logData = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp.toISOString(),
      originalError: error.originalError?.message
    };

    switch (error.severity) {
      case ErrorSeverities.LOW:
        Logger.debug(`Error (${error.category}): ${error.message}`, logData);
        break;
      case ErrorSeverities.MEDIUM:
        Logger.info(`Error (${error.category}): ${error.message}`, logData);
        break;
      case ErrorSeverities.HIGH:
        Logger.warn(`Error (${error.category}): ${error.message}`, logData);
        break;
      case ErrorSeverities.CRITICAL:
        Logger.error(`Critical error (${error.category}): ${error.message}`, error, logData);
        break;
    }
  }

  private static trackError(error: GameError): void {
    const key = `${error.category}:${error.code}`;
    const count = (this.errorCounts.get(key) ?? 0) + 1;
    this.errorCounts.set(key, count);

    // Log warning if error occurs frequently
    if (count > 5) {
      Logger.warn(`Frequent error detected: ${key} (${count} occurrences)`);
    }
  }

  private static handleCriticalError(error: GameError): void {
    // For critical errors, we might want to:
    // - Show user notification
    // - Reset application state
    // - Report to error tracking service
    Logger.error('Critical error encountered - application may be in unstable state', error);

    // In development, rethrow to get full stack traces
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      throw error;
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for creating error contexts
  static networkContext(operation: string, userMessage?: string): ErrorContext {
    return {
      category: ErrorCategories.NETWORK,
      severity: ErrorSeverities.HIGH,
      operation,
      userMessage,
      retryable: true,
      maxRetries: 2
    };
  }

  static validationContext(operation: string, userMessage?: string): ErrorContext {
    return {
      category: ErrorCategories.VALIDATION,
      severity: ErrorSeverities.MEDIUM,
      operation,
      userMessage,
      retryable: false
    };
  }

  static persistenceContext(operation: string, userMessage?: string): ErrorContext {
    return {
      category: ErrorCategories.PERSISTENCE,
      severity: ErrorSeverities.MEDIUM,
      operation,
      userMessage,
      retryable: true,
      maxRetries: 1
    };
  }

  static renderingContext(operation: string, userMessage?: string): ErrorContext {
    return {
      category: ErrorCategories.RENDERING,
      severity: ErrorSeverities.HIGH,
      operation,
      userMessage,
      retryable: true,
      maxRetries: 1
    };
  }
}