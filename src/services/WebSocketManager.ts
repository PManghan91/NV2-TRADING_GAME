import { API_CONFIG } from '../utils/constants';
import { MarketPrice, WSMessage } from '../types/trading';

export type WSConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type WSMessageHandler = (data: any) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey: string;
  private subscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private messageHandlers = new Map<string, WSMessageHandler[]>();
  private connectionStatus: WSConnectionStatus = 'disconnected';
  private reconnectTimeoutId: number | null = null;
  private statusChangeHandler: ((status: WSConnectionStatus) => void) | null = null;

  constructor() {
    // DISABLED - Using Binance WebSocket instead of Finnhub
    this.url = '';
    this.apiKey = '';
    this.maxReconnectAttempts = 0;
    this.reconnectInterval = 0;
  }

  public getConnectionStatus(): WSConnectionStatus {
    return this.connectionStatus;
  }

  public setStatusChangeHandler(handler: (status: WSConnectionStatus) => void): void {
    this.statusChangeHandler = handler;
  }

  private setStatus(status: WSConnectionStatus): void {
    this.connectionStatus = status;
    this.statusChangeHandler?.(status);
  }

  public connect(): Promise<void> {
    return new Promise((resolve) => {
      // DISABLED - Using Binance WebSocket instead of Finnhub
      console.warn('WebSocketManager (Finnhub) is disabled - using Binance WebSocket');
      resolve();
    });
  }

  public disconnect(): void {
    // DISABLED
    console.warn('WebSocketManager (Finnhub) is disabled');
  }

  private handleMessage(data: string): void {
    // DISABLED
  }

  private resubscribeAll(): void {
    // DISABLED
  }

  private scheduleReconnect(): void {
    // DISABLED
  }

  public subscribe(symbol: string): boolean {
    // DISABLED
    console.warn('WebSocketManager (Finnhub) subscribe is disabled');
    return false;
  }

  public unsubscribe(symbol: string): boolean {
    // DISABLED
    console.warn('WebSocketManager (Finnhub) unsubscribe is disabled');
    return false;
  }

  public addMessageHandler(type: string, handler: WSMessageHandler): void {
    // DISABLED - no messages will be sent
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  public removeMessageHandler(type: string, handler: WSMessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  public isConnected(): boolean {
    return false; // Always disconnected since we're disabled
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();