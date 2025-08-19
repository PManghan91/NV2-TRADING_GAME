import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, ColorType } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';

interface EnhancedTradingChartProps {
  symbol: string;
  height?: number;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  onIntervalChange?: (interval: string) => void;
}

export const EnhancedTradingChart: React.FC<EnhancedTradingChartProps> = ({
  symbol,
  height = 600,
  interval = '15m',
  onIntervalChange
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [currentInterval, setCurrentInterval] = useState(interval);
  
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  // Generate simulated OHLC data based on current price
  const generateOHLCData = (basePrice: number, interval: string): any[] => {
    const data: any[] = [];
    const now = Date.now();
    let intervalMs: number;
    let points: number;

    switch (interval) {
      case '1m':
        intervalMs = 60 * 1000;
        points = 100;
        break;
      case '5m':
        intervalMs = 5 * 60 * 1000;
        points = 100;
        break;
      case '15m':
        intervalMs = 15 * 60 * 1000;
        points = 96;
        break;
      case '1h':
        intervalMs = 60 * 60 * 1000;
        points = 72;
        break;
      case '1d':
        intervalMs = 24 * 60 * 60 * 1000;
        points = 90;
        break;
      default:
        intervalMs = 15 * 60 * 1000;
        points = 96;
    }

    for (let i = points; i >= 0; i--) {
      const time = (now - (i * intervalMs)) / 1000;
      const volatility = interval === '1m' ? 0.002 : interval === '5m' ? 0.003 : 0.005;
      const trend = Math.sin(i * 0.1) * 0.01; // Add trend
      
      const open = basePrice * (1 + (Math.random() - 0.5) * volatility + trend);
      const close = basePrice * (1 + (Math.random() - 0.5) * volatility + trend);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

      data.push({
        time: time as Time,
        open,
        high,
        low,
        close,
        value: close // For line series
      });

      // Update base price for next candle
      basePrice = close;
    }

    return data;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // If no price data yet, we'll use a placeholder or skip
    if (!currentPrice) {
      console.log(`No price data available for ${symbol} yet`);
      return;
    }

    // Create chart with explicit type
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create a line series using any cast for v5 compatibility
    const lineSeries = (chart as any).addLineSeries({
      color: '#4CAF50',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    // Generate and set data
    const ohlcData = generateOHLCData(currentPrice.price, currentInterval);
    const lineData = ohlcData.map(d => ({ 
      time: d.time, 
      value: d.close 
    }));
    
    lineSeries.setData(lineData);

    // Add a price line for current price
    lineSeries.createPriceLine({
      price: currentPrice.price,
      color: '#2962FF',
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: 'Current',
    });

    // Store refs
    chartRef.current = chart;
    seriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, height, currentPrice, currentInterval]);

  // Update chart with real-time price
  useEffect(() => {
    if (!seriesRef.current || !currentPrice) return;

    try {
      // Update the last point with current price
      const now = Math.floor(Date.now() / 1000);
      
      seriesRef.current.update({
        time: now as Time,
        value: currentPrice.price,
      });
    } catch (error) {
      console.log('Could not update price:', error);
    }
  }, [currentPrice]);

  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval as any);
    if (onIntervalChange) {
      onIntervalChange(newInterval);
    }
  };

  return (
    <div className="w-full">
      {/* Interval Selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {['1m', '5m', '15m', '1h', '1d'].map(int => (
            <button
              key={int}
              onClick={() => handleIntervalChange(int)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                currentInterval === int
                  ? 'bg-blue-600 text-white'
                  : 'bg-trading-card-dark text-gray-400 hover:text-white'
              }`}
            >
              {int}
            </button>
          ))}
        </div>
        
        {/* Chart Tools */}
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Drawing Tools">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M3 21L21 3" />
            </svg>
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Indicators">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full bg-trading-card-dark rounded-lg" style={{ minHeight: height || 400 }}>
          {!currentPrice && (
            <div className="absolute inset-0 flex items-center justify-center bg-trading-card-dark rounded-lg">
              <div className="text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p>Loading chart data for {symbol}...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Price Info Bar */}
      {currentPrice && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">24h High</span>
            <div className="text-white font-mono">${(currentPrice.price * 1.02).toFixed(4)}</div>
          </div>
          <div>
            <span className="text-gray-500">24h Low</span>
            <div className="text-white font-mono">${(currentPrice.price * 0.98).toFixed(4)}</div>
          </div>
          <div>
            <span className="text-gray-500">24h Volume</span>
            <div className="text-white font-mono">{(Math.random() * 10000000).toFixed(0)}</div>
          </div>
          <div>
            <span className="text-gray-500">24h Change</span>
            <div className={`font-mono ${(currentPrice.change24h || currentPrice.changePercent) >= 0 ? 'text-trading-green' : 'text-trading-red'}`}>
              {(() => {
                const change = currentPrice.change24h !== undefined ? currentPrice.change24h : currentPrice.changePercent;
                return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};