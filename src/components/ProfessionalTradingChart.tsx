import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';

interface ProfessionalTradingChartProps {
  symbol: string;
  height?: number;
}

export const ProfessionalTradingChart: React.FC<ProfessionalTradingChartProps> = ({ symbol, height = 500 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const dataRef = useRef<Map<string, { candles: any[], volumes: any[] }>>(new Map()); // Store data per symbol
  
  const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('1m');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  // Initialize data for a symbol if not exists
  const initializeData = useCallback((symbol: string) => {
    const key = `${symbol}-${interval}`;
    if (!dataRef.current.has(key)) {
      const now = Date.now();
      const intervalMs = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000
      }[interval];

      // Generate initial historical data (50 candles)
      const candles: any[] = [];
      const volumes: any[] = [];
      const basePrice = currentPrice?.price || 50000;
      
      for (let i = 50; i >= 0; i--) {
        const time = Math.floor((now - (i * intervalMs)) / 1000);
        
        // Generate realistic OHLC with some randomness
        const randomWalk = (Math.random() - 0.5) * basePrice * 0.002; // 0.2% variation
        const open = i === 50 ? basePrice : candles[candles.length - 1]?.close || basePrice;
        const close = Math.max(open + randomWalk, basePrice * 0.95);
        const high = Math.max(open, close) * (1 + Math.random() * 0.001);
        const low = Math.min(open, close) * (1 - Math.random() * 0.001);
        
        candles.push({
          time,
          open,
          high,
          low,
          close
        });
        
        // Scale volume to be much smaller than price to appear at bottom
        const scaledVolume = (Math.random() * 1000 + 500) * (basePrice * 0.001); // Much smaller scale
        volumes.push({
          time,
          value: scaledVolume,
          color: close >= open ? '#26a69a' : '#ef5350'
        });
      }
      
      dataRef.current.set(key, { candles, volumes });
    }
    return dataRef.current.get(key);
  }, [interval, currentPrice]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with professional styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#1a2332' },
        textColor: '#d1d4dc',
        fontSize: 12,
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      },
      grid: {
        vertLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
          visible: true
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
          visible: true
        }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 0,
          labelBackgroundColor: '#2B2B43'
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 0,
          labelBackgroundColor: '#2B2B43'
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.25
        }
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 10,
        minBarSpacing: 5,
        fixLeftEdge: false,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        visible: true
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true
        },
        axisDoubleClickReset: {
          time: true,
          price: true
        },
        mouseWheel: true,
        pinch: true
      }
    });

    // Create series based on chart type
    let mainSeries: any;
    
    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: symbol.includes('USDT') ? 2 : 4,
          minMove: 0.01
        }
      });
    } else if (chartType === 'line') {
      mainSeries = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: symbol.includes('USDT') ? 2 : 4,
          minMove: 0.01
        }
      });
    } else {
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(41, 98, 255, 0.5)',
        bottomColor: 'rgba(41, 98, 255, 0.05)',
        lineColor: '#2962FF',
        lineWidth: 2,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: symbol.includes('USDT') ? 2 : 4,
          minMove: 0.01
        }
      });
    }

    // Create volume series - scale values down to appear at bottom
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceScaleId: 'right', // Use same scale as price
      priceFormat: {
        type: 'volume',
      }
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [symbol, height, chartType]);

  // Load initial data when symbol or interval changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !currentPrice) return;

    const data = initializeData(symbol);
    if (!data) return;

    const { candles, volumes } = data;
    
    // Set data based on chart type
    if (chartType === 'candlestick') {
      candlestickSeriesRef.current.setData(candles);
    } else {
      // Convert candlestick data to line data (using close price)
      const lineData = candles.map((c: any) => ({ time: c.time, value: c.close }));
      candlestickSeriesRef.current.setData(lineData);
    }
    
    volumeSeriesRef.current.setData(volumes);
    
    // Auto-scale to fit all data
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [symbol, interval, currentPrice, chartType, initializeData]);

  // Update current price only (not generate new candles continuously)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !currentPrice) return;

    const key = `${symbol}-${interval}`;
    const data = dataRef.current.get(key);
    if (!data) return;

    const { candles, volumes } = data;
    if (candles.length === 0) return;

    // Get interval in milliseconds
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }[interval];

    const now = Date.now();
    const currentTimeSeconds = Math.floor(now / 1000);
    const lastCandle = candles[candles.length - 1];
    const timeSinceLastCandle = (currentTimeSeconds - lastCandle.time) * 1000;

    // Check if we need a new candle or update the existing one
    if (timeSinceLastCandle >= intervalMs) {
      // Create a new candle
      const newCandle = {
        time: Math.floor((Math.floor(now / intervalMs) * intervalMs) / 1000),
        open: lastCandle.close,
        high: currentPrice.price,
        low: currentPrice.price,
        close: currentPrice.price
      };
      
      candles.push(newCandle);
      
      // Scale volume to appear at bottom of chart
      const scaledVolume = (Math.random() * 1000 + 500) * (currentPrice.price * 0.001);
      const newVolume = {
        time: newCandle.time,
        value: scaledVolume,
        color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350'
      };
      
      volumes.push(newVolume);
      
      // Keep only last 200 candles
      if (candles.length > 200) {
        candles.shift();
        volumes.shift();
      }
      
      // Update the chart with new candle
      if (chartType === 'candlestick') {
        candlestickSeriesRef.current.update(newCandle);
      } else {
        candlestickSeriesRef.current.update({ time: newCandle.time, value: currentPrice.price });
      }
      volumeSeriesRef.current.update(newVolume);
      
    } else {
      // Update the last candle with current price
      lastCandle.close = currentPrice.price;
      lastCandle.high = Math.max(lastCandle.high, currentPrice.price);
      lastCandle.low = Math.min(lastCandle.low, currentPrice.price);
      
      // Update only the last candle on the chart
      if (chartType === 'candlestick') {
        candlestickSeriesRef.current.update(lastCandle);
      } else {
        candlestickSeriesRef.current.update({ time: lastCandle.time, value: currentPrice.price });
      }
      
      // Update volume color based on direction
      const lastVolume = volumes[volumes.length - 1];
      lastVolume.color = lastCandle.close >= lastCandle.open ? '#26a69a' : '#ef5350';
      volumeSeriesRef.current.update(lastVolume);
    }
  }, [currentPrice, symbol, interval, chartType]);

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
      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center space-x-2">
          {/* Interval Selector */}
          <div className="flex items-center space-x-1 bg-trading-card-dark rounded p-1">
            {(['1m', '5m', '15m', '1h', '1d'] as const).map(int => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  interval === int
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center space-x-1 bg-trading-card-dark rounded p-1">
            <button
              onClick={() => setChartType('candlestick')}
              className={`p-1.5 rounded transition-colors ${
                chartType === 'candlestick' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Candlestick"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="4" width="2" height="16" />
                <rect x="6" y="8" width="4" height="8" />
                <rect x="15" y="4" width="2" height="16" />
                <rect x="14" y="10" width="4" height="6" />
              </svg>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded transition-colors ${
                chartType === 'line' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Line"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12l4-4 4 4 4-8 6 8" />
              </svg>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded transition-colors ${
                chartType === 'area' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Area"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 12l4-4 4 4 4-8 6 8v8H3z" opacity="0.3" />
                <path d="M3 12l4-4 4 4 4-8 6 8" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Price Info */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Last:</span>
            <span className="text-white font-mono font-semibold">
              ${currentPrice.price.toFixed(symbol.includes('USDT') ? 2 : 4)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">24h:</span>
            <span className={`font-mono font-semibold ${
              (currentPrice.change24h || currentPrice.changePercent || 0) >= 0 
                ? 'text-green-400' 
                : 'text-red-400'
            }`}>
              {(() => {
                const change = currentPrice.change24h !== undefined ? currentPrice.change24h : (currentPrice.changePercent || 0);
                return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
              })()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Vol:</span>
            <span className="text-white font-mono">
              {currentPrice.volume ? currentPrice.volume.toLocaleString() : (Math.random() * 10000000).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* TradingView Chart Container */}
      <div 
        ref={chartContainerRef} 
        className="w-full bg-trading-card-dark rounded-lg border border-trading-border"
        style={{ height }}
      />

      {/* Bottom Stats Bar */}
      <div className="mt-4 grid grid-cols-6 gap-4 px-2 text-xs">
        <div>
          <span className="text-gray-500">Open</span>
          <div className="text-white font-mono">
            ${(() => {
              const key = `${symbol}-${interval}`;
              const data = dataRef.current.get(key);
              if (data && data.candles.length > 0) {
                const lastCandle = data.candles[data.candles.length - 1];
                return lastCandle.open.toFixed(2);
              }
              return (currentPrice.price * 0.995).toFixed(2);
            })()}
          </div>
        </div>
        <div>
          <span className="text-gray-500">High</span>
          <div className="text-white font-mono">
            ${(() => {
              const key = `${symbol}-${interval}`;
              const data = dataRef.current.get(key);
              if (data && data.candles.length > 0) {
                const lastCandle = data.candles[data.candles.length - 1];
                return lastCandle.high.toFixed(2);
              }
              return (currentPrice.price * 1.01).toFixed(2);
            })()}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Low</span>
          <div className="text-white font-mono">
            ${(() => {
              const key = `${symbol}-${interval}`;
              const data = dataRef.current.get(key);
              if (data && data.candles.length > 0) {
                const lastCandle = data.candles[data.candles.length - 1];
                return lastCandle.low.toFixed(2);
              }
              return (currentPrice.price * 0.99).toFixed(2);
            })()}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Close</span>
          <div className="text-white font-mono">${currentPrice.price.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-500">Volume</span>
          <div className="text-white font-mono">{(Math.random() * 10000000).toFixed(0)}</div>
        </div>
        <div>
          <span className="text-gray-500">Market Cap</span>
          <div className="text-white font-mono">${(currentPrice.price * 1000000).toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
};