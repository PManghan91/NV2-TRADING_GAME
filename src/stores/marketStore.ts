import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MarketPrice, OHLCData, TradingSymbol, MarketData } from '../types/trading';
import { WSConnectionStatus } from '../services/WebSocketManager';
import { DEFAULT_SYMBOLS } from '../utils/constants';

interface MarketStore extends MarketData {
  // Actions
  updatePrice: (price: MarketPrice) => void;
  updateChartData: (symbol: string, data: OHLCData[]) => void;
  addChartData: (symbol: string, data: OHLCData) => void;
  setConnectionStatus: (status: WSConnectionStatus) => void;
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  clearAllData: () => void;
  
  // Computed values
  getPrice: (symbol: string) => MarketPrice | undefined;
  getChartData: (symbol: string) => OHLCData[] | undefined;
  isSymbolSubscribed: (symbol: string) => boolean;
  
  // Symbol management
  availableSymbols: TradingSymbol[];
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

export const useMarketStore = create<MarketStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    prices: new Map<string, MarketPrice>(),
    charts: new Map<string, OHLCData[]>(),
    subscriptions: new Set<string>(),
    connectionStatus: 'disconnected',
    availableSymbols: DEFAULT_SYMBOLS,
    watchlist: DEFAULT_SYMBOLS.slice(0, 8).map(s => s.symbol), // Default watchlist
    
    // Actions
    updatePrice: (price: MarketPrice) => {
      // AGGRESSIVE LOGGING TO CATCH BAD UPDATES
      const source = (price as any).source || 'UNKNOWN';
      if (price.changePercent === 0 || price.change24h === 0 || 
          (price.changePercent !== undefined && Math.abs(price.changePercent) < 0.1 && Math.abs(price.changePercent) > 0)) {
        console.warn(`⚠️ SUSPICIOUS UPDATE for ${price.symbol}:`, {
          source,
          changePercent: price.changePercent,
          change24h: price.change24h,
          price: price.price,
          timestamp: new Date().toISOString()
        });
        console.trace('Stack trace for suspicious update');
      }
      set((state) => {
        const newPrices = new Map(state.prices);
        
        // Get the previous price data
        const previousPrice = newPrices.get(price.symbol);
        
        if (!previousPrice) {
          // No previous price, use the new price as-is
          newPrices.set(price.symbol, price);
          return { prices: newPrices };
        }
        
        // Smart merge: be selective about what we merge
        const mergedPrice = { ...previousPrice };
        
        // Always update price and volume
        mergedPrice.symbol = price.symbol;
        mergedPrice.price = price.price;
        if (price.volume !== undefined) mergedPrice.volume = price.volume;
        if (price.timestamp !== undefined) mergedPrice.timestamp = price.timestamp;
        
        // Only update percentage changes from authoritative sources (ticker)
        const source = (price as any).source;
        if (source === 'ws-ticker' || source === 'rest-initial' || source === 'rest-refresh' || source === 'rest-symbol-change') {
          // These sources have authoritative 24h data
          if (price.change !== undefined) mergedPrice.change = price.change;
          if (price.changePercent !== undefined) mergedPrice.changePercent = price.changePercent;
          if (price.change24h !== undefined) mergedPrice.change24h = price.change24h;
        }
        
        // Update interval-specific changes from kline sources
        if (price.change15m !== undefined) mergedPrice.change15m = price.change15m;
        if (price.change1h !== undefined) mergedPrice.change1h = price.change1h;
        
        // Debug log to see what values we're getting
        if (price.symbol === 'BTCUSDT') {
          console.log('BTCUSDT update:', {
            source: (price as any).source || 'unknown',
            new_change24h: price.change24h,
            new_changePercent: price.changePercent,
            prev_change24h: previousPrice.change24h,
            prev_changePercent: previousPrice.changePercent,
            final_change24h: mergedPrice.change24h,
            final_changePercent: mergedPrice.changePercent,
            timestamp: new Date().toISOString()
          });
          
          // Log stack trace if we're getting 0
          if (price.change24h === 0 || price.changePercent === 0) {
            console.trace('Zero percentage detected from:', (price as any).source);
          }
        }
        
        newPrices.set(price.symbol, mergedPrice);
        
        return {
          prices: newPrices,
        };
      });
    },

    updateChartData: (symbol: string, data: OHLCData[]) => {
      set((state) => {
        const newCharts = new Map(state.charts);
        newCharts.set(symbol, [...data].sort((a, b) => a.time - b.time));
        return {
          charts: newCharts,
        };
      });
    },

    addChartData: (symbol: string, data: OHLCData) => {
      set((state) => {
        const newCharts = new Map(state.charts);
        const existingData = newCharts.get(symbol) || [];
        
        // Check if this data point already exists
        const existingIndex = existingData.findIndex(d => d.time === data.time);
        
        if (existingIndex >= 0) {
          // Update existing data point
          existingData[existingIndex] = data;
        } else {
          // Add new data point and keep sorted
          existingData.push(data);
          existingData.sort((a, b) => a.time - b.time);
          
          // Keep only last 1000 data points for performance
          if (existingData.length > 1000) {
            existingData.splice(0, existingData.length - 1000);
          }
        }
        
        newCharts.set(symbol, [...existingData]);
        return {
          charts: newCharts,
        };
      });
    },

    setConnectionStatus: (status: WSConnectionStatus) => {
      set({ connectionStatus: status });
    },

    addSubscription: (symbol: string) => {
      set((state) => {
        const newSubscriptions = new Set(state.subscriptions);
        newSubscriptions.add(symbol);
        return { subscriptions: newSubscriptions };
      });
    },

    removeSubscription: (symbol: string) => {
      set((state) => {
        const newSubscriptions = new Set(state.subscriptions);
        newSubscriptions.delete(symbol);
        return {
          subscriptions: newSubscriptions,
        };
      });
    },

    clearAllData: () => {
      set({
        prices: new Map(),
        charts: new Map(),
        subscriptions: new Set(),
      });
    },

    // Computed values
    getPrice: (symbol: string) => {
      return get().prices.get(symbol);
    },

    getChartData: (symbol: string) => {
      return get().charts.get(symbol);
    },

    isSymbolSubscribed: (symbol: string) => {
      return get().subscriptions.has(symbol);
    },

    // Watchlist management
    addToWatchlist: (symbol: string) => {
      set((state) => {
        if (!state.watchlist.includes(symbol)) {
          return {
            watchlist: [...state.watchlist, symbol],
          };
        }
        return state;
      });
    },

    removeFromWatchlist: (symbol: string) => {
      set((state) => ({
        watchlist: state.watchlist.filter(s => s !== symbol),
      }));
    },
  }))
);

// Selector hooks for specific data
export const useConnectionStatus = () => useMarketStore(state => state.connectionStatus);
export const usePrice = (symbol: string) => useMarketStore(state => state.getPrice(symbol));
export const useChartData = (symbol: string) => useMarketStore(state => state.getChartData(symbol));
export const useWatchlist = () => useMarketStore(state => state.watchlist);
export const useSubscriptions = () => useMarketStore(state => state.subscriptions);