/**
 * Binance Historical Data Service
 * Fetches historical kline data for calculating accurate percentage changes
 * Uses Binance REST API with smart caching to avoid rate limits
 */

import { MarketPrice } from '../types/trading';

interface KlineData {
  openTime: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
}

interface HistoricalCache {
  [symbol: string]: {
    [period: string]: {
      data: KlineData[];
      lastUpdated: number;
      expires: number;
    }
  }
}

interface PeriodConfig {
  interval: string;
  limit: number;
  cacheDuration: number; // in milliseconds
}

export class BinanceHistoricalService {
  private readonly baseUrl = 'https://api.binance.com/api/v3';
  private cache: HistoricalCache = {};
  
  // Configuration for different time periods - updated with optimized ranges
  private readonly periodConfigs: { [key: string]: PeriodConfig } = {
    '7d': { interval: '1d', limit: 7, cacheDuration: 30 * 60 * 1000 }, // 30 minutes cache
    '30d': { interval: '1d', limit: 30, cacheDuration: 60 * 60 * 1000 }, // 1 hour cache
    '90d': { interval: '1d', limit: 90, cacheDuration: 2 * 60 * 60 * 1000 }, // 2 hours cache
    '1y': { interval: '1w', limit: 52, cacheDuration: 4 * 60 * 60 * 1000 }, // 4 hours cache
    // Additional optimized configurations
    '12h': { interval: '1m', limit: 720, cacheDuration: 1 * 60 * 1000 }, // 1 minute cache for 1m data
    '36h': { interval: '5m', limit: 432, cacheDuration: 2 * 60 * 1000 }, // 2 minutes cache for 5m data
    '72h': { interval: '15m', limit: 288, cacheDuration: 5 * 60 * 1000 }, // 5 minutes cache for 15m data
    '5d': { interval: '30m', limit: 240, cacheDuration: 10 * 60 * 1000 }, // 10 minutes cache for 30m data
    '15d': { interval: '1h', limit: 360, cacheDuration: 15 * 60 * 1000 }, // 15 minutes cache for 1h data
    '30d_4h': { interval: '4h', limit: 180, cacheDuration: 30 * 60 * 1000 }, // 30 minutes cache for 4h data
    '10y': { interval: '1w', limit: 520, cacheDuration: 4 * 60 * 60 * 1000 }, // 4 hours cache for weekly data
    '20y': { interval: '1M', limit: 240, cacheDuration: 8 * 60 * 60 * 1000 }, // 8 hours cache for monthly data
  };

  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 100; // 100ms between requests to respect rate limits

  /**
   * Fetch historical data for all supported periods for a symbol
   */
  public async fetchHistoricalData(symbol: string): Promise<{
    change7d?: number;
    change30d?: number;
    change90d?: number;
    change1y?: number;
  }> {
    try {
      const results = await Promise.allSettled([
        this.getPercentageChange(symbol, '7d'),
        this.getPercentageChange(symbol, '30d'),
        this.getPercentageChange(symbol, '90d'),
        this.getPercentageChange(symbol, '1y'),
      ]);

      const changes: any = {};
      
      if (results[0].status === 'fulfilled' && results[0].value !== null) {
        changes.change7d = results[0].value;
      }
      if (results[1].status === 'fulfilled' && results[1].value !== null) {
        changes.change30d = results[1].value;
      }
      if (results[2].status === 'fulfilled' && results[2].value !== null) {
        changes.change90d = results[2].value;
      }
      if (results[3].status === 'fulfilled' && results[3].value !== null) {
        changes.change1y = results[3].value;
      }

      return changes;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return {};
    }
  }

  /**
   * Fetch optimized chart data for specific intervals
   */
  public async fetchChartData(symbol: string, interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'): Promise<KlineData[] | null> {
    try {
      // Map interval to period config key
      const periodMap = {
        '1m': '12h',
        '5m': '36h', 
        '15m': '72h',
        '30m': '5d',
        '1h': '15d',
        '4h': '30d_4h',
        '1d': '1y',
        '1w': '10y',
        '1M': '20y'
      };

      const period = periodMap[interval];
      if (!period) {
        console.warn(`Unsupported interval: ${interval}`);
        return null;
      }

      return await this.getKlineData(symbol, period);
    } catch (error) {
      console.error(`Error fetching chart data for ${symbol} ${interval}:`, error);
      return null;
    }
  }

