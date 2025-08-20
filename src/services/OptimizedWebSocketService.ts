/**
 * Optimized Binance WebSocket Service with performance improvements
 * - Message throttling and batching
 * - Efficient memory management
 * - Reduced parsing overhead
 */

import { MarketPrice } from '../types/trading';

export class OptimizedBinanceWebSocketService {
  private ws: WebSocket | null = null;
  private baseUrl = 'wss://stream.binance.com:9443';
  private subscriptions = new Map<string, Set<string>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000;
  private pingInterval: number | null = null;
  private isConnected = false;
  
  // Performance optimizations
  private messageBuffer: any[] = [];
  private processingTimer: number | null = null;
  private lastProcessTime = 0;
  private BATCH_PROCESS_INTERVAL = 100; // Process messages every 100ms
  private MAX_BUFFER_SIZE = 100; // Max messages to buffer
  
  // Price cache to avoid duplicate updates (with size limit)
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private PRICE_CACHE_TTL = 50; // Minimum ms between price updates for same symbol
  private MAX_CACHE_SIZE = 1000; // Maximum cache entries to prevent memory growth
  
  // Callbacks
  private onPriceUpdate?: (prices: MarketPrice[]) => void; // Batch updates
  private onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  private onError?: (error: Error) => void;

  constructor() {
    console.log('OptimizedBinanceWebSocketService initialized');
  }

  /**
   * Set callback handlers with batch support
   */
  public setHandlers(handlers: {
    onPriceUpdate?: (prices: MarketPrice[]) => void;
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
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.onStatusChange?.('connecting');
      
      const url = `${this.baseUrl}/ws`;
      
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('✅ Optimized WebSocket connected');
          this.isConnected = true;
          this.onStatusChange?.('connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.startProcessingTimer();
          
          // Resubscribe after connection
          setTimeout(() => this.resubscribeAll(), 1000);
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          // Buffer messages instead of processing immediately
          this.bufferMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.onStatusChange?.('error');
          this.onError?.(new Error('WebSocket connection error'));
          if (!this.isConnected) {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          console.log(`WebSocket closed: Code ${event.code}`);
          this.isConnected = false;
          this.onStatusChange?.('disconnected');
          this.stopPingInterval();
          this.stopProcessingTimer();
          
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.onStatusChange?.('error');
        reject(error);
      }
    });
  }

  /**
   * Buffer incoming messages for batch processing
   */
  private bufferMessage(data: string): void {
    if (this.messageBuffer.length >= this.MAX_BUFFER_SIZE) {
      // Process immediately if buffer is full
      this.processBufferedMessages();
    }
    
    this.messageBuffer.push(data);
  }

  /**
   * Start timer for batch processing messages
   */
  private startProcessingTimer(): void {
    if (this.processingTimer) return;
    
    this.processingTimer = window.setInterval(() => {
      if (this.messageBuffer.length > 0) {
        this.processBufferedMessages();
      }
    }, this.BATCH_PROCESS_INTERVAL);
  }

