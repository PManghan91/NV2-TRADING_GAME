import React, { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { priceHistoryService } from '../services/PriceHistoryService';

interface CustomChartProps {
  symbol: string;
  height?: number;
}

interface PricePoint {
  time: number;
  price: number;
}

export const CustomChart: React.FC<CustomChartProps> = ({ symbol, height = 500 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('15m');
  
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  // Get real historical data when symbol or interval changes
  useEffect(() => {
    if (!currentPrice) return;

    // Get real price history from the service
    const chartData = priceHistoryService.getChartData(symbol, interval);
    
    if (chartData.length > 0) {
      // Convert from PriceHistoryService format to our chart format
      const history: PricePoint[] = chartData.map(point => ({
        time: point.timestamp,
        price: point.price
      }));
      
      setPriceHistory(history);
    } else {
      // If no real data yet, show current price as a single point
      setPriceHistory([{
        time: Date.now(),
        price: currentPrice.price
      }]);
    }
  }, [symbol, interval, currentPrice]); // Update when symbol, interval, or price changes

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceHistory.length < 2) return; // Need at least 2 points to draw a line

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate chart dimensions
    const padding = 60;
    const paddingBottom = 80; // Extra padding for time labels
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding - paddingBottom;

    // Find min and max prices
    const minPrice = Math.min(...priceHistory.map(p => p.price));
    const maxPrice = Math.max(...priceHistory.map(p => p.price));
    const priceRange = maxPrice - minPrice;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(42, 46, 57, 0.5)';
    ctx.lineWidth = 1;

    // Calculate reference price (first price in history)
    const referencePrice = priceHistory[0]?.price || currentPrice?.price || 0;

    // Horizontal grid lines with price and percentage labels
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();

      // Price labels with percentage
      const price = maxPrice - (priceRange / 5) * i;
      const percentChange = ((price - referencePrice) / referencePrice) * 100;
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      
      // Draw price
      ctx.fillText(`$${price.toFixed(2)}`, padding - 10, y);
      
      // Draw percentage with color
      ctx.fillStyle = percentChange >= 0 ? '#10b981' : '#ef4444';
      ctx.font = '10px monospace';
      ctx.fillText(`${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`, padding - 10, y + 12);
    }

    // Vertical grid lines with time labels
    for (let i = 0; i <= 4; i++) {
      const x = padding + (chartWidth / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, canvas.height - paddingBottom);
      ctx.stroke();
      
      // Add time labels at the bottom
      const dataIndex = Math.floor((priceHistory.length - 1) * (i / 4));
      const point = priceHistory[dataIndex];
      
      if (point) {
        const date = new Date(point.time);
        let timeLabel = '';
        
        // Format time based on interval
        switch (interval) {
          case '1m':
          case '5m':
            // Show HH:MM for short intervals
            timeLabel = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
            break;
          case '15m':
          case '1h':
            // Show HH:MM for medium intervals
            if (i === 0) {
              // First label shows date
              timeLabel = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
            } else {
              timeLabel = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            }
            break;
          case '1d':
            // Show MMM DD for daily interval
            timeLabel = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
            break;
        }
        
        // Draw time label
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel, x, canvas.height - paddingBottom + 15);
      }
    }

    // Draw price line
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();

    priceHistory.forEach((point, index) => {
      const x = padding + (chartWidth / (priceHistory.length - 1)) * index;
      const y = padding + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw current price line
    if (currentPrice) {
      const currentY = padding + chartHeight - ((currentPrice.price - minPrice) / priceRange) * chartHeight;
      const currentPercentChange = ((currentPrice.price - referencePrice) / referencePrice) * 100;
      
      ctx.strokeStyle = '#2962FF';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, currentY);
      ctx.lineTo(canvas.width - padding, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current price label with percentage
      const labelWidth = 90;
      const labelHeight = 32;
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(canvas.width - padding + 5, currentY - labelHeight/2, labelWidth, labelHeight);
      
      // Price text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${currentPrice.price.toFixed(2)}`, canvas.width - padding + 10, currentY - 2);
      
      // Percentage text
      ctx.fillStyle = currentPercentChange >= 0 ? '#4ade80' : '#f87171';
      ctx.font = '10px monospace';
      ctx.fillText(`${currentPercentChange >= 0 ? '+' : ''}${currentPercentChange.toFixed(2)}%`, canvas.width - padding + 10, currentY + 10);
    }

    // Draw area under line
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(76, 175, 80, 0.2)');
    gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - paddingBottom);

    priceHistory.forEach((point, index) => {
      const x = padding + (chartWidth / (priceHistory.length - 1)) * index;
      const y = padding + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(canvas.width - padding, canvas.height - paddingBottom);
    ctx.closePath();
    ctx.fill();

  }, [priceHistory, currentPrice]);

  // Real-time updates are now handled by the price history service
  // The chart will automatically update when new data comes in
  // through the useEffect above that watches currentPrice changes

  if (!currentPrice) {
    return (
      <div className="w-full bg-trading-card-dark rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Loading chart for {symbol}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Interval Selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {(['1m', '5m', '15m', '1h', '1d'] as const).map(int => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                interval === int
                  ? 'bg-blue-600 text-white'
                  : 'bg-trading-card-dark text-gray-400 hover:text-white'
              }`}
            >
              {int}
            </button>
          ))}
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div>
            <span className="text-gray-500">Price: </span>
            <span className="text-white font-mono font-bold">${currentPrice.price.toFixed(4)}</span>
          </div>
          <div>
            <span className="text-gray-500">Session: </span>
            <span className={`font-mono font-bold ${
              priceHistory.length > 0 && ((currentPrice.price - priceHistory[0].price) / priceHistory[0].price) * 100 >= 0 
                ? 'text-trading-green' 
                : 'text-trading-red'
            }`}>
              {priceHistory.length > 0 ? (() => {
                const sessionChange = ((currentPrice.price - priceHistory[0].price) / priceHistory[0].price) * 100;
                return `${sessionChange >= 0 ? '+' : ''}${sessionChange.toFixed(2)}%`;
              })() : '0.00%'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">24h: </span>
            <span className={`font-mono font-bold ${
              (currentPrice.change24h || currentPrice.changePercent) >= 0 
                ? 'text-trading-green' 
                : 'text-trading-red'
            }`}>
              {(() => {
                const change = currentPrice.change24h !== undefined ? currentPrice.change24h : currentPrice.changePercent;
                return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Canvas Chart */}
      <canvas 
        ref={canvasRef} 
        className="w-full bg-trading-card-dark rounded-lg" 
        style={{ height }}
      />

      {/* Stats Bar */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-gray-500">24h High</span>
          <div className="text-white font-mono">${(currentPrice.price * 1.02).toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-500">24h Low</span>
          <div className="text-white font-mono">${(currentPrice.price * 0.98).toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-500">Volume</span>
          <div className="text-white font-mono">{(Math.random() * 1000000).toFixed(0)}</div>
        </div>
        <div>
          <span className="text-gray-500">Market Cap</span>
          <div className="text-white font-mono">${(currentPrice.price * 1000000).toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
};