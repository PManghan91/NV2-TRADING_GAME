/**
 * Binance WebSocket Service
 * Free, reliable WebSocket API for real-time cryptocurrency data
 * No API key required for public market data
 */

import { MarketPrice } from '../types/trading';
import { wsHealthMonitor } from './WebSocketHealthMonitor';

export type BinanceSymbol = string; // e.g., 'btcusdt', 'ethusdt'
export type BinanceStream = 'trade' | 'ticker' | 'miniTicker' | 'depth' | 'kline' | 'kline_15m' | 'kline_1h';

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

interface BinanceMiniTickerData {
  e: string;  // Event type = '24hrMiniTicker'
  E: number;  // Event time
  s: string;  // Symbol
  c: string;  // Close price
  o: string;  // Open price
  h: string;  // High price
  l: string;  // Low price
  v: string;  // Total traded base asset volume
  q: string;  // Total traded quote asset volume
}

interface BinanceKlineData {
  e: string;  // Event type = 'kline'
  E: number;  // Event time
  s: string;  // Symbol
  k: {
    t: number;  // Kline start time
    T: number;  // Kline close time
    s: string;  // Symbol
    i: string;  // Interval
    o: string;  // Open price
    c: string;  // Close price
    h: string;  // High price
    l: string;  // Low price
    v: string;  // Base asset volume
    x: boolean; // Is this kline closed?
  };
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
  private pendingSubscriptions = new Set<string>(); // Track pending subscriptions
  private lastSubscriptionTime = 0;
  private subscriptionQueue: string[] = [];
  private subscriptionTimer: number | null = null;
  private connectionMutex = false; // Prevent race conditions
  private resubscriptionInProgress = false; // Prevent duplicate resubscription
  
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
      if (this.connectionMutex) {
        console.log('Connection attempt already in progress');
        resolve();
        return;
      }
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      this.connectionMutex = true;

      this.onStatusChange?.('connecting');
      
      // Use single connection endpoint that allows dynamic subscriptions
      const url = `${this.baseUrl}/ws`;
      
      console.log(`Connecting to Binance WebSocket: ${url}`);
      
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('✅ Binance WebSocket connected successfully!');
          this.isConnected = true;
          this.connectionMutex = false;
          this.onStatusChange?.('connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          
          // Record connection in health monitor
          wsHealthMonitor.onConnect();
          
          // Wait for connection to stabilize, then resubscribe (with race condition protection)
          setTimeout(() => {
            if (this.resubscriptionInProgress) {
              console.log('Resubscription already in progress, skipping');
              return;
            }
            
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
              console.log('WebSocket not ready for subscriptions yet');
              return;
            }
            
            this.resubscriptionInProgress = true;
            
            // Resubscribe to all existing subscriptions
            console.log('Resubscribing to:', Array.from(this.subscriptions.entries()));
            
            // Queue all subscriptions for batched sending
            this.subscriptions.forEach((streamTypes, symbol) => {
              streamTypes.forEach(stream => {
                const streamName = this.mapStreamName(stream as BinanceStream);
                const streamKey = `${symbol}@${streamName}`;
                this.queueSubscription(streamKey);
              });
            });
            
            console.log(`📋 Queued ${this.subscriptionQueue.length} streams for resubscription`);
            
            // Reset flag after a delay to allow for processing
            setTimeout(() => {
              this.resubscriptionInProgress = false;
            }, 5000);
          }, 1000); // Wait 1 second for connection to stabilize
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          // Record message in health monitor
          wsHealthMonitor.onMessage();
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('Binance WebSocket error:', error);
          this.connectionMutex = false;
          this.onStatusChange?.('error');
          this.onError?.(new Error('WebSocket connection error'));
          
          // Record error in health monitor
          wsHealthMonitor.onError(error.toString());
          
          // Don't reject if already resolved
          if (!this.isConnected) {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          console.log(`Binance WebSocket closed: Code ${event.code}`);
          this.isConnected = false;
          this.onStatusChange?.('disconnected');
          this.stopPingInterval();
          
          // Record disconnection in health monitor
          wsHealthMonitor.onDisconnect();
          
          // Auto-reconnect if not manual close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('Failed to create Binance WebSocket:', error);
        this.connectionMutex = false;
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
    
    // Check if already subscribed
    const existingStreams = this.subscriptions.get(formattedSymbol)!;
    if (existingStreams.has(stream)) {
      console.log(`Already subscribed to ${formattedSymbol}@${stream}`);
      return true;
    }
    
    existingStreams.add(stream);
    
    // If connected, queue the subscription
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const streamName = this.mapStreamName(stream);
      const streamKey = `${formattedSymbol}@${streamName}`;
      
      // Check if already pending
      if (this.pendingSubscriptions.has(streamKey)) {
        console.log(`Already pending: ${streamKey}`);
        return true;
      }
      
      // Add to queue instead of sending immediately
      this.queueSubscription(streamKey);
    }
    