  /**
   * Stop processing timer
   */
  private stopProcessingTimer(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Process all buffered messages in batch
   */
  private processBufferedMessages(): void {
    if (this.messageBuffer.length === 0) return;
    
    const now = Date.now();
    const messages = [...this.messageBuffer];
    this.messageBuffer = [];
    
    const priceUpdates: MarketPrice[] = [];
    const processedSymbols = new Set<string>();
    
    // Process messages in reverse order (latest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      try {
        const message = JSON.parse(messages[i]);
        
        // Skip if already processed this symbol in this batch
        if (message.s && processedSymbols.has(message.s)) {
          continue;
        }
        
        // Handle ticker messages (24hr stats)
        if (message.e === '24hrTicker') {
          const cached = this.priceCache.get(message.s);
          
          // Skip if price hasn't changed significantly or too soon
          if (cached && 
              now - cached.timestamp < this.PRICE_CACHE_TTL &&
              Math.abs(parseFloat(message.c) - cached.price) < 0.01) {
            continue;
          }
          
          const marketPrice = this.parseTickerMessage(message);
          if (marketPrice) {
            priceUpdates.push(marketPrice);
            processedSymbols.add(message.s);
            
            // Update cache with size limit to prevent memory leaks
            if (this.priceCache.size >= this.MAX_CACHE_SIZE) {
              // Remove oldest 10% of cache entries
              const entries = Array.from(this.priceCache.entries());
              entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
              const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.1);
              for (let i = 0; i < toRemove; i++) {
                this.priceCache.delete(entries[i][0]);
              }
            }
            
            this.priceCache.set(message.s, {
              price: marketPrice.price,
              timestamp: now
            });
          }
        }
      } catch (error) {
        // Log parsing errors for debugging but don't crash
        if (messages[i].length > 100) {
          console.warn('Failed to parse large WebSocket message:', messages[i].substring(0, 100) + '...');
        }
        continue;
      }
    }
    
    // Send batch update if we have any
    if (priceUpdates.length > 0) {
      this.onPriceUpdate?.(priceUpdates);
    }
    
    this.lastProcessTime = now;
  }

  /**
   * Parse ticker message efficiently
   */
  private parseTickerMessage(ticker: any): MarketPrice | null {
    try {
      const price = parseFloat(ticker.c);
      const priceChangePercent = parseFloat(ticker.P);
      
      // Validate data
      if (isNaN(price) || isNaN(priceChangePercent)) {
        return null;
      }
      
      if (priceChangePercent < -100 || priceChangePercent > 1000) {
        return null;
      }
      
      return {
        symbol: ticker.s,
        price: price,
        change: parseFloat(ticker.p),
        changePercent: priceChangePercent,
        change24h: priceChangePercent,
        open24h: parseFloat(ticker.o),
        high24h: parseFloat(ticker.h),
        low24h: parseFloat(ticker.l),
        volume: parseFloat(ticker.v),
        timestamp: ticker.E || Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to a symbol with deduplication
   */
  public subscribe(symbol: string, stream: string = 'ticker'): boolean {
    const formattedSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!this.subscriptions.has(formattedSymbol)) {
      this.subscriptions.set(formattedSymbol, new Set());
    }
    
    const existingStreams = this.subscriptions.get(formattedSymbol)!;
    if (existingStreams.has(stream)) {
      return true;
    }
    
    existingStreams.add(stream);
    
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription(formattedSymbol, stream);
    }
    
    return true;
  }

  /**
   * Send subscription message
   */
  private sendSubscription(symbol: string, stream: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const subMessage = {
      method: 'SUBSCRIBE',
      params: [`${symbol}@${stream}`],
      id: Date.now()
    };
    
    try {
      this.ws.send(JSON.stringify(subMessage));
    } catch (error) {
      console.error('Failed to send subscription:', error);
    }
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const allStreams: string[] = [];
    this.subscriptions.forEach((streams, symbol) => {
      streams.forEach(stream => {
        allStreams.push(`${symbol}@${stream}`);
      });
    });
    
    if (allStreams.length === 0) return;
    
    // Send in batches of 10
    for (let i = 0; i < allStreams.length; i += 10) {
      const batch = allStreams.slice(i, i + 10);
      const subMessage = {
        method: 'SUBSCRIBE',
        params: batch,
        id: Date.now() + i
      };
      
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(subMessage));
        }
      }, i * 100); // Stagger by 100ms
    }
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    this.stopPingInterval();
    this.stopProcessingTimer();
    
    if (this.ws) {
      // Remove all event listeners to prevent memory leaks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageBuffer = [];
    this.priceCache.clear();
    this.subscriptions.clear(); // Clear subscriptions
    this.reconnectAttempts = 0; // Reset reconnection attempts
    this.onStatusChange?.('disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.onStatusChange?.('error');
        }
      });
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Connection check only
      } else if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.log('Connection lost, reconnecting...');
        this.isConnected = false;
        this.onStatusChange?.('disconnected');
        this.stopPingInterval();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    }, 30000);
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

  /**
   * Get connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Force reconnect with rate limiting
   */
  private lastReconnectTime?: number;
  
  public async forceReconnect(): Promise<void> {
    const now = Date.now();
    if (this.lastReconnectTime && now - this.lastReconnectTime < 5000) {
      console.log('Reconnection rate limited');
      return;
    }
    
    this.lastReconnectTime = now;
    this.disconnect();
    this.reconnectAttempts = 0;
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.connect();
  }
}

// Singleton instance
export const optimizedWebSocket = new OptimizedBinanceWebSocketService();