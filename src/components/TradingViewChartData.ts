// Enhanced cache for historical data with loading states
const dataCache = new Map<string, { data: any; timestamp: number; loading?: boolean }>();
const loadingStates = new Map<string, boolean>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache for better performance

// Cache duration based on interval - longer intervals can be cached longer
const getCacheDuration = (interval: string): number => {
  const durations: Record<string, number> = {
    '1m': 1 * 60 * 1000,      // 1 minute for 1m data
    '5m': 2 * 60 * 1000,      // 2 minutes for 5m data
    '15m': 5 * 60 * 1000,     // 5 minutes for 15m data
    '30m': 10 * 60 * 1000,    // 10 minutes for 30m data
    '1h': 15 * 60 * 1000,     // 15 minutes for 1h data
    '4h': 30 * 60 * 1000,     // 30 minutes for 4h data
    '1d': 60 * 60 * 1000,     // 1 hour for daily data
    '1w': 4 * 60 * 60 * 1000, // 4 hours for weekly data
    '1M': 8 * 60 * 60 * 1000  // 8 hours for monthly data
  };
  return durations[interval] || CACHE_DURATION;
};

// Loading state management
export function isLoading(symbol: string, interval: string): boolean {
  const cacheKey = `${symbol}-${interval}`;
  return loadingStates.get(cacheKey) || false;
}

export function setLoading(symbol: string, interval: string, loading: boolean): void {
  const cacheKey = `${symbol}-${interval}`;
  loadingStates.set(cacheKey, loading);
}

