/**
 * Error Handler Utility
 * 统一的错误处理和日志记录
 */

import { BasicTool, ProgressWindowHelper } from "zotero-plugin-toolkit";
import { config } from "@/config";

export enum ErrorLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface ErrorContext {
  module?: string;
  action?: string;
  userId?: string;
  timestamp?: number;
  [key: string]: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{
    level: ErrorLevel;
    message: string;
    error?: Error;
    context?: ErrorContext;
    timestamp: number;
  }> = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 记录错误
   */
  log(
    level: ErrorLevel,
    message: string,
    error?: Error | unknown,
    context?: ErrorContext,
  ): void {
    const timestamp = Date.now();

    // 添加到错误日志
    this.errorLog.push({
      level,
      message,
      error: error instanceof Error ? error : undefined,
      context: {
        ...context,
        timestamp,
      },
      timestamp,
    });

    // 格式化消息
    const formattedMessage = this.formatMessage(level, message, context);

    // 输出到 Zotero 日志
    if (addon && addon.ztoolkit) {
      addon.ztoolkit.log(
        formattedMessage,
        level === ErrorLevel.ERROR ? "error" : undefined,
      );
    } else {
      console.log(formattedMessage);
    }

    // 如果是错误，还要记录堆栈
    if (error instanceof Error && error.stack) {
      const stackMessage = `Stack trace:\n${error.stack}`;
      if (addon && addon.ztoolkit) {
        addon.ztoolkit.log(stackMessage, "error");
      } else {
        console.error(stackMessage);
      }
    }

    // 对于严重错误，显示用户通知
    if (level === ErrorLevel.ERROR || level === ErrorLevel.FATAL) {
      this.showErrorNotification(message, error);
    }

    // 保持日志大小在合理范围内
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-500);
    }
  }

  /**
   * 便捷方法
   */
  debug(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.DEBUG, message, undefined, context);
  }

  info(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.INFO, message, undefined, context);
  }

  warn(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.WARN, message, undefined, context);
  }

  error(
    message: string,
    error?: Error | unknown,
    context?: ErrorContext,
  ): void {
    this.log(ErrorLevel.ERROR, message, error, context);
  }

  fatal(
    message: string,
    error?: Error | unknown,
    context?: ErrorContext,
  ): void {
    this.log(ErrorLevel.FATAL, message, error, context);
  }

  /**
   * 格式化消息
   */
  private formatMessage(
    level: ErrorLevel,
    message: string,
    context?: ErrorContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context
      ? ` [${Object.entries(context)
          .filter(([key]) => key !== "timestamp")
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")}]`
      : "";

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(
    message: string,
    error?: Error | unknown,
  ): void {
    try {
      // 使用 ProgressWindow 显示错误
      const progressWindow = new ProgressWindowHelper(config.addonName);

      let errorMessage = message;
      if (error instanceof Error) {
        errorMessage += `\n${error.message}`;
      }

      progressWindow
        .createLine({
          text: errorMessage,
          type: "error",
          progress: 100,
        })
        .show();

      // 5秒后自动关闭
      setTimeout(() => {
        try {
          progressWindow.close();
        } catch (e) {
          // 窗口可能已经被用户关闭
        }
      }, 5000);
    } catch (e) {
      // 如果 ProgressWindow 失败，尝试使用 alert
      try {
        const Zotero = BasicTool.getZotero();
        if (Zotero && Zotero.alert) {
          Zotero.alert(null, config.addonName, message);
        }
      } catch (e2) {
        // 最后的备选：console
        console.error(`[${config.addonName}] ${message}`, error);
      }
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog(level?: ErrorLevel): typeof this.errorLog {
    if (level) {
      return this.errorLog.filter((entry) => entry.level === level);
    }
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 导出错误日志
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  /**
   * 包装函数以自动捕获错误
   */
  wrap<T extends (...args: any[]) => any>(fn: T, context?: ErrorContext): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);

        // 处理 Promise
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.error(
              `Async error in ${fn.name || "anonymous function"}`,
              error,
              context,
            );
            throw error;
          });
        }

        return result;
      } catch (error) {
        this.error(
          `Error in ${fn.name || "anonymous function"}`,
          error,
          context,
        );
        throw error;
      }
    }) as T;
  }

  /**
   * 包装异步函数
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: ErrorContext,
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.error(
          `Async error in ${fn.name || "anonymous function"}`,
          error,
          context,
        );
        throw error;
      }
    }) as T;
  }
}

// 导出单例
export const errorHandler = ErrorHandler.getInstance();

// 全局错误处理器
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    errorHandler.error("Unhandled promise rejection", event.reason, {
      type: "unhandledrejection",
    });
  });

  window.addEventListener("error", (event) => {
    errorHandler.error("Uncaught error", event.error, {
      type: "error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}
