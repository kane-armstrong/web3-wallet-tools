export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export class Logger {
  private static instance: Logger;

  private constructor(
    private readonly level: LogLevel = LogLevel.INFO,
    private readonly includeTimestamp: boolean = true
  ) {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  public warn(message: string, context?: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context, data);
    }
  }

  public info(message: string, context?: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context, data);
    }
  }

  public debug(message: string, context?: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context, data);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    const timestamp = this.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
    const contextStr = context ? `[${context}] ` : '';
    const prefix = `${timestamp}${level} ${contextStr}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(`${prefix}${message}`, data !== undefined ? data : '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix}${message}`, data !== undefined ? data : '');
        break;
      case LogLevel.INFO:
        console.log(`${prefix}${message}`, data !== undefined ? data : '');
        break;
      case LogLevel.DEBUG:
        console.log(`${prefix}${message}`, data !== undefined ? data : '');
        break;
    }
  }
}

export const logger = Logger.getInstance();
