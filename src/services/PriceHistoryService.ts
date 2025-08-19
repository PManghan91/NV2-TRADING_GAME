/**
 * Price History Service
 * Tracks historical prices to calculate time-based changes (15m, 1h, 24h)
 */

interface PricePoint {
  price: number;
  timestamp: number;
}

interface PriceHistory {
  current: number;
  history: PricePoint[];
  change15m?: number;
  change1h?: number;
  change24h?: number;
}

class PriceHistoryService {
  private priceHistory = new Map<string, PriceHistory>();
  private readonly MAX_HISTORY_POINTS = 1440; // Store up to 24 hours of minute data
  
  /**
   * Update price for a symbol and calculate time-based changes
   */
  public updatePrice(symbol: string, price: number): void {
    const now = Date.now();
    
    if (!this.priceHistory.has(symbol)) {
      // Initialize with simulated historical data that trends toward current price
      const history: PricePoint[] = [];
      
      // Generate more realistic historical data that converges to current price
      let simulatedPrice = price * (0.98 + Math.random() * 0.04); // Start within ±2% of current
      
      // Add simulated data points for the last 24 hours
      for (let i = 24 * 60; i >= 0; i -= 1) { // Every minute for last 24 hours
        const timeOffset = i * 60 * 1000; // Convert minutes to milliseconds
        
        // Gradually converge to current price as we approach present time
        const convergenceFactor = i / (24 * 60); // 1 at start, 0 at end
        const targetPrice = price;
        const maxDeviation = 0.005 * convergenceFactor; // Less deviation as time approaches present
        
        // Random walk with mean reversion toward current price
        const randomChange = (Math.random() - 0.5) * maxDeviation;
        const meanReversion = (targetPrice - simulatedPrice) * 0.01;
        simulatedPrice = simulatedPrice * (1 + randomChange + meanReversion);
        
        // Ensure we don't deviate too far
        const maxDiff = price * 0.03; // Max 3% difference
        if (Math.abs(simulatedPrice - price) > maxDiff) {
          simulatedPrice = price + (simulatedPrice > price ? maxDiff : -maxDiff);
        }
        
        history.push({
          price: simulatedPrice,
          timestamp: now - timeOffset
        });
      }
      
      // Ensure last historical point matches current price exactly
      history.push({ price, timestamp: now });
      
      this.priceHistory.set(symbol, {
        current: price,
        history
      });
      
      // Calculate initial changes
      this.calculateChanges(symbol);
      console.log(`Started tracking ${symbol} at $${price.toFixed(2)} with simulated history`);
      return;
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.current = price;
    history.history.push({ price, timestamp: now });
    
    // Keep only recent history
    if (history.history.length > this.MAX_HISTORY_POINTS) {
      history.history = history.history.slice(-this.MAX_HISTORY_POINTS);
    }
    
    // Calculate time-based changes
    this.calculateChanges(symbol);
  }
  
  /**
   * Calculate percentage changes for different time periods
   */
  private calculateChanges(symbol: string): void {
    const history = this.priceHistory.get(symbol);
    if (!history || history.history.length < 2) return;
    
    const now = Date.now();
    const current = history.current;
    
    // Find prices at different time points
    const time15mAgo = now - 15 * 60 * 1000; // 15 minutes
    const time1hAgo = now - 60 * 60 * 1000;  // 1 hour
    const time24hAgo = now - 24 * 60 * 60 * 1000; // 24 hours
    
    // Find closest price points
    const price15m = this.findClosestPrice(history.history, time15mAgo);
    const price1h = this.findClosestPrice(history.history, time1hAgo);
    const price24h = this.findClosestPrice(history.history, time24hAgo);
    
    // Calculate percentage changes
    if (price15m) {
      history.change15m = ((current - price15m) / price15m) * 100;
    }
    if (price1h) {
      history.change1h = ((current - price1h) / price1h) * 100;
    }
    if (price24h) {
      history.change24h = ((current - price24h) / price24h) * 100;
    }
  }
  
  /**
   * Find the price closest to a given timestamp
   */
  private findClosestPrice(history: PricePoint[], targetTime: number): number | null {
    if (history.length === 0) return null;
    
    // If target time is before our earliest data, return the earliest price
    if (targetTime < history[0].timestamp) {
      return history[0].price;
    }
    
    // Find the closest price point
    let closest = history[0];
    let minDiff = Math.abs(history[0].timestamp - targetTime);
    
    for (const point of history) {
      const diff = Math.abs(point.timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    
    return closest.price;
  }
  
  /**
   * Get time-based changes for a symbol
   */
  public getChanges(symbol: string): { change15m?: number; change1h?: number; change24h?: number } {
    const history = this.priceHistory.get(symbol);
    if (!history) {
      return {};
    }
    
    return {
      change15m: history.change15m,
      change1h: history.change1h,
      change24h: history.change24h
    };
  }
  
  /**
   * Get current price for a symbol
   */
  public getCurrentPrice(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    return history ? history.current : null;
  }
  
  /**
   * Get price history for charting with interval aggregation
   */
  public getChartData(symbol: string, interval: '1m' | '5m' | '15m' | '1h' | '1d'): PricePoint[] {
    const history = this.priceHistory.get(symbol);
    if (!history || history.history.length === 0) return [];
    
    // Get interval in milliseconds
    let intervalMs: number;
    let maxPoints: number;
    switch (interval) {
      case '1m':
        intervalMs = 60 * 1000;
        maxPoints = 100; // Show last 100 minutes
        break;
      case '5m':
        intervalMs = 5 * 60 * 1000;
        maxPoints = 100; // Show last 500 minutes
        break;
      case '15m':
        intervalMs = 15 * 60 * 1000;
        maxPoints = 96; // Show last 24 hours
        break;
      case '1h':
        intervalMs = 60 * 60 * 1000;
        maxPoints = 72; // Show last 3 days
        break;
      case '1d':
        intervalMs = 24 * 60 * 60 * 1000;
        maxPoints = 30; // Show last 30 days
        break;
      default:
        intervalMs = 15 * 60 * 1000;
        maxPoints = 96;
    }
    
    // Find the actual data range
    const oldestData = history.history[0].timestamp;
    const newestData = history.history[history.history.length - 1].timestamp;
    const now = Date.now();
    
    // Determine start time based on available data
    const idealStartTime = now - (maxPoints * intervalMs);
    const startTime = Math.max(idealStartTime, oldestData);
    
    // Aggregate data based on interval
    const aggregated: PricePoint[] = [];
    
    // Group data points by interval
    for (let time = startTime; time <= now; time += intervalMs) {
      const intervalStart = time;
      const intervalEnd = time + intervalMs;
      
      // Find all points in this interval
      const intervalPoints = history.history.filter(
        p => p.timestamp >= intervalStart && p.timestamp < intervalEnd
      );
      
      if (intervalPoints.length > 0) {
        // Use OHLC approach: take the last price in the interval as close
        const lastPoint = intervalPoints[intervalPoints.length - 1];
        aggregated.push({
          price: lastPoint.price,
          timestamp: intervalStart // Use start of interval for cleaner alignment
        });
      } else if (aggregated.length > 0) {
        // If we have previous data, carry forward the last known price
        const lastKnownPrice = aggregated[aggregated.length - 1].price;
        aggregated.push({
          price: lastKnownPrice,
          timestamp: intervalStart
        });
      }
    }
    
    // Ensure we have at least some data points
    if (aggregated.length === 0 && history.history.length > 0) {
      // Just return the raw history if aggregation didn't work
      return history.history.slice(-maxPoints);
    }
    
    return aggregated;
  }
}

// Singleton instance
export const priceHistoryService = new PriceHistoryService();