import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MarketPrice, OHLCData, TradingSymbol, MarketData } from '../types/trading';
import { WSConnectionStatus } from '../services/WebSocketManager';
import { DEFAULT_SYMBOLS } from '../utils/constants';
import { binanceHistoricalService } from '../services/BinanceHistoricalService';

interface MarketStore extends MarketData {
  // Actions
  updatePrice: (price: MarketPrice) => void;
  updateChartData: (symbol: string, data: OHLCData[]) => void;
  addChartData: (symbol: string, data: OHLCData) => void;
  setConnectionStatus: (status: WSConnectionStatus) => void;
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  clearAllData: () => void;
  
  // Historical data actions
  updateHistoricalData: (symbol: string) => Promise<void>;
  batchUpdateHistoricalData: (symbols: string[]) => Promise<void>;
  
  // Computed values
  getPrice: (symbol: string) => MarketPrice | undefined;
  getChartData: (symbol: string) => OHLCData[] | undefined;
  isSymbolSubscribed: (symbol: string) => boolean;
  
  // Symbol management
  availableSymbols: TradingSymbol[];
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  
  // Historical data state
  historicalDataLoading: Set<string>;
  lastHistoricalUpdate: Map<string, number>;
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
    historicalDataLoading: new Set<string>(),
    lastHistoricalUpdate: new Map<string, number>(),
    
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
        
        // Always update price, volume and OHLC data
        mergedPrice.symbol = price.symbol;
        mergedPrice.price = price.price;
        if (price.volume !== undefined) mergedPrice.volume = price.volume;
        if (price.timestamp !== undefined) mergedPrice.timestamp = price.timestamp;
        if (price.open24h !== undefined) mergedPrice.open24h = price.open24h;
        if (price.high24h !== undefined) mergedPrice.high24h = price.high24h;
        if (price.low24h !== undefined) mergedPrice.low24h = price.low24h;
        
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
        if (price.change7d !== undefined) mergedPrice.change7d = price.change7d;
        if (price.change30d !== undefined) mergedPrice.change30d = price.change30d;
        if (price.change90d !== undefined) mergedPrice.change90d = price.change90d;
        if (price.change1y !== undefined) mergedPrice.change1y = price.change1y;
        
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
        historicalDataLoading: new Set(),
        lastHistoricalUpdate: new Map(),
      });
    },

    // Historical data actions
    updateHistoricalData: async (symbol: string) => {
      const state = get();
      
      // Check if already loading or recently updated (avoid spam)
      if (state.historicalDataLoading.has(symbol)) {
        console.log(`Historical data for ${symbol} already loading`);
        return;
      }
      
      const lastUpdate = state.lastHistoricalUpdate.get(symbol);
      const now = Date.now();
      const MIN_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes
      
      if (lastUpdate && (now - lastUpdate) < MIN_UPDATE_INTERVAL) {
        console.log(`Historical data for ${symbol} updated recently, skipping`);
        return;
      }
      
      if (!binanceHistoricalService.isSymbolSupported(symbol)) {
        console.log(`Symbol ${symbol} not supported for historical data`);
        return;
      }
      
      // Mark as loading
      set((state) => {
        const newLoading = new Set(state.historicalDataLoading);
        newLoading.add(symbol);
        return { historicalDataLoading: newLoading };
      });
      
      try {
        console.log(`Fetching historical data for ${symbol}...`);
        const currentPrice = state.prices.get(symbol);
        
        if (!currentPrice) {
          console.log(`No current price available for ${symbol}, skipping historical update`);
          return;
        }
        
        const historicalUpdate = await binanceHistoricalService.updateHistoricalChanges(
          symbol, 
          currentPrice.price
        );
        
        if (historicalUpdate) {
          // Update the price with historical data
          const existingPrice = state.prices.get(symbol);
          if (existingPrice) {
            const updatedPrice = {
              ...existingPrice,
              change7d: historicalUpdate.change7d,
              change30d: historicalUpdate.change30d,
              change90d: historicalUpdate.change90d,
              change1y: historicalUpdate.change1y,
              timestamp: now,
            };
            
            set((state) => {
              const newPrices = new Map(state.prices);
              newPrices.set(symbol, updatedPrice);
              const newLastUpdate = new Map(state.lastHistoricalUpdate);
              newLastUpdate.set(symbol, now);
              
              return {
                prices: newPrices,
                lastHistoricalUpdate: newLastUpdate,
              };
            });
            
            console.log(`Updated historical data for ${symbol}:`, {
              change7d: historicalUpdate.change7d?.toFixed(2),
              change30d: historicalUpdate.change30d?.toFixed(2),
              change90d: historicalUpdate.change90d?.toFixed(2),
              change1y: historicalUpdate.change1y?.toFixed(2),
            });
          }
        }
      } catch (error) {
        console.error(`Error updating historical data for ${symbol}:`, error);
      } finally {
        // Mark as no longer loading
        set((state) => {
          const newLoading = new Set(state.historicalDataLoading);
          newLoading.delete(symbol);
          return { historicalDataLoading: newLoading };
        });
      }
    },

    batchUpdateHistoricalData: async (symbols: string[]) => {
      const state = get();
      const now = Date.now();
      const MIN_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes
      
      // Filter symbols that need updating
      const symbolsToUpdate = symbols.filter(symbol => {
        if (state.historicalDataLoading.has(symbol)) {
          return false;
        }
        
        if (!binanceHistoricalService.isSymbolSupported(symbol)) {
          return false;
        }
        
        const lastUpdate = state.lastHistoricalUpdate.get(symbol);
        if (lastUpdate && (now - lastUpdate) < MIN_UPDATE_INTERVAL) {
          return false;
        }
        
        return state.prices.has(symbol); // Only update if we have current price data
      });
      
      if (symbolsToUpdate.length === 0) {
        console.log('No symbols need historical data updates');
        return;
      }
      
      console.log(`Batch updating historical data for ${symbolsToUpdate.length} symbols`);
      
      // Mark all as loading
      set((state) => {
        const newLoading = new Set(state.historicalDataLoading);
        symbolsToUpdate.forEach(symbol => newLoading.add(symbol));
        return { historicalDataLoading: newLoading };
      });
      
      try {
        const results = await binanceHistoricalService.batchUpdateHistoricalData(symbolsToUpdate);
        
        if (Object.keys(results).length > 0) {
          set((state) => {
            const newPrices = new Map(state.prices);
            const newLastUpdate = new Map(state.lastHistoricalUpdate);
            
            Object.entries(results).forEach(([symbol, historicalUpdate]) => {
              const existingPrice = newPrices.get(symbol);
              if (existingPrice) {
                const updatedPrice = {
                  ...existingPrice,
                  change7d: historicalUpdate.change7d,
                  change30d: historicalUpdate.change30d,
                  change90d: historicalUpdate.change90d,
                  change1y: historicalUpdate.change1y,
                  timestamp: now,
                };
                
                newPrices.set(symbol, updatedPrice);
                newLastUpdate.set(symbol, now);
              }
            });
            
            return {
              prices: newPrices,
              lastHistoricalUpdate: newLastUpdate,
            };
          });
          
          console.log(`Batch updated historical data for ${Object.keys(results).length} symbols`);
        }
      } catch (error) {
        console.error('Error in batch historical data update:', error);
      } finally {
        // Mark all as no longer loading
        set((state) => {
          const newLoading = new Set(state.historicalDataLoading);
          symbolsToUpdate.forEach(symbol => newLoading.delete(symbol));
          return { historicalDataLoading: newLoading };
        });
      }
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