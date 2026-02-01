// src/utils/logger.ts - Centralized logging utility

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  error?: Error;
}

export class Logger {
  private static enabled: boolean = true;
  private static minLevel: LogLevel = 'debug';
  private static logs: LogEntry[] = [];

  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  static setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  static debug(message: string, ...args: any[]): void {
    this.log('debug', message, undefined, ...args);
  }

  static info(message: string, ...args: any[]): void {
    this.log('info', message, undefined, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    this.log('warn', message, undefined, ...args);
  }

  static error(message: string, error?: Error, ...args: any[]): void {
    this.log('error', message, error, ...args);
  }

  private static log(level: LogLevel, message: string, error?: Error, ...args: any[]): void {
    if (!this.enabled || this.LEVELS[level] < this.LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      error,
    };

    // Store log entry
    this.logs.push(entry);

    // Keep only last 1000 entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Format and output
    const prefix = `[${level.toUpperCase()}]`;
    const formattedMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;

    if (level === 'error') {
      console.error(prefix, formattedMessage, error);
    } else if (level === 'warn') {
      console.warn(prefix, formattedMessage);
    } else {
      console.log(prefix, formattedMessage);
    }
  }

  static getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static exportLogs(): string {
    return this.logs
      .map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const errorInfo = log.error ? `\n  Error: ${log.error.message}\n  Stack: ${log.error.stack}` : '';
        return `${timestamp} [${log.level.toUpperCase()}] ${log.message}${errorInfo}`;
      })
      .join('\n');
  }
}