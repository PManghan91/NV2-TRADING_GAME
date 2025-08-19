import { API_CONFIG, TRADING_CONFIG } from '../utils/constants';
import { WSMessage, FinnhubMessage, MarketPrice } from '../types/trading';

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
  
  // Status change callback
  private onStatusChange?: (status: WSConnectionStatus) => void;
  
  constructor(
    url: string = API_CONFIG.FINNHUB.WS_URL,
    apiKey: string = API_CONFIG.FINNHUB.API_KEY,
    maxReconnectAttempts: number = TRADING_CONFIG.MAX_RECONNECT_ATTEMPTS,
    reconnectInterval: number = TRADING_CONFIG.RECONNECT_INTERVAL
  ) {
    this.url = url;
    this.apiKey = apiKey;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectInterval = reconnectInterval;
  }

  public setStatusChangeHandler(handler: (status: WSConnectionStatus) => void): void {
    this.onStatusChange = handler;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.setStatus('error');
        reject(new Error('WebSocket connection timeout after 10 seconds'));
      }, 10000);
      
      try {
        console.log(`Connecting to WebSocket: ${this.url}?token=${this.apiKey.substring(0, 8)}...`);
        this.ws = new WebSocket(`${this.url}?token=${this.apiKey}`);
        
        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connected to Finnhub successfully');
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          
          // Resubscribe to all symbols after reconnection
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          this.setStatus('error');
          const errorMessage = `WebSocket connection failed: ${error.type || 'Connection error'}`;
          reject(new Error(errorMessage));
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(`WebSocket connection closed: Code ${event.code} - ${event.reason || 'No reason provided'}`);
          this.setStatus('disconnected');
          
          // Check if this is happening immediately after connection attempt
          const wasConnecting = this.connectionStatus === 'connecting';
          this.ws = null;
          
          // If this close event happens during initial connection, reject the promise
          if (event.code !== 1000 && wasConnecting) {
            const errorMessage = `WebSocket closed unexpectedly: Code ${event.code} - ${event.reason || 'No reason provided'}`;
            reject(new Error(errorMessage));
            return; // Don't attempt reconnect on initial failure
          }
          
          // Attempt to reconnect if not manually closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('Failed to create WebSocket connection:', error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
  }

  public subscribe(symbol: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queuing subscription for:', symbol);
      this.subscriptions.add(symbol);
      return false;
    }

    const message = { type: 'subscribe', symbol: symbol };
    
    try {
      this.ws.send(JSON.stringify(message));
      this.subscriptions.add(symbol);
      console.log('Subscribed to:', symbol);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to symbol:', symbol, error);
      return false;
    }
  }

  public unsubscribe(symbol: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, removing from subscriptions:', symbol);
      this.subscriptions.delete(symbol);
      return false;
    }

    const message = { type: 'unsubscribe', symbol: symbol };
    
    try {
      this.ws.send(JSON.stringify(message));
      this.subscriptions.delete(symbol);
      console.log('Unsubscribed from:', symbol);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from symbol:', symbol, error);
      return false;
    }
  }

  public addMessageHandler(type: string, handler: WSMessageHandler): void {
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

  public getConnectionStatus(): WSConnectionStatus {
    return this.connectionStatus;
  }

  public getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private setStatus(status: WSConnectionStatus): void {
    this.connectionStatus = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: FinnhubMessage = JSON.parse(data);
      
      // Handle different message types
      if (message.type === 'trade' && message.data) {
        // Process trade data
        message.data.forEach(trade => {
          const marketPrice: MarketPrice = {
            symbol: trade.s,
            price: trade.p,
            change: 0, // Will be calculated later
            changePercent: 0, // Will be calculated later
            volume: trade.v,
            timestamp: trade.t,
          };

          // Emit to price update handlers
          const handlers = this.messageHandlers.get('price');
          if (handlers) {
            handlers.forEach(handler => handler(marketPrice));
          }
        });
      }

      // Emit raw message to all handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error, data);
    }
  }

  private resubscribeAll(): void {
    // Resubscribe to all symbols after reconnection
    const symbols = Array.from(this.subscriptions);
    this.subscriptions.clear();
    
    symbols.forEach(symbol => {
      this.subscribe(symbol);
    });
  }

  private scheduleReconnect(): void {
    // DISABLED: Finnhub WebSocket reconnection - using Binance WebSocket for crypto instead
    // Finnhub WebSocket is failing with error 1006, we've switched to Binance for real-time data
    console.log('Finnhub WebSocket reconnection disabled - using Binance WebSocket instead');
    return;
    
    // Original reconnection logic (disabled):
    // this.reconnectAttempts++;
    // const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
    // console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    // this.reconnectTimeoutId = window.setTimeout(() => {
    //   this.connect().catch(error => {
    //     console.error('Reconnect attempt failed:', error);
    //   });
    // }, delay);
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();