/**
 * @fileoverview TypeScript type definitions for better IDE support
 * This file provides type definitions for JSDoc-annotated JavaScript code
 */

declare namespace SocialSnap {
  // Core interfaces
  interface IPlatformExtractor {
    readonly platformName: string;
    isSupported(url: string): boolean;
    extractImages(): Promise<ImageData[]>;
    validatePage(): Promise<boolean>;
  }

  interface IDownloadManager {
    downloadSingle(image: ImageData): Promise<DownloadResult>;
    downloadBatch(images: ImageData[]): Promise<DownloadResult[]>;
    getDownloadProgress(): DownloadProgress;
    cancelAllDownloads(): Promise<void>;
    retryFailedDownloads(): Promise<DownloadResult[]>;
  }

  interface IMessageBus {
    send<T>(message: Message, timeout?: number): Promise<MessageResponse<T>>;
    sendAsync(message: Message): void;
    subscribe<T>(messageType: string, handler: MessageHandler<T>): void;
    unsubscribe(messageType: string, handler: MessageHandler): void;
    isReady(): boolean;
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
  }

  interface IErrorHandler {
    handleError(error: Error, context?: ErrorContext): Promise<ErrorHandlerResult>;
    registerHandler(errorType: string | Function, handler: ErrorHandlerFunction): void;
    unregisterHandler(errorType: string | Function, handler: ErrorHandlerFunction): void;
    logError(error: Error, context?: ErrorContext): void;
    hasHandler(errorType: string | Function): boolean;
    getErrorStats(): object;
    clearErrorStats(): void;
  }

  // Data types
  interface ImageData {
    id: string;
    url: string;
    thumbnailUrl: string;
    alt: string;
    width: number | null;
    height: number | null;
    platform: string;
    extractedAt: number;
    metadata: Record<string, any>;
  }

  interface Message {
    type: string;
    payload: any;
    requestId: string;
    timestamp: number;
    priority?: number;
  }

  interface MessageResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    requestId: string;
    timestamp: number;
  }

  interface DownloadResult {
    id: string;
    success: boolean;
    filename: string;
    error?: string;
    timestamp: number;
  }

  interface DownloadProgress {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    percentage: number;
  }

  interface ErrorContext {
    component?: string;
    operation?: string;
    metadata?: Record<string, any>;
    userId?: string;
    url?: string;
  }

  interface ErrorHandlerResult {
    handled: boolean;
    shouldRetry: boolean;
    userMessage?: string;
    fallbackValue?: any;
  }

  // Function types
  type MessageHandler<T = any> = (message: Message) => Promise<T> | T;
  type ErrorHandlerFunction = (error: Error, context: ErrorContext) => Promise<ErrorHandlerResult> | ErrorHandlerResult;

  // Enums
  enum MessageTypes {
    EXTRACT_IMAGES = 'EXTRACT_IMAGES',
    IMAGES_EXTRACTED = 'IMAGES_EXTRACTED',
    EXTRACTION_ERROR = 'EXTRACTION_ERROR',
    DOWNLOAD_SINGLE = 'DOWNLOAD_SINGLE',
    DOWNLOAD_BATCH = 'DOWNLOAD_BATCH',
    DOWNLOAD_PROGRESS = 'DOWNLOAD_PROGRESS',
    DOWNLOAD_COMPLETE = 'DOWNLOAD_COMPLETE',
    DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
    DOWNLOAD_CANCELLED = 'DOWNLOAD_CANCELLED',
    GET_IMAGES = 'GET_IMAGES',
    GET_DOWNLOAD_STATUS = 'GET_DOWNLOAD_STATUS',
    CANCEL_DOWNLOADS = 'CANCEL_DOWNLOADS',
    RETRY_DOWNLOADS = 'RETRY_DOWNLOADS',
    PING = 'PING',
    PONG = 'PONG',
    STATUS_UPDATE = 'STATUS_UPDATE',
    ERROR_REPORT = 'ERROR_REPORT',
    GET_CONFIG = 'GET_CONFIG',
    UPDATE_CONFIG = 'UPDATE_CONFIG',
    CONFIG_CHANGED = 'CONFIG_CHANGED'
  }

  enum ErrorCodes {
    PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
    PLATFORM_DETECTION_FAILED = 'PLATFORM_DETECTION_FAILED',
    PLATFORM_INITIALIZATION_FAILED = 'PLATFORM_INITIALIZATION_FAILED',
    IMAGE_EXTRACTION_FAILED = 'IMAGE_EXTRACTION_FAILED',
    NO_IMAGES_FOUND = 'NO_IMAGES_FOUND',
    PAGE_NOT_READY = 'PAGE_NOT_READY',
    INVALID_PAGE_STRUCTURE = 'INVALID_PAGE_STRUCTURE',
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    DOWNLOAD_TIMEOUT = 'DOWNLOAD_TIMEOUT',
    DOWNLOAD_CANCELLED = 'DOWNLOAD_CANCELLED',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    STORAGE_FULL = 'STORAGE_FULL',
    NETWORK_ERROR = 'NETWORK_ERROR',
    REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
    INVALID_URL = 'INVALID_URL',
    CORS_ERROR = 'CORS_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_INPUT = 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
  }

  enum ImageQuality {
    THUMBNAIL = 'thumbnail',
    MEDIUM = 'medium',
    HIGH = 'high',
    ORIGINAL = 'original'
  }

  enum ImageFormat {
    JPEG = 'jpeg',
    JPG = 'jpg',
    PNG = 'png',
    WEBP = 'webp',
    GIF = 'gif',
    SVG = 'svg'
  }
}

// Global Chrome extension types
declare namespace chrome {
  namespace runtime {
    interface Port {
      name: string;
      disconnect(): void;
      onDisconnect: chrome.events.Event<(port: Port) => void>;
      onMessage: chrome.events.Event<(message: any, port: Port) => void>;
      postMessage(message: any): void;
      sender?: chrome.runtime.MessageSender;
    }

    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      selected: boolean;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      audible?: boolean;
      discarded: boolean;
      autoDiscardable: boolean;
      mutedInfo?: chrome.tabs.MutedInfo;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
      width?: number;
      height?: number;
      sessionId?: string;
    }
  }

  namespace downloads {
    interface DownloadItem {
      id: number;
      url: string;
      filename: string;
      danger: string;
      mime: string;
      startTime: string;
      endTime?: string;
      state: string;
      paused: boolean;
      canResume: boolean;
      error?: string;
      bytesReceived: number;
      totalBytes: number;
      fileSize: number;
      exists: boolean;
    }
  }
}

export = SocialSnap;
export as namespace SocialSnap;
