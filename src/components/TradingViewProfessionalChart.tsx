import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';

interface Currency {
  code: 'USD' | 'EUR' | 'GBP';
  symbol: string;
  name: string;
  rate: number;
}

interface TradingViewProfessionalChartProps {
  symbol: string;
  height?: number;
  availableSymbols?: { symbol: string; name: string; type: 'crypto' | 'stock'; icon: string }[];
  onSymbolChange?: (symbol: string) => void;
  currency?: Currency;
}

interface ChartData {
  candles: any[];
  volumes: any[];
  lastUpdate: number;
}

export const TradingViewProfessionalChart: React.FC<TradingViewProfessionalChartProps> = ({ 
  symbol, 
  height = 600,
  availableSymbols = [],
  onSymbolChange,
  currency = { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.00 }
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const volumeChartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const volumeChartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const chartDataRef = useRef<Map<string, ChartData>>(new Map());
  
  const [interval, setInterval] = useState<'1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W'>('15');
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area' | 'bars'>('candles');
  const [showVolume, setShowVolume] = useState(true);
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const [prevCurrency, setPrevCurrency] = useState(currency.code);
  const [currentCandle, setCurrentCandle] = useState<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);
  
  // Rate limiting refs
  const lastChartUpdateRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const CHART_UPDATE_INTERVAL = 100; // 100ms = 10 updates per second (professional tier)
  const UI_UPDATE_INTERVAL = 500; // 500ms = 2 updates per second for OHLC display
  
  // Clear cached data when currency changes
  useEffect(() => {
    if (prevCurrency !== currency.code) {
      chartDataRef.current.clear();
      setPrevCurrency(currency.code);
    }
  }, [currency.code, prevCurrency]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.symbol-selector-container')) {
        setShowSymbolSelector(false);
      }
    };
    
    if (showSymbolSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSymbolSelector]);
  
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  // Initialize or get chart data
  const getChartData = useCallback((symbol: string, interval: string) => {
    const key = `${symbol}-${interval}`;
    
    if (!chartDataRef.current.has(key)) {
      const now = Date.now();
      const intervalMs = {
        '1': 60000,
        '5': 300000,
        '15': 900000,
        '30': 1800000,
        '60': 3600000,
        '240': 14400000,
        'D': 86400000,
        'W': 604800000
      }[interval] || 900000;

      const candles: any[] = [];
      const volumes: any[] = [];
      const basePrice = currentPrice?.price || 50000;
      const numCandles = 150; // Show 150 candles like TradingView
      
      // Generate realistic historical data
      // Start from a price close to current, work backwards
      let currentOpen = basePrice;
      
      // Generate candles in reverse (from most recent to oldest)
      const tempCandles: any[] = [];
      const tempVolumes: any[] = [];
      
      for (let i = 0; i < numCandles; i++) {
        // Generate timestamps aligned to interval boundaries
        const candleTime = Math.floor((now - (i * intervalMs)) / intervalMs) * intervalMs;
        const time = Math.floor(candleTime / 1000);
        
        // Create realistic OHLC in USD first
        const volatility = 0.001; // 0.1% volatility (reduced for smoother chart)
        const trend = Math.random() > 0.5 ? 1 : -1;
        const change = (Math.random() * volatility * trend);
        
        const closeUSD = currentOpen;
        const openUSD = closeUSD / (1 + change); // Work backwards
        const highUSD = Math.max(openUSD, closeUSD) * (1 + Math.random() * volatility * 0.3);
        const lowUSD = Math.min(openUSD, closeUSD) * (1 - Math.random() * volatility * 0.3);
        
        // Apply currency conversion
        const open = openUSD * currency.rate;
        const close = closeUSD * currency.rate;
        const high = highUSD * currency.rate;
        const low = lowUSD * currency.rate;
        
        tempCandles.unshift({ time, open, high, low, close }); // Add to beginning
        
        // Volume with realistic distribution
        const baseVolume = 1000000;
        const volumeVariance = Math.abs(change) * 5; // Reduced volume variance
        const volume = baseVolume * (1 + volumeVariance + Math.random() * 0.5);
        
        tempVolumes.unshift({
          time,
          value: volume,
          color: close >= open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        });
        
        currentOpen = openUSD; // Move backwards in price
      }
      
      // Ensure the last candle ends very close to current price
      if (tempCandles.length > 0 && currentPrice) {
        const lastCandle = tempCandles[tempCandles.length - 1];
        const convertedCurrentPrice = currentPrice.price * currency.rate;
        
        // Adjust the last candle to smoothly connect with current price
        lastCandle.close = convertedCurrentPrice;
        lastCandle.high = Math.max(lastCandle.high, convertedCurrentPrice);
        lastCandle.low = Math.min(lastCandle.low, convertedCurrentPrice);
      }
      
      candles.push(...tempCandles);
      volumes.push(...tempVolumes);
      
      chartDataRef.current.set(key, {
        candles,
        volumes,
        lastUpdate: now
      });
    }
    
    return chartDataRef.current.get(key)!;
  }, [currentPrice, currency]);

  // Initialize charts
  useEffect(() => {
    if (!chartContainerRef.current || !volumeChartContainerRef.current) return;
    
    const priceHeight = Math.floor(height * 0.7); // 70% for price chart
    const volumeHeight = Math.floor(height * 0.3); // 30% for volume chart

    // Create main price chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: priceHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif'
      },
      grid: {
        vertLines: {
          color: '#1e222d',
          style: LineStyle.Solid,
          visible: true
        },
        horzLines: {
          color: '#1e222d',
          style: LineStyle.Solid,
          visible: true
        }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#434651',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#131722'
        },
        horzLine: {
          width: 1,
          color: '#434651',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#131722'
        }
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        borderVisible: false,
        entireTextOnly: true,
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1
        }
      },
      timeScale: {
        borderColor: '#2a2e39',
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
        minBarSpacing: 4,
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

    // Add watermark
    chart.applyOptions({
      watermark: {
        visible: true,
        fontSize: 48,
        horzAlign: 'center',
        vertAlign: 'center',
        color: 'rgba(256, 256, 256, 0.03)',
        text: symbol,
      },
    });

    let mainSeries: any;
    
    // Create main price series based on type
    switch (chartType) {
      case 'candles':
        mainSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: true,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineColor: '#2962FF',
          priceLineStyle: LineStyle.Dashed,
          lastValueVisible: true,
          priceFormat: {
            type: 'price',
            precision: symbol.includes('USDT') ? 2 : 4,
            minMove: 0.01
          }
        });
        break;
      case 'line':
        mainSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineColor: '#2962FF',
          priceLineStyle: LineStyle.Dashed,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          priceFormat: {
            type: 'price',
            precision: symbol.includes('USDT') ? 2 : 4,
            minMove: 0.01
          }
        });
        break;
      case 'area':
        mainSeries = chart.addAreaSeries({
          topColor: 'rgba(41, 98, 255, 0.3)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
          lineColor: '#2962FF',
          lineWidth: 2,
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineColor: '#2962FF',
          priceLineStyle: LineStyle.Dashed,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          priceFormat: {
            type: 'price',
            precision: symbol.includes('USDT') ? 2 : 4,
            minMove: 0.01
          }
        });
        break;
      case 'bars':
        mainSeries = chart.addBarSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          openVisible: true,
          thinBars: false,
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineColor: '#2962FF',
          priceLineStyle: LineStyle.Dashed,
          lastValueVisible: true,
          priceFormat: {
            type: 'price',
            precision: symbol.includes('USDT') ? 2 : 4,
            minMove: 0.01
          }
        });
        break;
    }

    // Create separate volume chart
    let volumeChart: any = null;
    let volumeSeries: any = null;
    
    if (showVolume) {
      volumeChart = createChart(volumeChartContainerRef.current, {
        width: volumeChartContainerRef.current.clientWidth,
        height: volumeHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#131722' },
          textColor: '#d1d4dc',
          fontSize: 11,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif'
        },
        grid: {
          vertLines: {
            color: '#1e222d',
            style: LineStyle.Solid,
            visible: true
          },
          horzLines: {
            color: '#1e222d',
            style: LineStyle.Solid,
            visible: true
          }
        },
        rightPriceScale: {
          borderColor: '#2a2e39',
          borderVisible: false,
          entireTextOnly: true,
          visible: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1
          }
        },
        timeScale: {
          borderColor: '#2a2e39',
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 6,
          minBarSpacing: 4,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          rightBarStaysOnScroll: true,
          visible: true
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            width: 1,
            color: '#434651',
            style: LineStyle.Dashed,
            labelBackgroundColor: '#131722'
          },
          horzLine: {
            width: 1,
            color: '#434651',
            style: LineStyle.Dashed,
            labelBackgroundColor: '#131722'
          }
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
      
      volumeSeries = volumeChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'right'
      });
      
      // Sync time scales
      chart.timeScale().subscribeVisibleLogicalRangeChange((timeRange: any) => {
        if (timeRange) {
          volumeChart.timeScale().setVisibleLogicalRange(timeRange);
        }
      });
      
      volumeChart.timeScale().subscribeVisibleLogicalRangeChange((timeRange: any) => {
        if (timeRange) {
          chart.timeScale().setVisibleLogicalRange(timeRange);
        }
      });
    }

    chartRef.current = chart;
    volumeChartRef.current = volumeChart;
    candlestickSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;

    // Load initial data immediately after creating the chart
    const data = getChartData(symbol, interval);
    const { candles, volumes } = data;
    
    // Set data based on chart type
    if (chartType === 'candles' || chartType === 'bars') {
      mainSeries.setData(candles);
    } else {
      const lineData = candles.map((c: any) => ({ time: c.time, value: c.close }));
      mainSeries.setData(lineData);
    }
    
    if (volumeSeries && volumeChart && showVolume) {
      volumeSeries.setData(volumes);
      // Sync time scale fitting
      volumeChart.timeScale().fitContent();
    }
    
    // Fit content with some padding
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
      if (volumeChartContainerRef.current && volumeChart) {
        volumeChart.applyOptions({
          width: volumeChartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      if (volumeChart) {
        volumeChart.remove();
      }
    };
  }, [symbol, height, chartType, showVolume, interval, getChartData, currency]);

  // Update data when interval or currency changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    const data = getChartData(symbol, interval);
    const { candles, volumes } = data;
    
    // Set initial current candle state
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const lastVolume = volumes[volumes.length - 1];
      setCurrentCandle({
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
        volume: lastVolume?.value || 0
      });
    }
    
    // Set data based on chart type
    if (chartType === 'candles' || chartType === 'bars') {
      candlestickSeriesRef.current.setData(candles);
    } else {
      const lineData = candles.map((c: any) => ({ time: c.time, value: c.close }));
      candlestickSeriesRef.current.setData(lineData);
    }
    
    if (volumeSeriesRef.current && volumeChartRef.current && showVolume) {
      volumeSeriesRef.current.setData(volumes);
      volumeChartRef.current.timeScale().fitContent();
    }
    
    // Fit content with some padding
    chartRef.current.timeScale().fitContent();
  }, [interval, showVolume, chartType, symbol, getChartData, currency]); // Re-run when these change

  // Real-time price updates
  useEffect(() => {
    if (!candlestickSeriesRef.current || !currentPrice) return;

    const intervalMs = {
      '1': 60000,
      '5': 300000,
      '15': 900000,
      '30': 1800000,
      '60': 3600000,
      '240': 14400000,
      'D': 86400000,
      'W': 604800000
    }[interval] || 900000;

    const updatePrice = () => {
      const now = Date.now();
      const nowSeconds = Math.floor(now / 1000);
      
      // Rate limit chart updates
      if (now - lastChartUpdateRef.current < CHART_UPDATE_INTERVAL) {
        return;
      }
      lastChartUpdateRef.current = now;
      
      const data = getChartData(symbol, interval);
      if (!data || data.candles.length === 0) return;

      const lastCandle = data.candles[data.candles.length - 1];
      const timeDiff = (nowSeconds - lastCandle.time) * 1000;

      if (timeDiff >= intervalMs) {
        // Create new candle with currency conversion
        const convertedPrice = currentPrice.price * currency.rate;
        const newCandle = {
          time: Math.floor((Math.floor(Date.now() / intervalMs) * intervalMs) / 1000),
          open: lastCandle.close, // New candle opens at previous close
          high: Math.max(lastCandle.close, convertedPrice), // High is max of open and current
          low: Math.min(lastCandle.close, convertedPrice), // Low is min of open and current
          close: convertedPrice
        };
        data.candles.push(newCandle);
        
        // Add new volume bar
        const baseVolume = 1000000;
        const volumeVariance = Math.random();
        const volume = baseVolume * (1 + volumeVariance);
        const newVolume = {
          time: newCandle.time,
          value: volume,
          color: newCandle.close >= newCandle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        };
        data.volumes.push(newVolume);
        
        if (data.candles.length > 500) {
          data.candles.shift();
          data.volumes.shift();
        }

        if (chartType === 'candles' || chartType === 'bars') {
          candlestickSeriesRef.current.update(newCandle);
        } else {
          candlestickSeriesRef.current.update({ time: newCandle.time, value: convertedPrice });
        }
        
        if (volumeSeriesRef.current && showVolume) {
          volumeSeriesRef.current.update(newVolume);
        }
        
        // Update current candle state for UI display (rate limited)
        if (now - lastUIUpdateRef.current >= UI_UPDATE_INTERVAL) {
          setCurrentCandle({
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close,
            volume: newVolume.value
          });
          lastUIUpdateRef.current = now;
        }
      } else {
        // Update last candle with currency conversion
        const convertedPrice = currentPrice.price * currency.rate;
        lastCandle.close = convertedPrice;
        lastCandle.high = Math.max(lastCandle.high, convertedPrice);
        lastCandle.low = Math.min(lastCandle.low, convertedPrice);
        
        // Update current candle state for UI display (rate limited)
        if (now - lastUIUpdateRef.current >= UI_UPDATE_INTERVAL) {
          const lastVolume = data.volumes[data.volumes.length - 1];
          setCurrentCandle({
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
            volume: lastVolume?.value || 0
          });
          lastUIUpdateRef.current = now;
        }
        
        if (chartType === 'candles' || chartType === 'bars') {
          candlestickSeriesRef.current.update(lastCandle);
        } else {
          candlestickSeriesRef.current.update({ time: lastCandle.time, value: convertedPrice });
        }
      }
    };

    const intervalId = window.setInterval(updatePrice, CHART_UPDATE_INTERVAL);
    updatePrice(); // Initial update

    return () => window.clearInterval(intervalId);
  }, [currentPrice, symbol, interval, chartType, getChartData, currency, showVolume, CHART_UPDATE_INTERVAL, UI_UPDATE_INTERVAL]);

  if (!currentPrice) {
    return (
      <div className="w-full bg-[#131722] rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Loading chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#131722] rounded">
      {/* TradingView-style Toolbar */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-3 py-2">
        {/* Left side - Symbol and intervals */}
        <div className="flex items-center space-x-4">
          {/* Symbol info */}
          <div className="flex items-center space-x-2">
            <span className="text-white font-semibold text-sm">{symbol}</span>
            <span className={`text-xs ${(currentPrice.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(currentPrice.change24h || 0) >= 0 ? '▲' : '▼'} {Math.abs(currentPrice.change24h || 0).toFixed(2)}%
            </span>
          </div>

          {/* Interval buttons */}
          <div className="flex items-center space-x-1">
            {['1', '5', '15', '30', '60', '240', 'D', 'W'].map((int) => (
              <button
                key={int}
                onClick={() => setInterval(int as any)}
                className={`px-2 py-1 text-xs font-medium rounded hover:bg-[#2a2e39] transition-colors ${
                  interval === int
                    ? 'bg-[#2962FF] text-white'
                    : 'text-gray-400'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="flex items-center border-l border-[#2a2e39] pl-3 ml-2">
            <button
              onClick={() => setChartType('bars')}
              className={`p-1.5 hover:bg-[#2a2e39] rounded ${chartType === 'bars' ? 'text-[#2962FF]' : 'text-gray-400'}`}
              title="Bars"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="8" width="2" height="12" />
                <rect x="11" y="4" width="2" height="16" />
                <rect x="18" y="10" width="2" height="10" />
              </svg>
            </button>
            <button
              onClick={() => setChartType('candles')}
              className={`p-1.5 hover:bg-[#2a2e39] rounded ${chartType === 'candles' ? 'text-[#2962FF]' : 'text-gray-400'}`}
              title="Candles"
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
              className={`p-1.5 hover:bg-[#2a2e39] rounded ${chartType === 'line' ? 'text-[#2962FF]' : 'text-gray-400'}`}
              title="Line"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12l4-4 4 4 4-8 6 8" />
              </svg>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 hover:bg-[#2a2e39] rounded ${chartType === 'area' ? 'text-[#2962FF]' : 'text-gray-400'}`}
              title="Area"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 12l4-4 4 4 4-8 6 8v8H3z" opacity="0.3" />
                <path d="M3 12l4-4 4 4 4-8 6 8" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Indicators */}
          <div className="flex items-center border-l border-[#2a2e39] pl-3">
            <button className="text-gray-400 hover:text-white text-xs px-2 py-1 hover:bg-[#2a2e39] rounded">
              Indicators
            </button>
          </div>

          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`text-xs px-2 py-1 rounded hover:bg-[#2a2e39] ${
              showVolume ? 'text-[#2962FF]' : 'text-gray-400'
            }`}
          >
            Volume
          </button>
        </div>

        {/* Right side - Symbol selector and Price info */}
        <div className="flex items-center space-x-4">
          {/* Symbol Selector */}
          {availableSymbols.length > 0 && (
            <div className="relative symbol-selector-container">
              <button
                onClick={() => setShowSymbolSelector(!showSymbolSelector)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-[#2a2e39] hover:bg-[#363a45] rounded text-white text-sm font-medium transition-colors"
              >
                <span>{symbol}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSymbolSelector ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showSymbolSelector && (
                <div className="absolute right-0 mt-2 w-56 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {/* Crypto Section */}
                  <div className="px-3 py-2 text-xs text-gray-500 font-semibold border-b border-[#2a2e39]">CRYPTO</div>
                  {availableSymbols.filter(s => s.type === 'crypto').map(sym => (
                    <button
                      key={sym.symbol}
                      onClick={() => {
                        if (onSymbolChange) onSymbolChange(sym.symbol);
                        setShowSymbolSelector(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2e39] transition-colors ${
                        symbol === sym.symbol ? 'bg-[#2a2e39]' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{sym.icon}</span>
                        <div className="text-left">
                          <div className="text-white text-sm font-medium">{sym.name}</div>
                          <div className="text-gray-500 text-xs">{sym.symbol}</div>
                        </div>
                      </div>
                      {symbol === sym.symbol && (
                        <svg className="w-4 h-4 text-[#2962FF]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  
                  {/* Stocks Section */}
                  {availableSymbols.some(s => s.type === 'stock') && (
                    <>
                      <div className="px-3 py-2 text-xs text-gray-500 font-semibold border-b border-t border-[#2a2e39]">STOCKS</div>
                      {availableSymbols.filter(s => s.type === 'stock').map(sym => (
                        <button
                          key={sym.symbol}
                          onClick={() => {
                            if (onSymbolChange) onSymbolChange(sym.symbol);
                            setShowSymbolSelector(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2e39] transition-colors ${
                            symbol === sym.symbol ? 'bg-[#2a2e39]' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{sym.icon}</span>
                            <div className="text-left">
                              <div className="text-white text-sm font-medium">{sym.name}</div>
                              <div className="text-gray-500 text-xs">{sym.symbol}</div>
                            </div>
                          </div>
                          {symbol === sym.symbol && (
                            <svg className="w-4 h-4 text-[#2962FF]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Price Info */}
          <div className="flex items-center space-x-6 text-xs">
            <div>
              <span className="text-gray-500">O</span>
              <span className="text-gray-300 ml-1">{currency.symbol}{currentCandle ? currentCandle.open.toFixed(2) : '0.00'}</span>
            </div>
            <div>
              <span className="text-gray-500">H</span>
              <span className="text-gray-300 ml-1">{currency.symbol}{currentCandle ? currentCandle.high.toFixed(2) : '0.00'}</span>
            </div>
            <div>
              <span className="text-gray-500">L</span>
              <span className="text-gray-300 ml-1">{currency.symbol}{currentCandle ? currentCandle.low.toFixed(2) : '0.00'}</span>
            </div>
            <div>
              <span className="text-gray-500">C</span>
              <span className="text-gray-300 ml-1">{currency.symbol}{currentCandle ? currentCandle.close.toFixed(2) : '0.00'}</span>
            </div>
            <div>
              <span className="text-gray-500">Vol</span>
              <span className="text-gray-300 ml-1">{currentCandle ? currentCandle.volume.toFixed(0) : '0'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Containers */}
      <div className="w-full">
        {/* Main Price Chart */}
        <div 
          ref={chartContainerRef} 
          className="w-full"
          style={{ height: Math.floor((height - 40) * 0.7) }}
        />
        
        {/* Volume Chart */}
        {showVolume && (
          <div 
            ref={volumeChartContainerRef} 
            className="w-full border-t border-[#2a2e39]"
            style={{ height: Math.floor((height - 40) * 0.3) }}
          />
        )}
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-600 pointer-events-none">
        <div>Scroll to zoom • Drag to pan • Double-click to reset</div>
      </div>
    </div>
  );
};