// Helper function to fetch chart data from Binance
export async function fetchBinanceKlines(symbol: string, interval: string, currencyRate: number = 1, currencyCode: string = 'USD') {
  // Map interval to Binance kline interval
  const binanceInterval = {
    '1': '1m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '240': '4h',
    'D': '1d',
    'W': '1w',
    'M': '1M'
  }[interval] || '15m';

  try {
    
    // Optimized data ranges based on research recommendations
    // Provides optimal balance of data quantity vs performance
    const limits: Record<string, number> = {
      '1m': 720,    // 12 hours of 1-minute candles
      '5m': 432,    // 36 hours of 5-minute candles (1.5 days)
      '15m': 288,   // 72 hours of 15-minute candles (3 days)
      '30m': 240,   // 5 days of 30-minute candles
      '1h': 360,    // 15 days of 1-hour candles
      '4h': 180,    // 30 days of 4-hour candles
      '1d': 365,    // 1 year of daily candles
      '1w': 520,    // 10 years of weekly candles
      '1M': 240     // 20 years of monthly candles
    };
    
    const limit = limits[binanceInterval] || 100;
    
    // Check cache first - include currency code in cache key to prevent currency mixing
    const cacheKey = `${symbol}-${binanceInterval}-${limit}-${currencyCode}`;
    const cached = dataCache.get(cacheKey);
    const cacheDuration = getCacheDuration(binanceInterval);
    
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      console.log(`Using cached data for ${symbol} ${binanceInterval} ${currencyCode} (${Math.round((cacheDuration - (Date.now() - cached.timestamp)) / 1000)}s remaining)`);
      // Apply currency conversion to cached data if needed
      const result = {
        candles: cached.data.candles.map((candle: any) => ({
          ...candle,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        })),
        volumes: cached.data.volumes,
        lastUpdate: cached.data.lastUpdate
      };
      return result;
    }
    
    // For page refresh scenarios, if we have cached data less than 10 minutes old but no active loading,
    // return cached data but trigger background refresh - increased time window for better UX
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000 && !isLoading(symbol, binanceInterval)) {
      console.log(`Using recent cached data for ${symbol} ${binanceInterval} ${currencyCode} while refreshing in background`);
      // Trigger immediate background refresh for page refresh scenarios
      setTimeout(() => {
        if (!isLoading(symbol, binanceInterval)) {
          console.log(`Background refresh for ${symbol} ${binanceInterval} ${currencyCode}`);
          fetchBinanceKlines(symbol, interval, currencyRate, currencyCode);
        }
      }, 100); // Reduced delay for faster refresh
      return cached.data;
    }
    
    // Check if already loading to prevent duplicate requests
    if (isLoading(symbol, binanceInterval)) {
      console.log(`Already loading data for ${symbol} ${binanceInterval}, please wait...`);
      return cached?.data || { candles: [], volumes: [], lastUpdate: Date.now() };
    }
    
    // Set loading state
    setLoading(symbol, binanceInterval, true);
    
    // Binance has a max limit of 1000 per request
    const maxLimit = 1000;
    const actualLimit = Math.min(limit, maxLimit);
    
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${actualLimit}`;
    
    const response = await fetch(url);
    let data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // Progressive loading for data sets exceeding 1000 candles
      if (limit > maxLimit) {
        console.log(`Fetching additional data for ${symbol} ${binanceInterval} candles (${limit} total)...`);
        
        const batches = Math.ceil(limit / maxLimit);
        const additionalData: any[] = [];
        
        // Fetch additional batches sequentially to avoid rate limits
        for (let batch = 1; batch < batches; batch++) {
          try {
            // Calculate remaining candles needed
            const remainingCandles = limit - (batch * maxLimit);
            const batchSize = Math.min(remainingCandles, maxLimit);
            
            // Get the oldest timestamp from current data
            const endTime = (batch === 1 ? data : additionalData)[0][0];
            
            const batchUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${batchSize}&endTime=${endTime - 1}`;
            
            console.log(`Fetching batch ${batch + 1}/${batches} for ${symbol} (${batchSize} candles)`);
            
            const batchResponse = await fetch(batchUrl);
            const batchData = await batchResponse.json();
            
            if (Array.isArray(batchData) && batchData.length > 0) {
              // Add delay between requests to respect rate limits
              if (batch < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              additionalData.unshift(...batchData); // Prepend older data
            } else {
              console.warn(`Batch ${batch + 1} returned no data, stopping progressive loading`);
              break;
            }
          } catch (error) {
            console.warn(`Could not fetch batch ${batch + 1} of historical data:`, error);
            break;
          }
        }
        
        // Combine all data: older data first, then newer data
        if (additionalData.length > 0) {
          data = [...additionalData, ...data];
          console.log(`Progressive loading complete: ${data.length} total candles for ${symbol}`);
        }
      }
      
      // Convert Binance kline data to chart format
      const candles = data.map((kline: any[]) => ({
        time: Math.floor(kline[0] / 1000), // Convert ms to seconds
        open: parseFloat(kline[1]) * currencyRate,
        high: parseFloat(kline[2]) * currencyRate,
        low: parseFloat(kline[3]) * currencyRate,
        close: parseFloat(kline[4]) * currencyRate
      }));
      
      const volumes = data.map((kline: any[]) => ({
        time: Math.floor(kline[0] / 1000),
        value: parseFloat(kline[5]),
        color: parseFloat(kline[4]) >= parseFloat(kline[1]) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
      }));
      
      console.log(`Loaded ${candles.length} candles from Binance for ${symbol} (${binanceInterval})`);
      
      const result = { candles, volumes, lastUpdate: Date.now() };
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      // Clear loading state
      setLoading(symbol, binanceInterval, false);
      
      return result;
    }
  } catch (error) {
    console.error('Error fetching from Binance:', error);
    // Clear loading state on error
    setLoading(symbol, binanceInterval, false);
  }
  
  // Clear loading state and return empty data
  setLoading(symbol, binanceInterval, false);
  return { candles: [], volumes: [], lastUpdate: Date.now() };
}

// Function to clear cache when needed
export function clearChartCache() {
  dataCache.clear();
  loadingStates.clear();
  console.log('Chart data cache and loading states cleared');
}

// Function to clear cache for a specific symbol and interval
export function clearSymbolCache(symbol: string, interval?: string) {
  if (interval) {
    const binanceInterval = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '1h',
      '240': '4h',
      'D': '1d',
      'W': '1w',
      'M': '1M'
    }[interval] || '15m';
    
    // Clear specific cache entries for this symbol-interval combination
    Array.from(dataCache.keys())
      .filter(key => key.startsWith(`${symbol}-${binanceInterval}`))
      .forEach(key => {
        dataCache.delete(key);
        console.log(`Cleared cache for ${key}`);
      });
      
    loadingStates.delete(`${symbol}-${binanceInterval}`);
  } else {
    // Clear all cache entries for this symbol
    Array.from(dataCache.keys())
      .filter(key => key.startsWith(`${symbol}-`))
      .forEach(key => {
        dataCache.delete(key);
        console.log(`Cleared cache for ${key}`);
      });
      
    Array.from(loadingStates.keys())
      .filter(key => key.startsWith(`${symbol}-`))
      .forEach(key => loadingStates.delete(key));
  }
}