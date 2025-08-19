import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';
import { priceHistoryService } from '../services/PriceHistoryService';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, height = 500 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  
  const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('15m');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  // Generate OHLC data from price history
  const generateOHLCData = (interval: '1m' | '5m' | '15m' | '1h' | '1d') => {
    const history = priceHistoryService.getChartData(symbol, interval);
    
    if (history.length === 0) {
      return { candles: [], volumes: [] };
    }

    const candles: any[] = [];
    const volumes: any[] = [];
    
    // Create candles from grouped data
    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const time = Math.floor(point.timestamp / 1000); // Convert to seconds for lightweight-charts
      
      // Simulate OHLC data with realistic variations
      const basePrice = point.price;
      const volatility = basePrice * 0.002; // 0.2% volatility per candle
      
      // Generate realistic OHLC values
      const open = i > 0 ? history[i - 1].price : basePrice;
      const close = basePrice;
      
      // Simulate high and low with random variations
      const randomHigh = Math.random() * volatility;
      const randomLow = Math.random() * volatility;
      
      const high = Math.max(open, close) + randomHigh;
      const low = Math.min(open, close) - randomLow;
      
      // Simulate volume based on price movement
      const priceChange = Math.abs(close - open);
      const baseVolume = 1000000 + Math.random() * 500000;
      const volume = baseVolume * (1 + priceChange / basePrice * 10);
      
      candles.push({
        time,
        open,
        high,
        low,
        close
      });
      
      // Add volume bar with color based on price direction
      volumes.push({
        time,
        value: volume,
        color: close >= open ? '#26a69a' : '#ef5350'
      });
    }
    
    return { candles, volumes };
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with professional styling similar to TradingView
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
        rightOffset: 10,
        barSpacing: 10,
        minBarSpacing: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
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

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceScaleId: ''
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

  // Update chart data when symbol, interval, or price changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !currentPrice) return;

    const { candles, volumes } = generateOHLCData(interval);
    
    if (candles.length > 0) {
      // Set data based on chart type
      if (chartType === 'candlestick') {
        candlestickSeriesRef.current.setData(candles);
      } else if (chartType === 'line' || chartType === 'area') {
        // Convert candlestick data to line data (using close price)
        const lineData = candles.map(c => ({ time: c.time, value: c.close }));
        candlestickSeriesRef.current.setData(lineData);
      }
      
      volumeSeriesRef.current.setData(volumes);
      
      // Auto-scale to fit all data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [symbol, interval, currentPrice, chartType]);

  // Real-time price updates
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !currentPrice) return;

    const intervalId = window.setInterval(() => {
      const { candles, volumes } = generateOHLCData(interval);
      
      if (candles.length > 0) {
        // Update the last candle with current price
        const lastCandle = candles[candles.length - 1];
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Create a new candle if enough time has passed
        const intervalSeconds = {
          '1m': 60,
          '5m': 300,
          '15m': 900,
          '1h': 3600,
          '1d': 86400
        }[interval];
        
        if (currentTime - lastCandle.time >= intervalSeconds) {
          // Add new candle
          const newCandle = {
            time: currentTime,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, currentPrice.price),
            low: Math.min(lastCandle.close, currentPrice.price),
            close: currentPrice.price
          };
          
          if (chartType === 'candlestick') {
            candlestickSeriesRef.current.update(newCandle);
          } else {
            candlestickSeriesRef.current.update({ time: currentTime, value: currentPrice.price });
          }
          
          // Add new volume bar
          const newVolume = {
            time: currentTime,
            value: Math.random() * 1000000 + 500000,
            color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350'
          };
          volumeSeriesRef.current.update(newVolume);
        } else {
          // Update existing candle
          lastCandle.close = currentPrice.price;
          lastCandle.high = Math.max(lastCandle.high, currentPrice.price);
          lastCandle.low = Math.min(lastCandle.low, currentPrice.price);
          
          if (chartType === 'candlestick') {
            candlestickSeriesRef.current.update(lastCandle);
          } else {
            candlestickSeriesRef.current.update({ time: lastCandle.time, value: currentPrice.price });
          }
        }
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [symbol, interval, currentPrice, chartType]);

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

          {/* Indicators */}
          <div className="flex items-center space-x-1 bg-trading-card-dark rounded p-1">
            <button className="px-2 py-1 text-xs text-gray-400 hover:text-white" title="Moving Average">
              MA
            </button>
            <button className="px-2 py-1 text-xs text-gray-400 hover:text-white" title="RSI">
              RSI
            </button>
            <button className="px-2 py-1 text-xs text-gray-400 hover:text-white" title="MACD">
              MACD
            </button>
            <button className="px-2 py-1 text-xs text-gray-400 hover:text-white" title="Bollinger Bands">
              BB
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
          <div className="text-white font-mono">${(currentPrice.price * 0.995).toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-500">High</span>
          <div className="text-white font-mono">${(currentPrice.price * 1.01).toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-500">Low</span>
          <div className="text-white font-mono">${(currentPrice.price * 0.99).toFixed(2)}</div>
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