  /**
   * Get percentage change for a specific period
   */
  public async getPercentageChange(symbol: string, period: '7d' | '30d' | '90d' | '1y'): Promise<number | null> {
    try {
      const klineData = await this.getKlineData(symbol, period);
      if (!klineData || klineData.length === 0) {
        return null;
      }

      // Get the earliest and latest prices
      const oldestPrice = klineData[0].openPrice;
      const latestPrice = klineData[klineData.length - 1].closePrice;

      if (oldestPrice <= 0) {
        return null;
      }

      // Calculate percentage change
      const percentageChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;
      return percentageChange;
    } catch (error) {
      console.error(`Error calculating ${period} change for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get kline data with smart caching
   */
  private async getKlineData(symbol: string, period: string): Promise<KlineData[] | null> {
    const config = this.periodConfigs[period];
    if (!config) {
      console.error(`Unknown period: ${period}`);
      return null;
    }

    // Check cache first
    const cached = this.getCachedData(symbol, period);
    if (cached) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await this.fetchKlineDataFromAPI(symbol, config);
      if (data) {
        this.setCachedData(symbol, period, data, config.cacheDuration);
      }
      return data;
    } catch (error) {
      console.error(`Error fetching kline data for ${symbol} ${period}:`, error);
      return null;
    }
  }

  /**
   * Fetch kline data from Binance API with rate limiting
   */
  private async fetchKlineDataFromAPI(symbol: string, config: PeriodConfig): Promise<KlineData[] | null> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${config.interval}&limit=${config.limit}`;
          
          console.log(`Fetching historical data: ${url}`);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            if (response.status === 429) {
              console.warn('Rate limit hit, will retry later');
              return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const rawData = await response.json();
          
          if (!Array.isArray(rawData)) {
            throw new Error('Invalid response format from Binance API');
          }

          // Convert raw data to our format
          const klineData: KlineData[] = rawData.map((item: any[]) => ({
            openTime: item[0],
            openPrice: parseFloat(item[1]),
            highPrice: parseFloat(item[2]),
            lowPrice: parseFloat(item[3]),
            closePrice: parseFloat(item[4]),
            volume: parseFloat(item[5]),
            closeTime: item[6],
            quoteAssetVolume: parseFloat(item[7]),
            numberOfTrades: item[8],
            takerBuyBaseAssetVolume: parseFloat(item[9]),
            takerBuyQuoteAssetVolume: parseFloat(item[10]),
          }));

          resolve(klineData);
        } catch (error) {
          console.error('Error in API request:', error);
          resolve(null);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // Add delay between requests to respect rate limits
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData(symbol: string, period: string): KlineData[] | null {
    const symbolCache = this.cache[symbol];
    if (!symbolCache) {
      return null;
    }

    const periodCache = symbolCache[period];
    if (!periodCache) {
      return null;
    }

    const now = Date.now();
    if (now > periodCache.expires) {
      // Cache expired
      delete symbolCache[period];
      return null;
    }

    console.log(`Using cached ${period} data for ${symbol}`);
    return periodCache.data;
  }

  /**
   * Cache data with expiration
   */
  private setCachedData(symbol: string, period: string, data: KlineData[], cacheDuration: number): void {
    if (!this.cache[symbol]) {
      this.cache[symbol] = {};
    }

    const now = Date.now();
    this.cache[symbol][period] = {
      data,
      lastUpdated: now,
      expires: now + cacheDuration,
    };

    console.log(`Cached ${period} data for ${symbol} (expires in ${Math.round(cacheDuration / 60000)} minutes)`);
  }

  /**
   * Clear cache for a symbol or all symbols
   */
  public clearCache(symbol?: string): void {
    if (symbol) {
      delete this.cache[symbol];
      console.log(`Cleared cache for ${symbol}`);
    } else {
      this.cache = {};
      console.log('Cleared all historical data cache');
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { symbols: number; totalEntries: number; memoryUsage: string } {
    const symbols = Object.keys(this.cache).length;
    let totalEntries = 0;
    
    Object.values(this.cache).forEach(symbolCache => {
      totalEntries += Object.keys(symbolCache).length;
    });

    // Rough memory usage estimation
    const memoryUsage = `~${Math.round((JSON.stringify(this.cache).length / 1024))} KB`;

    return { symbols, totalEntries, memoryUsage };
  }

  /**
   * Update historical data for a symbol with current price
   * This creates a partial MarketPrice update with historical changes
   */
  public async updateHistoricalChanges(symbol: string, currentPrice: number): Promise<Partial<MarketPrice> | null> {
    try {
      const historicalData = await this.fetchHistoricalData(symbol);
      
      if (Object.keys(historicalData).length === 0) {
        return null;
      }

      return {
        symbol,
        price: currentPrice,
        timestamp: Date.now(),
        ...historicalData,
        source: 'historical-api'
      } as any;
    } catch (error) {
      console.error(`Error updating historical changes for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Validate if a symbol is supported (crypto symbols ending with USDT)
   */
  public isSymbolSupported(symbol: string): boolean {
    return symbol.toUpperCase().endsWith('USDT') || symbol.toUpperCase().endsWith('BTC') || symbol.toUpperCase().endsWith('ETH');
  }

  /**
   * Batch update multiple symbols efficiently
   */
  public async batchUpdateHistoricalData(symbols: string[]): Promise<{ [symbol: string]: Partial<MarketPrice> }> {
    const results: { [symbol: string]: Partial<MarketPrice> } = {};
    
    // Filter to only supported symbols
    const supportedSymbols = symbols.filter(s => this.isSymbolSupported(s));
    
    console.log(`Batch updating historical data for ${supportedSymbols.length} symbols`);
    
    // Process in smaller batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < supportedSymbols.length; i += BATCH_SIZE) {
      const batch = supportedSymbols.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          const historicalData = await this.fetchHistoricalData(symbol);
          if (Object.keys(historicalData).length > 0) {
            results[symbol] = {
              symbol,
              timestamp: Date.now(),
              ...historicalData,
              source: 'historical-batch'
            } as any;
          }
        } catch (error) {
          console.error(`Error updating historical data for ${symbol}:`, error);
        }
      });
      
      await Promise.allSettled(batchPromises);
      
      // Add delay between batches
      if (i + BATCH_SIZE < supportedSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Completed batch update for ${Object.keys(results).length}/${supportedSymbols.length} symbols`);
    return results;
  }
}

// Singleton instance
export const binanceHistoricalService = new BinanceHistoricalService();