    return true;
  }
  
  /**
   * Map stream type to Binance stream name
   */
  private mapStreamName(stream: BinanceStream): string {
    switch(stream) {
      case 'ticker': return 'ticker';
      case 'kline_15m': return 'kline_15m';
      case 'kline_1h': return 'kline_1h';
      default: return stream;
    }
  }
  
  /**
   * Queue subscription for batched sending
   */
  private queueSubscription(streamKey: string): void {
    if (!this.subscriptionQueue.includes(streamKey)) {
      this.subscriptionQueue.push(streamKey);
      this.pendingSubscriptions.add(streamKey);
    }
    
    // Clear existing timer
    if (this.subscriptionTimer) {
      clearTimeout(this.subscriptionTimer);
    }
    
    // Set timer to batch send after 100ms
    this.subscriptionTimer = window.setTimeout(() => {
      this.sendBatchedSubscriptions();
    }, 100);
  }
  
  /**
   * Send all queued subscriptions in a single message
   */
  private sendBatchedSubscriptions(): void {
    if (this.subscriptionQueue.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Enhanced rate limit: max 3 subscription messages per second (more conservative)
    const now = Date.now();
    const timeSinceLastSub = now - this.lastSubscriptionTime;
    if (timeSinceLastSub < 350) { // 350ms = ~3 per second (safer than 5/sec)
      // Reschedule with jitter to avoid thundering herd
      const jitter = Math.random() * 100; // 0-100ms jitter
      this.subscriptionTimer = window.setTimeout(() => {
        this.sendBatchedSubscriptions();
      }, (350 - timeSinceLastSub) + jitter);
      return;
    }
    
    // Send batch subscription
    const streams = [...this.subscriptionQueue];
    const subMessage = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now()
    };
    
    try {
      this.ws.send(JSON.stringify(subMessage));
      console.log(`📡 Batch subscribing to ${streams.length} streams:`, streams);
      this.lastSubscriptionTime = now;
      
      // Clear queue and pending
      this.subscriptionQueue = [];
      streams.forEach(s => this.pendingSubscriptions.delete(s));
    } catch (error) {
      console.error('Failed to send batch subscription:', error);
    }
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
   * Force reconnection with rate limiting
   */
  public async forceReconnect(): Promise<void> {
    // Rate limit manual reconnections
    const now = Date.now();
    if (this.lastReconnectTime && now - this.lastReconnectTime < 5000) {
      console.log('Reconnection rate limited. Please wait 5 seconds between attempts.');
      return;
    }
    
    this.lastReconnectTime = now;
    console.log('Forcing WebSocket reconnection...');
    this.disconnect();
    this.reconnectAttempts = 0;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before reconnecting
    await this.connect();
  }
  
  private lastReconnectTime?: number;
  
  /**
   * Get WebSocket health metrics
   */
  public getHealthMetrics() {
    return wsHealthMonitor.getMetrics();
  }

  /**
   * Get WebSocket health status
   */
  public getHealthStatus() {
    return wsHealthMonitor.getHealthStatus();
  }

  /**
   * Get WebSocket health report
   */
  public getHealthReport() {
    return wsHealthMonitor.getHealthReport();
  }
  
  /**
   * Resubscribe individually as fallback
   */
  private resubscribeIndividually(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not ready for individual subscriptions');
      return;
    }
    
    let delay = 0;
    this.subscriptions.forEach((streamTypes, symbol) => {
      streamTypes.forEach(stream => {
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const streamName = stream === 'ticker' ? 'ticker' : 
                             stream === 'kline_15m' ? 'kline_15m' : 
                             stream === 'kline_1h' ? 'kline_1h' : stream;
            
            const subMessage = {
              method: 'SUBSCRIBE',
              params: [`${symbol}@${streamName}`],
              id: Date.now()
            };
            
            try {
              this.ws.send(JSON.stringify(subMessage));
              console.log(`📡 Individually subscribed to ${symbol}@${streamName}`);
            } catch (error) {
              console.error(`Failed to subscribe to ${symbol}@${streamName}:`, error);
            }
          }
        }, delay);
        delay += 50; // Stagger subscriptions by 50ms
      });
    });
  }

  /**
   * Handle incoming messages with comprehensive error handling
   */
  private handleMessage(data: string): void {
    try {
      // Validate message size to prevent DoS
      if (data.length > 50000) { // 50KB limit
        console.warn('Received oversized WebSocket message, ignoring');
        return;
      }
      
      const message = JSON.parse(data);
      
      // Debug: Log message types (but not full trade data to avoid spam)
      if (message.e && message.s === 'BTCUSDT') {
        console.log(`📥 BTCUSDT ${message.e} message:`, {
          event: message.e,
          symbol: message.s,
          priceChange: message.p,
          priceChangePercent: message.P,
          lastPrice: message.c
        });
      }
      
      // Handle subscription confirmations
      if (message.result === null && message.id) {
        console.log('✅ Subscription confirmed for request:', message.id);
        return;
      }
      
      // Handle errors
      if (message.error) {
        console.error('Binance WebSocket error:', message.error);
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
      } else {
        // Unknown message format - log it to debug
        console.log('Unknown Binance message format:', message);
      }
      
    } catch (error) {
      console.error('Error parsing Binance message:', error);
      
      // Enhanced error reporting for debugging
      if (error instanceof SyntaxError) {
        console.error('Invalid JSON received from Binance WebSocket:', data.substring(0, 200));
      } else {
        console.error('Unexpected error in message handling:', error);
      }
      
      // Implement circuit breaker pattern
      this.handleMessageError(error);
      
      // Record error in health monitor
      wsHealthMonitor.onError(error instanceof Error ? error.message : String(error));
    }
  }
  
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly MAX_ERRORS_PER_MINUTE = 10;
  
  /**
   * Handle message processing errors with circuit breaker
   */
  private handleMessageError(error: any): void {
    const now = Date.now();
    
    // Reset error count if more than a minute has passed
    if (now - this.lastErrorTime > 60000) {
      this.errorCount = 0;
    }
    
    this.errorCount++;
    this.lastErrorTime = now;
    
    // Circuit breaker: if too many errors, force reconnection
    if (this.errorCount >= this.MAX_ERRORS_PER_MINUTE) {
      console.error(`Too many WebSocket errors (${this.errorCount}), forcing reconnection`);
      this.errorCount = 0;
      this.forceReconnect();
    }
  }

  /**
   * Process stream data based on type
   */
  private processStreamData(stream: string, data: any): void {
    // ONLY process 24hrTicker, ignore everything else
    if (data.e === '24hrTicker' || stream.includes('@ticker')) {
      this.processTicker(data as BinanceTickerData);
    } else {
      // Log what we're skipping
      if (data.s === 'BTCUSDT') {
        console.log(`⏭️ Skipping ${data.e || stream} for BTCUSDT`);
      }
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
    
    // Don't log every trade as it's too verbose
    // console.log(`💹 ${trade.s} Trade: $${parseFloat(trade.p).toFixed(2)}`);
    
    this.onPriceUpdate?.(marketPrice);
  }

  /**
   * Process ticker data (24hrTicker)
   */
  private processTicker(ticker: BinanceTickerData): void {
    const price = parseFloat(ticker.c);
    const priceChange = parseFloat(ticker.p);
    const priceChangePercent = parseFloat(ticker.P);
    const open = parseFloat(ticker.o);
    const high = parseFloat(ticker.h);
    const low = parseFloat(ticker.l);
    
    // Validate the percentage is reasonable (between -100% and 1000%)
    if (priceChangePercent < -100 || priceChangePercent > 1000) {
      console.warn(`⚠️ Suspicious percentage for ${ticker.s}: ${priceChangePercent}%`);
      return;
    }
    
    // Debug: Log raw ticker data for BTCUSDT
    if (ticker.s === 'BTCUSDT') {
      console.log(`🔍 BTCUSDT ticker data:`, {
        priceChange: ticker.p,
        priceChangePercent: ticker.P,
        parsedPercent: priceChangePercent,
        lastPrice: ticker.c,
        openPrice: ticker.o,
        high: ticker.h,
        low: ticker.l
      });
    }
    
    const marketPrice: MarketPrice = {
      symbol: ticker.s,
      price: price,
      change: priceChange,
      changePercent: priceChangePercent,
      change24h: priceChangePercent, // This is the actual 24h change from Binance
      open24h: open,  // 24hr open price
      high24h: high,  // 24hr high price
      low24h: low,    // 24hr low price
      volume: parseFloat(ticker.v),
      timestamp: ticker.E || Date.now(),
      source: 'ws-ticker' // Track the source
    } as any;
    
    if (ticker.s === 'BTCUSDT') {
      console.log(`📊 BTCUSDT 24hr Ticker - Price: $${price.toFixed(2)}, Open: $${open.toFixed(2)}, High: $${high.toFixed(2)}, Low: $${low.toFixed(2)}, 24h Change: ${priceChangePercent.toFixed(2)}%`);
    }
    
    this.onPriceUpdate?.(marketPrice);
  }

  /**
   * Process mini ticker data (24hr stats)
   */
  private processMiniTicker(ticker: BinanceMiniTickerData): void {
    const open = parseFloat(ticker.o);
    const close = parseFloat(ticker.c);
    const priceChange = close - open;
    const priceChangePercent = open > 0 ? ((close - open) / open) * 100 : 0;
    
    const marketPrice: MarketPrice = {
      symbol: ticker.s,
      price: close,
      change: priceChange,
      changePercent: priceChangePercent,
      change24h: priceChangePercent, // This is the 24h change
      volume: parseFloat(ticker.v),
      timestamp: ticker.E,
    };
    
    console.log(`📈 ${ticker.s} 24hr Stats - Price: $${close.toFixed(2)}, Open: $${open.toFixed(2)}, 24h Change: ${priceChangePercent.toFixed(2)}%`);
    
    this.onPriceUpdate?.(marketPrice);
  }

  /**
   * Process kline data for interval-based percentage changes
   */
  private processKline(kline: BinanceKlineData): void {
    if (!kline.k.x) {
      // Only process closed klines
      return;
    }
    
    const interval = kline.k.i;
    const symbol = kline.s;
    const open = parseFloat(kline.k.o);
    const close = parseFloat(kline.k.c);
    const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;
    
    // Store kline data for percentage calculations
    if (!this.klineData) {
      this.klineData = new Map();
    }
    
    if (!this.klineData.has(symbol)) {
      this.klineData.set(symbol, {});
    }
    
    this.klineData.get(symbol)[interval] = {
      open: open,
      close: close,
      change: changePercent,
      timestamp: kline.E
    };
    
    // Send update with interval-specific change ONLY
    // Don't update changePercent or change24h from kline data
    const changeKey = interval === '15m' ? 'change15m' : interval === '1h' ? 'change1h' : null;
    if (changeKey) {
      const marketPrice: MarketPrice = {
        symbol: symbol,
        price: close,
        // Don't set change or changePercent - let ticker handle that
        // change: close - open,
        // changePercent: changePercent,
        [changeKey]: changePercent,
        timestamp: kline.E,
        source: `ws-kline-${interval}` // Track the source
      } as any;
      
      console.log(`📈 ${symbol} ${interval} Kline - ${changeKey}: ${changePercent.toFixed(2)}%`);
      this.onPriceUpdate?.(marketPrice);
    }
  }
  
  private klineData: Map<string, any> | undefined;

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
   * Schedule reconnection attempt with capped exponential backoff and network awareness
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    // Capped exponential backoff: 2s, 4s, 8s, 16s, 30s (max), with jitter
    const baseDelay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const jitter = Math.random() * 1000; // Add 0-1s jitter
    const delay = baseDelay + jitter;
    
    console.log(`Scheduling Binance reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms`);
    console.log('Will resubscribe to:', Array.from(this.subscriptions.keys()));
    
    // Check network connectivity before attempting reconnection
    const attemptReconnect = async () => {
      try {
        // Simple connectivity check
        const isOnline = navigator.onLine;
        if (!isOnline) {
          console.log('Device appears offline, waiting...');
          // If offline, wait another 5 seconds and try again
          setTimeout(attemptReconnect, 5000);
          return;
        }
        
        // Record reconnection attempt in health monitor
        wsHealthMonitor.onReconnect();
        await this.connect();
      } catch (error) {
        console.error('Binance reconnect failed:', error);
        // If reconnect fails, try again
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
          this.onStatusChange?.('error');
        }
      }
    };
    
    setTimeout(attemptReconnect, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    // Monitor connection (but don't send pings - Binance doesn't require them)
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Connection is alive, no action needed
        // Binance sends their own pings, we don't need to send any
      } else if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.log('Binance WebSocket connection lost, will reconnect...');
        this.isConnected = false;
        this.onStatusChange?.('disconnected');
        this.stopPingInterval(); // Stop this interval to prevent multiple reconnection attempts
        // Trigger reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
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