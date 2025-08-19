import { wsManager } from './WebSocketManager';
import { useMarketStore } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { MarketPrice, OHLCData } from '../types/trading';
import { API_CONFIG } from '../utils/constants';

class MarketDataService {
  private isInitialized = false;
  private priceUpdateInterval: number | null = null;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Set up WebSocket message handlers
    this.setupMessageHandlers();
    
    // Connect to WebSocket
    await wsManager.connect();
    
    // Start periodic portfolio updates
    this.startPortfolioUpdates();
    
    this.isInitialized = true;
    console.log('MarketDataService initialized');
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    // Stop portfolio updates
    this.stopPortfolioUpdates();
    
    // Disconnect WebSocket
    wsManager.disconnect();
    
    this.isInitialized = false;
    console.log('MarketDataService shutdown');
  }

  public subscribeToSymbol(symbol: string): boolean {
    if (!wsManager.isConnected()) {
      console.warn('WebSocket not connected, cannot subscribe to:', symbol);
      return false;
    }

    const success = wsManager.subscribe(symbol);
    if (success) {
      useMarketStore.getState().addSubscription(symbol);
    }
    return success;
  }

  public unsubscribeFromSymbol(symbol: string): boolean {
    const success = wsManager.unsubscribe(symbol);
    if (success) {
      useMarketStore.getState().removeSubscription(symbol);
    }
    return success;
  }

  public async fetchHistoricalData(
    symbol: string, 
    interval: string = 'D',
    from: number = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
  ): Promise<OHLCData[]> {
    try {
      const to = Date.now();
      const resolution = this.getResolutionFromInterval(interval);
      
      const url = `${API_CONFIG.FINNHUB.BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${Math.floor(from / 1000)}&to=${Math.floor(to / 1000)}&token=${API_CONFIG.FINNHUB.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.s === 'ok' && data.t && data.o && data.h && data.l && data.c) {
        const ohlcData: OHLCData[] = data.t.map((time: number, index: number) => ({
          time: time * 1000, // Convert to milliseconds
          open: data.o[index],
          high: data.h[index],
          low: data.l[index],
          close: data.c[index],
          volume: data.v ? data.v[index] : undefined,
        }));
        
        // Update store with historical data
        useMarketStore.getState().updateChartData(symbol, ohlcData);
        
        return ohlcData;
      } else {
        console.warn('No historical data available for:', symbol, data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching historical data for:', symbol, error);
      return [];
    }
  }

  private setupMessageHandlers(): void {
    // Handle connection status changes
    wsManager.setStatusChangeHandler((status) => {
      useMarketStore.getState().setConnectionStatus(status);
    });

    // Handle price updates
    wsManager.addMessageHandler('price', (marketPrice: MarketPrice) => {
      useMarketStore.getState().updatePrice(marketPrice);
    });

    // Handle trade messages from Finnhub
    wsManager.addMessageHandler('trade', (message: any) => {
      if (message.data && Array.isArray(message.data)) {
        message.data.forEach((trade: any) => {
          const marketPrice: MarketPrice = {
            symbol: trade.s,
            price: trade.p,
            change: 0, // Will be calculated in store
            changePercent: 0, // Will be calculated in store
            volume: trade.v,
            timestamp: trade.t,
          };
          
          useMarketStore.getState().updatePrice(marketPrice);
        });
      }
    });
  }

  private startPortfolioUpdates(): void {
    // Update portfolio values every 5 seconds
    this.priceUpdateInterval = window.setInterval(() => {
      const marketStore = useMarketStore.getState();
      const portfolioStore = usePortfolioStore.getState();
      
      // Create a map of current prices
      const priceMap = new Map<string, number>();
      marketStore.prices.forEach((priceData, symbol) => {
        priceMap.set(symbol, priceData.price);
      });
      
      // Update portfolio with current prices
      portfolioStore.updateTotalValue(priceMap);
    }, 5000);
  }

  private stopPortfolioUpdates(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
  }

  private getResolutionFromInterval(interval: string): string {
    const resolutionMap: Record<string, string> = {
      '1': '1',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
      'D': 'D',
      'W': 'W',
      'M': 'M',
    };
    
    return resolutionMap[interval] || 'D';
  }

  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  public getConnectionStatus() {
    return wsManager.getConnectionStatus();
  }

  public getActiveSubscriptions() {
    return wsManager.getSubscriptions();
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();

// Auto-initialize when imported (can be made optional)
export const initializeMarketData = () => marketDataService.initialize();
export const shutdownMarketData = () => marketDataService.shutdown();