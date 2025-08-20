/**
 * Stock Data Service
 * Uses REST API polling since free WebSocket for stocks is limited
 */

import { API_CONFIG } from '../utils/constants';
import { MarketPrice } from '../types/trading';
import { useMarketStore } from '../stores/marketStore';

// Popular stocks to track
export const DEFAULT_STOCK_SYMBOLS = [
  'AAPL',  // Apple
  'MSFT',  // Microsoft
  'GOOGL', // Google
  'AMZN',  // Amazon
  'TSLA',  // Tesla
  'META',  // Meta (Facebook)
  'NVDA',  // NVIDIA
  'SPY',   // S&P 500 ETF
];

class StockDataService {
  private pollInterval: number | null = null;
  private isPolling = false;
  private lastPrices = new Map<string, number>();
  
  /**
   * Start polling for stock prices
   */
  public startPolling(symbols: string[] = DEFAULT_STOCK_SYMBOLS): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log('Starting stock price polling for:', symbols);
    
    // Initial fetch
    this.fetchStockPrices(symbols);
    
    // Poll every 30 seconds (to respect rate limits)
    this.pollInterval = window.setInterval(() => {
      this.fetchStockPrices(symbols);
    }, 30000); // 30 seconds
  }
  
  /**
   * Stop polling
   */
  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('Stopped stock price polling');
  }
  
  /**
   * Fetch stock prices from Finnhub REST API
   */
  private async fetchStockPrices(symbols: string[]): Promise<void> {
    const apiKey = API_CONFIG.FINNHUB.API_KEY;
    
    if (!apiKey) {
      console.error('Finnhub API key not found');
      return;
    }
    
    // Fetch prices for each symbol
    const promises = symbols.map(async (symbol) => {
      try {
        const url = `${API_CONFIG.FINNHUB.BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.c) { // c = current price
          const previousPrice = this.lastPrices.get(symbol) || data.c;
          const change = data.c - data.pc; // Use previous close for accurate change
          const changePercent = data.pc !== 0 ? (change / data.pc) * 100 : 0;
          
          // DISABLED PriceHistoryService - causes percentage issues
          // priceHistoryService.updatePrice(symbol, data.c);
          
          // Get time-based changes - DISABLED
          // const changes = priceHistoryService.getChanges(symbol);
          
          // Update store with price data WITHOUT calculated changes
          const marketPrice: MarketPrice = {
            symbol: symbol,
            price: data.c,
            change: change,
            changePercent: changePercent,
            open24h: data.o || data.c,  // o = open price
            high24h: data.h || data.c,  // h = high price  
            low24h: data.l || data.c,   // l = low price
            volume: data.v || 0,
            timestamp: Date.now(),
            source: 'stock-finnhub' // Add source tag
            // ...changes - DISABLED to prevent percentage overwrites
          } as any;
          
          // Update market store
          useMarketStore.getState().updatePrice(marketPrice);
          useMarketStore.getState().addSubscription(symbol);
          
          // Store for next comparison
          this.lastPrices.set(symbol, data.c);
          
          return { symbol, success: true };
        }
        
        return { symbol, success: false, error: 'No price data' };
        
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
        return { symbol, success: false, error };
      }
    });
    
    // Wait for all fetches to complete
    const results = await Promise.all(promises);
    
    // Log summary
    const successful = results.filter(r => r.success).length;
    console.log(`Stock prices updated: ${successful}/${symbols.length} successful`);
  }
  
  /**
   * Check if service is running
   */
  public isRunning(): boolean {
    return this.isPolling;
  }
}

// Singleton instance
export const stockDataService = new StockDataService();