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
      set((state) => {
        const newPrices = new Map(state.prices);
        
        // Get the previous price data
        const previousPrice = newPrices.get(price.symbol);
        
        // Merge the new price with existing data, preserving 24h change if not provided
        const mergedPrice = {
          ...previousPrice, // Keep existing data
          ...price, // Override with new data
        };
        
        // Only calculate instant change if previous price exists and no changePercent provided
        if (previousPrice && price.changePercent === 0) {
          mergedPrice.change = price.price - previousPrice.price;
          // Don't override changePercent if we have change24h
          if (!mergedPrice.change24h) {
            mergedPrice.changePercent = ((mergedPrice.change / previousPrice.price) * 100);
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