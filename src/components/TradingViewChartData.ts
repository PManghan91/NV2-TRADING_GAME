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
      '240': '4h',
      'D': '1d',
      'W': '1w'
    }[interval] || '15m';
    
    const limit = 100;
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
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
      
      console.log(`Loaded ${candles.length} candles from Binance for ${symbol}`);
      return { candles, volumes, lastUpdate: Date.now() };
    }
  } catch (error) {
    console.error('Error fetching from Binance:', error);
  }
  
  return { candles: [], volumes: [], lastUpdate: Date.now() };
}