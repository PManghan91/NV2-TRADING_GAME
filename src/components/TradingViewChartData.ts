// Cache for historical data to avoid repeated API calls
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Helper function to fetch chart data from Binance
export async function fetchBinanceKlines(symbol: string, interval: string, currencyRate: number = 1) {
  try {
    // Map interval to Binance kline interval
    const binanceInterval = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '1h',
      'D': '1d',
      'W': '1w'
    }[interval] || '15m';
    
    // Calculate appropriate limit based on interval
    // We want: 24h for minutes (except 1h = 72h), 6 months for days, 5 years for weeks
    const limits: Record<string, number> = {
      '1m': 1440,   // 24 hours * 60 minutes = 1440 candles
      '5m': 288,    // 24 hours * 12 (5-min periods per hour) = 288 candles
      '15m': 96,    // 24 hours * 4 (15-min periods per hour) = 96 candles
      '30m': 48,    // 24 hours * 2 (30-min periods per hour) = 48 candles
      '1h': 72,     // 72 hours = 72 candles (3 days)
      '1d': 180,    // 6 months * 30 days = 180 candles
      '1w': 260     // 5 years * 52 weeks = 260 candles
    };
    
    const limit = limits[binanceInterval] || 100;
    
    // Check cache first
    const cacheKey = `${symbol}-${binanceInterval}-${limit}`;
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached data for ${symbol} ${binanceInterval}`);
      return cached.data;
    }
    
    // Binance has a max limit of 1000 per request
    const maxLimit = 1000;
    const actualLimit = Math.min(limit, maxLimit);
    
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${actualLimit}`;
    
    const response = await fetch(url);
    let data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // For longer timeframes that exceed 1000 limit, we need to make multiple requests
      if (limit > maxLimit && binanceInterval === '1m') {
        // Special handling for 1-minute candles (need 1440 for 24 hours)
        console.log(`Fetching additional data for ${symbol} 1m candles...`);
        
        // Fetch in two batches
        const endTime = data[0][0]; // Oldest timestamp from first batch
        const url2 = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit - actualLimit}&endTime=${endTime - 1}`;
        
        try {
          const response2 = await fetch(url2);
          const data2 = await response2.json();
          if (Array.isArray(data2)) {
            data = [...data2, ...data]; // Prepend older data
          }
        } catch (error) {
          console.warn('Could not fetch additional historical data:', error);
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
      
      return result;
    }
  } catch (error) {
    console.error('Error fetching from Binance:', error);
  }
  
  return { candles: [], volumes: [], lastUpdate: Date.now() };
}

// Function to clear cache when needed
export function clearChartCache() {
  dataCache.clear();
  console.log('Chart data cache cleared');
}