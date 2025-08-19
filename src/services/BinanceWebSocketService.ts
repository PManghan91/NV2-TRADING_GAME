/**
 * Binance WebSocket Service
 * Free, reliable WebSocket API for real-time cryptocurrency data
 * No API key required for public market data
 */

import { MarketPrice } from '../types/trading';

export type BinanceSymbol = string; // e.g., 'btcusdt', 'ethusdt'
export type BinanceStream = 'trade' | 'ticker' | 'miniTicker' | 'depth' | 'kline';

interface BinanceTradeData {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  p: string;  // Price
  q: string;  // Quantity
  b: number;  // Buyer order ID
  a: number;  // Seller order ID
  T: number;  // Trade time
  m: boolean; // Is buyer the market maker
}

interface BinanceTickerData {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  p: string;  // Price change
  P: string;  // Price change percent
  w: string;  // Weighted average price
  c: string;  // Last price
  Q: string;  // Last quantity
  o: string;  // Open price
  h: string;  // High price
  l: string;  // Low price
  v: string;  // Total traded base asset volume
  q: string;  // Total traded quote asset volume
}

export class BinanceWebSocketService {
  private ws: WebSocket | null = null;
  private baseUrl = 'wss://stream.binance.com:9443';
  private subscriptions = new Map<string, Set<string>>(); // symbol -> streams
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000;
  private pingInterval: number | null = null;
  private isConnected = false;
  
  // Callbacks
  private onPriceUpdate?: (price: MarketPrice) => void;
  private onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  private onError?: (error: Error) => void;

  constructor() {
    console.log('BinanceWebSocketService initialized');
  }

  /**
   * Set callback handlers
   */
  public setHandlers(handlers: {
    onPriceUpdate?: (price: MarketPrice) => void;
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
    onError?: (error: Error) => void;
  }) {
    this.onPriceUpdate = handlers.onPriceUpdate;
    this.onStatusChange = handlers.onStatusChange;
    this.onError = handlers.onError;
  }

  /**
   * Connect to Binance WebSocket
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.onStatusChange?.('connecting');
      
      // Use single connection endpoint that allows dynamic subscriptions
      const url = `${this.baseUrl}/ws`;
      
      console.log(`Connecting to Binance WebSocket: ${url}`);
      
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('✅ Binance WebSocket connected successfully!');
          this.isConnected = true;
          this.onStatusChange?.('connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('Binance WebSocket error:', error);
          this.onStatusChange?.('error');
          this.onError?.(new Error('WebSocket connection error'));
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`Binance WebSocket closed: Code ${event.code}`);
          this.isConnected = false;
          this.onStatusChange?.('disconnected');
          this.stopPingInterval();
          
          // Auto-reconnect if not manual close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('Failed to create Binance WebSocket:', error);
        this.onStatusChange?.('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Binance WebSocket
   */
  public disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.onStatusChange?.('disconnected');
  }

  /**
   * Subscribe to a symbol's price updates
   */
  public subscribe(symbol: string, stream: BinanceStream = 'trade'): boolean {
    const formattedSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!this.subscriptions.has(formattedSymbol)) {
      this.subscriptions.set(formattedSymbol, new Set());
    }
    
    this.subscriptions.get(formattedSymbol)!.add(stream);
    
    // If connected and WebSocket supports dynamic subscription
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send subscription message with proper format for Binance
      const subMessage = {
        method: 'SUBSCRIBE',
        params: [`${formattedSymbol}@${stream}`],
        id: Math.floor(Date.now() / 1000) // Use shorter ID
      };
      
      try {
        this.ws.send(JSON.stringify(subMessage));
        console.log(`Subscribing to ${formattedSymbol}@${stream}`);
      } catch (error) {
        console.error(`Failed to subscribe to ${formattedSymbol}:`, error);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Unsubscribe from a symbol
   */
  public unsubscribe(symbol: string, stream?: BinanceStream): boolean {
    const formattedSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (stream) {
      this.subscriptions.get(formattedSymbol)?.delete(stream);
      if (this.subscriptions.get(formattedSymbol)?.size === 0) {
        this.subscriptions.delete(formattedSymbol);
      }
    } else {
      this.subscriptions.delete(formattedSymbol);
    }
    
    // If connected, reconnect with updated streams
    if (this.isConnected) {
      this.reconnectWithNewStreams();
    }
    
    return true;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle subscription confirmations
      if (message.result === null && message.id) {
        console.log('Subscription confirmed for request:', message.id);
        return;
      }
      
      // Handle errors
      if (message.error) {
        // Only log non-ping errors (Binance doesn't support ping method)
        if (!message.error.msg?.includes('ping')) {
          console.error('Binance WebSocket error:', message.error);
        }
        return;
      }
      
      // Handle pong responses
      if (message.result && message.id) {
        // Pong response, ignore
        return;
      }
      
      // Handle different message types
      if (message.stream) {
        // Combined stream message
        const streamData = message.data;
        this.processStreamData(message.stream, streamData);
      } else if (message.e) {
        // Single stream message
        this.processStreamData('', message);
      }
      
    } catch (error) {
      console.error('Error parsing Binance message:', error);
    }
  }

  /**
   * Process stream data based on type
   */
  private processStreamData(stream: string, data: any): void {
    if (data.e === 'trade' || stream.includes('@trade')) {
      this.processTrade(data as BinanceTradeData);
    } else if (data.e === '24hrTicker' || stream.includes('@ticker')) {
      this.processTicker(data as BinanceTickerData);
    }
  }

  /**
   * Process trade data
   */
  private processTrade(trade: BinanceTradeData): void {
    const marketPrice: MarketPrice = {
      symbol: trade.s,
      price: parseFloat(trade.p),
      change: 0, // Will be calculated elsewhere
      changePercent: 0, // Will be calculated elsewhere
      volume: parseFloat(trade.q),
      timestamp: trade.T,
      // Note: 24h change is not available in trade stream, will come from ticker stream
    };
    
    this.onPriceUpdate?.(marketPrice);
  }

  /**
   * Process ticker data
   */
  private processTicker(ticker: BinanceTickerData): void {
    const marketPrice: MarketPrice = {
      symbol: ticker.s,
      price: parseFloat(ticker.c),
      change: parseFloat(ticker.p),
      changePercent: parseFloat(ticker.P),
      change24h: parseFloat(ticker.P), // 24h change percentage
      volume: parseFloat(ticker.v),
      timestamp: ticker.E,
    };
    
    this.onPriceUpdate?.(marketPrice);
  }

  /**
   * Build stream URL from subscriptions
   */
  private buildStreamUrl(): string {
    const streams: string[] = [];
    
    this.subscriptions.forEach((streamTypes, symbol) => {
      streamTypes.forEach(stream => {
        streams.push(`${symbol}@${stream}`);
      });
    });
    
    return streams.join('/');
  }

  /**
   * Reconnect with new stream subscriptions
   */
  private async reconnectWithNewStreams(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.connect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 30000);
    
    console.log(`Scheduling Binance reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Binance reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    // Binance WebSocket doesn't require explicit ping messages
    // The connection is maintained automatically with the data stream
    // We'll just monitor the connection state
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.log('Binance WebSocket connection lost, will reconnect...');
        this.isConnected = false;
        this.onStatusChange?.('disconnected');
      }
    }, 30000); // Check connection every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Singleton instance
export const binanceWebSocket = new BinanceWebSocketService();