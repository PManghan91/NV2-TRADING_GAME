import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';
import { API_CONFIG } from '../utils/constants';
import { fetchBinanceKlines, isLoading, clearSymbolCache } from './TradingViewChartData';
import { useSettings } from './SettingsModal';
import { useCurrency } from '../contexts/CurrencyContext';

interface Currency {
  code: 'USD' | 'EUR' | 'GBP';
  symbol: string;
  name: string;
  rate: number;
}

interface TradingViewProfessionalChartProps {
  symbol: string;
  displaySymbol?: string; // The symbol to display in the UI (currency-aware)
  height?: number;
  availableSymbols?: { symbol: string; name: string; type: 'crypto' | 'stock'; icon: string; displaySymbol?: string }[];
  onSymbolChange?: (symbol: string) => void;
}

interface ChartData {
  candles: any[];
  volumes: any[];
  lastUpdate: number;
}

export const TradingViewProfessionalChart: React.FC<TradingViewProfessionalChartProps> = ({ 
  symbol, 
  displaySymbol,
  height = 600,
  availableSymbols = [],
  onSymbolChange
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const chartDataRef = useRef<Map<string, ChartData>>(new Map());
  const isMountedRef = useRef(true);
  const settings = useSettings();
  const { currency } = useCurrency();
  
  const [interval, setInterval] = useState<'1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W' | 'M'>('15');
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area' | 'bars'>(settings.chartType === 'bars' ? 'bars' : settings.chartType === 'line' ? 'line' : 'candles');
  const [showVolume, setShowVolume] = useState(settings.showVolume !== undefined ? settings.showVolume : true);
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const [prevCurrency, setPrevCurrency] = useState(currency.code);
  const [currentCandle, setCurrentCandle] = useState<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);
  const [intervalPercentChange, setIntervalPercentChange] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  
  // Rate limiting refs
  const lastChartUpdateRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const CHART_UPDATE_INTERVAL = 100; // 100ms = 10 updates per second (professional tier)
  const UI_UPDATE_INTERVAL = 500; // 500ms = 2 updates per second for OHLC display
  
  // Clear cached data when currency changes
  useEffect(() => {
    if (prevCurrency !== currency.code) {
      console.log(`Currency changed from ${prevCurrency} to ${currency.code}, clearing chart data`);
      chartDataRef.current.clear();
      
      // Clear the TradingView chart data cache as well
      import('./TradingViewChartData').then(({ clearChartCache }) => {
        clearChartCache();
      });
      
      // Force chart to reload with new currency
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData([]);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData([]);
      }
      
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

  // Calculate percentage change for the selected interval
  const calculateIntervalPercentChange = useCallback((candles: any[], currentInterval: string, currentPriceOverride?: number) => {
    if (!candles || candles.length < 2) {
      console.log('Insufficient candle data for percentage calculation');
      return 0;
    }
    
    // Simplified and more reliable percentage calculation
    // Use the number of candles to go back instead of time-based calculation
    const candlesToGoBack = {
      '1': 1,    // 1 candle back for 1-minute interval
      '5': 1,    // 1 candle back for 5-minute interval
      '15': 1,   // 1 candle back for 15-minute interval
      '30': 2,   // 2 candles back for 30-minute interval (1 hour)
      '60': 4,   // 4 candles back for 1-hour interval (4 hours)
      '240': 6,  // 6 candles back for 4-hour interval (24 hours)
      'D': 7,    // 7 candles back for daily interval (1 week)
      'W': 4,    // 4 candles back for weekly interval (1 month)
      'M': 3     // 3 candles back for monthly interval (3 months)
    }[currentInterval] || 1;
    
    // Simple approach: go back the specified number of candles
    const startIndex = Math.max(0, candles.length - 1 - candlesToGoBack);
    const startCandle = candles[startIndex];
    const currentCandle = candles[candles.length - 1];
    
    if (!startCandle || !currentCandle || startCandle.close === 0) {
      console.log('Invalid candle data for percentage calculation');
      return 0;
    }
    
    // Use current price override if provided (for real-time updates), otherwise use candle close
    const currentPrice = currentPriceOverride !== undefined ? currentPriceOverride : currentCandle.close;
    
    // Calculate percentage change
    const percentChange = ((currentPrice - startCandle.close) / startCandle.close) * 100;
    
    // Debug logging for BTCUSDT to track calculation
    if (candles.length > 0 && Math.random() < 0.1) { // Log 10% of the time to avoid spam
      console.log(`📊 Percentage calculation:`, {
        interval: currentInterval,
        candlesToGoBack,
        startIndex,
        startPrice: startCandle.close,
        currentPrice,
        percentChange: percentChange.toFixed(2) + '%',
        totalCandles: candles.length
      });
    }
    
    return percentChange;
  }, []);

  // Fetch real historical data from API
  const fetchHistoricalData = useCallback(async (symbol: string, interval: string) => {
    console.log('Fetching historical data for', symbol, 'with interval', interval);
    
    // For crypto, use Binance API
    if (symbol.includes('USDT')) {
      return await fetchBinanceKlines(symbol, interval, currency.rate, currency.code);
    }
    
    // For stocks, use Finnhub
    try {
      const intervalMs = {
        '1': 60000,
        '5': 300000,
        '15': 900000,
        '30': 1800000,
        '60': 3600000,
        '240': 14400000,
        'D': 86400000,
        'W': 604800000,
        'M': 2629746000 // Average month (30.44 days)
      }[interval] || 900000;

      // Map interval to API resolution
      const resolution = {
        '1': '1',
        '5': '5',
        '15': '15',
        '30': '30',
        '60': '60',
        '240': '240',
        'D': 'D',
        'W': 'W',
        'M': 'M'
      }[interval] || 'D';

      const numCandles = 150;
      const to = Math.floor(Date.now() / 1000);
      const from = Math.floor((Date.now() - (numCandles * intervalMs)) / 1000);
      
      // Determine if it's a crypto symbol
      const isCrypto = symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH');
      let apiSymbol = symbol;
      
      if (isCrypto) {
        // For crypto, add BINANCE: prefix if not present
        apiSymbol = symbol.includes(':') ? symbol : `BINANCE:${symbol}`;
      }
      
      const url = `${API_CONFIG.FINNHUB.BASE_URL}/${isCrypto ? 'crypto' : 'stock'}/candle?symbol=${apiSymbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_CONFIG.FINNHUB.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.s === 'ok' && data.t && data.o && data.h && data.l && data.c) {
        // Convert API data to chart format with currency conversion
        const candles = data.t.map((time: number, index: number) => ({
          time: time,
          open: data.o[index] * currency.rate,
          high: data.h[index] * currency.rate,
          low: data.l[index] * currency.rate,
          close: data.c[index] * currency.rate
        }));
        
        const volumes = data.t.map((time: number, index: number) => ({
          time: time,
          value: data.v ? data.v[index] : Math.random() * 50000 + 10000, // More realistic fallback: 10k-60k
          color: data.c[index] >= data.o[index] ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        }));
        
        return { candles, volumes, lastUpdate: Date.now() };
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
    
    // Return empty data if fetch fails
    return { candles: [], volumes: [], lastUpdate: Date.now() };
  }, [currency]);
  
  // Initialize or get chart data
  const getChartData = useCallback((symbol: string, interval: string) => {
    const key = `${symbol}-${interval}-${currency.code}`;
    return chartDataRef.current.get(key) || { candles: [], volumes: [], lastUpdate: 0 };
  }, [currency.code]);
  
  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Load historical data when symbol or interval changes
  useEffect(() => {
    const loadData = async () => {
      if (!isMountedRef.current) return;
      const key = `${symbol}-${interval}-${currency.code}`;
      const existingData = chartDataRef.current.get(key);
      
      // Check if data is currently being loaded
      const isCurrentlyLoading = isLoading(symbol, interval);
      setIsLoadingData(isCurrentlyLoading);
      
      // Only fetch if we don't have data or it's older than 1 minute and not currently loading
      if ((!existingData || Date.now() - existingData.lastUpdate > 60000) && !isCurrentlyLoading) {
        setIsLoadingData(true);
        const data = await fetchHistoricalData(symbol, interval);
        if (!isMountedRef.current) return;
        chartDataRef.current.set(key, data);
        setIsLoadingData(false);
        
        // Update chart if it exists
        if (isMountedRef.current && candlestickSeriesRef.current && data.candles.length > 0) {
          if (chartType === 'candles' || chartType === 'bars') {
            candlestickSeriesRef.current.setData(data.candles);
          } else {
            const lineData = data.candles.map((c: any) => ({ time: c.time, value: c.close }));
            candlestickSeriesRef.current.setData(lineData);
          }
          
          if (volumeSeriesRef.current && showVolume) {
            volumeSeriesRef.current.setData(data.volumes);
          }
          
          // Reset chart view when loading new symbol data
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
            chartRef.current.priceScale('right').applyOptions({
              autoScale: true,
            });
          }
          
          // Calculate percentage change
          const percentChange = calculateIntervalPercentChange(data.candles, interval);
          setIntervalPercentChange(percentChange);
          
          // Debug: Log percentage calculation source
          if (symbol === 'BTCUSDT') {
            console.log(`📊 ${symbol} ${interval} percentage calculated from historical data: ${percentChange.toFixed(2)}%`);
            if (currentPrice?.change24h !== undefined) {
              console.log(`📡 ${symbol} WebSocket 24h change available: ${currentPrice.change24h.toFixed(2)}%`);
            }
          }
          
          // Set current candle
          if (data.candles.length > 0) {
            const lastCandle = data.candles[data.candles.length - 1];
            const lastVolume = data.volumes[data.volumes.length - 1];
            setCurrentCandle({
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
              volume: lastVolume?.value || 0
            });
          }
        }
      }
    };
    
    loadData();
  }, [symbol, interval, currency.code, chartType, showVolume, fetchHistoricalData, calculateIntervalPercentChange]);

  // Initialize single chart with both price and volume series
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const totalChartHeight = height - 40; // Subtract toolbar height

    // Time scale configuration with enhanced time display
    const timeScaleOptions = {
      borderColor: '#2a2e39',
      borderVisible: false,
      secondsVisible: false,
      rightOffset: 5,
      barSpacing: settings.compactMode ? 4 : 6,
      minBarSpacing: settings.compactMode ? 2 : 4,
      fixLeftEdge: false,
      fixRightEdge: false,
      lockVisibleTimeRangeOnResize: false,
      rightBarStaysOnScroll: true,
      visible: true,
      timeVisible: true, // Always show time labels at the bottom
      tickMarkFormatter: (time: UTCTimestamp) => {
        const date = new Date(time * 1000);
        
        // Format time labels based on interval for better readability
        if (interval === '1' || interval === '5' || interval === '15' || interval === '30' || interval === '60') {
          // For intraday intervals, show time in HH:MM format
          if (settings.timezone === 'local') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          } else if (settings.timezone === 'utc') {
            return date.toUTCString().slice(17, 22); // HH:MM format from UTC string
          } else {
            return date.toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            });
          }
        } else {
          // For daily/weekly/monthly intervals, show date
          if (settings.timezone === 'local') {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          } else if (settings.timezone === 'utc') {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          } else {
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              timeZone: 'America/New_York'
            });
          }
        }
      }
    };

    // Grid configuration
    const gridOptions = {
      vertLines: {
        color: settings.theme === 'light' ? '#e0e3eb' : '#1e222d',
        style: LineStyle.Solid,
        visible: settings.showGrid !== undefined ? settings.showGrid : true
      },
      horzLines: {
        color: settings.theme === 'light' ? '#e0e3eb' : '#1e222d',
        style: LineStyle.Solid,
        visible: settings.showGrid !== undefined ? settings.showGrid : true
      }
    };

    // Create single chart instance
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: totalChartHeight,
      layout: {
        background: { 
          type: ColorType.Solid, 
          color: settings.theme === 'light' ? '#ffffff' : '#131722' 
        },
        textColor: settings.theme === 'light' ? '#2a2e39' : '#d1d4dc',
        fontSize: settings.compactMode ? 11 : 12, // Slightly larger font for better readability
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif'
      },
      grid: gridOptions,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#6c7285', // Brighter crosshair color for better visibility
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e222d',
          labelVisible: true
        },
        horzLine: {
          width: 1,
          color: '#6c7285', // Brighter crosshair color for better visibility
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e222d',
          labelVisible: true
        }
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          
          // Always show time in HH:MM format when hovering in crosshair
          if (settings.timezone === 'local') {
            return date.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit', 
              hour12: false 
            });
          } else if (settings.timezone === 'utc') {
            return date.toUTCString().slice(17, 22); // Extract HH:MM from UTC string
          } else {
            return date.toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            });
          }
        }
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        borderVisible: false,
        entireTextOnly: true,
        visible: true,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.4 : 0.1 // Leave space for volume at bottom
        }
      },
      timeScale: timeScaleOptions,
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
        text: displaySymbol || symbol,
      },
    });

    let mainSeries: any;
    let volumeSeries: any = null;
    
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

    // Add volume histogram series to the same chart (overlay)
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '' // Empty string for overlay
      });
      
      // Apply scaleMargins to the volume series' price scale after creation
      chart.priceScale('').applyOptions({
        scaleMargins: {
          top: 0.7, // Volume takes bottom 30% of chart
          bottom: 0
        }
      });
    }

    chartRef.current = chart;
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
    
    if (volumeSeries && showVolume) {
      volumeSeries.setData(volumes);
    }
    
    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [symbol, height, showVolume, chartType, settings.theme, settings.compactMode, settings.showGrid, settings.timezone]); // Reinitialize when these dependencies change

  // Enhanced data loading after chart initialization (addresses refresh issues)
  useEffect(() => {
    if (!isMountedRef.current || !candlestickSeriesRef.current || !chartRef.current) return;
    
    // Force reload data when chart is freshly initialized to handle refresh scenarios
    const loadChartDataAfterInit = async () => {
      console.log('Loading chart data after initialization for', symbol);
      
      const cacheKey = `${symbol}-${interval}-${currency.code}`;
      
      // Don't clear cache completely - check if we have recent data first
      const existingData = chartDataRef.current.get(cacheKey);
      const shouldUseCachedData = existingData && Date.now() - existingData.lastUpdate < 5 * 60 * 1000;
      
      if (shouldUseCachedData) {
        console.log('Using existing cached data for immediate chart rendering');
        const data = existingData;
        
        // Update chart immediately with cached data
        if (data.candles.length > 0 && candlestickSeriesRef.current && chartRef.current) {
          if (chartType === 'candles' || chartType === 'bars') {
            candlestickSeriesRef.current.setData(data.candles);
          } else {
            const lineData = data.candles.map((c: any) => ({ time: c.time, value: c.close }));
            candlestickSeriesRef.current.setData(lineData);
          }
          
          if (volumeSeriesRef.current && showVolume) {
            volumeSeriesRef.current.setData(data.volumes);
          }
          
          chartRef.current.timeScale().fitContent();
          
          // Apply timeScale visibility settings after fitContent
          setTimeout(() => {
            if (chartRef.current) {
              chartRef.current.timeScale().applyOptions({
                timeVisible: !showVolume
              });
              
            }
          }, 0);
          
          const percentChange = calculateIntervalPercentChange(data.candles, interval);
          setIntervalPercentChange(percentChange);
          
          if (data.candles.length > 0) {
            const lastCandle = data.candles[data.candles.length - 1];
            const lastVolume = data.volumes[data.volumes.length - 1];
            setCurrentCandle({
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
              volume: lastVolume?.value || 0
            });
          }
        }
        
        // Then refresh data in background
        setTimeout(async () => {
          if (!isMountedRef.current) return;
          console.log('Background refresh of chart data after using cache');
          const freshData = await fetchHistoricalData(symbol, interval);
          if (freshData && freshData.candles.length > 0) {
            chartDataRef.current.set(cacheKey, freshData);
            // Update chart with fresh data
            if (candlestickSeriesRef.current && chartRef.current) {
              if (chartType === 'candles' || chartType === 'bars') {
                candlestickSeriesRef.current.setData(freshData.candles);
              } else {
                const lineData = freshData.candles.map((c: any) => ({ time: c.time, value: c.close }));
                candlestickSeriesRef.current.setData(lineData);
              }
              
              if (volumeSeriesRef.current && showVolume) {
                volumeSeriesRef.current.setData(freshData.volumes);
              }
            }
          }
        }, 1000);
      } else {
        // No cached data or data is too old, fetch fresh data
        setIsLoadingData(true);
        const data = await fetchHistoricalData(symbol, interval);
        if (!isMountedRef.current) return;
        
        chartDataRef.current.set(cacheKey, data);
        setIsLoadingData(false);
        
        // Update chart if we have valid data
        if (data.candles.length > 0 && candlestickSeriesRef.current && chartRef.current) {
          if (chartType === 'candles' || chartType === 'bars') {
            candlestickSeriesRef.current.setData(data.candles);
          } else {
            const lineData = data.candles.map((c: any) => ({ time: c.time, value: c.close }));
            candlestickSeriesRef.current.setData(lineData);
          }
          
          if (volumeSeriesRef.current && showVolume) {
            volumeSeriesRef.current.setData(data.volumes);
          }
          
          // Fit content and calculate percentage change - sync both charts
          chartRef.current.timeScale().fitContent();
          
          // Apply timeScale visibility settings after fitContent
          setTimeout(() => {
            if (chartRef.current) {
              chartRef.current.timeScale().applyOptions({
                timeVisible: !showVolume
              });
              
            }
          }, 0);
          
          const percentChange = calculateIntervalPercentChange(data.candles, interval);
          setIntervalPercentChange(percentChange);
          
          if (data.candles.length > 0) {
            const lastCandle = data.candles[data.candles.length - 1];
            const lastVolume = data.volumes[data.volumes.length - 1];
            setCurrentCandle({
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
              volume: lastVolume?.value || 0
            });
          }
          
          console.log('✅ Chart data loaded successfully after initialization');
        }
      }
    };
    
    // Small delay to ensure chart is fully initialized
    const timer = setTimeout(loadChartDataAfterInit, 50);
    return () => clearTimeout(timer);
  }, [candlestickSeriesRef.current, chartRef.current]); // Run when chart refs are ready
  
  // Update data when interval or currency changes
  useEffect(() => {
    if (!isMountedRef.current || !candlestickSeriesRef.current || !chartRef.current) return;

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
      
      // Calculate and set interval percentage change
      const percentChange = calculateIntervalPercentChange(candles, interval);
      
      // For daily intervals (24h), prefer WebSocket 24h data when available and reasonable
      if (interval === 'D' && currentPrice?.change24h !== undefined && 
          Math.abs(currentPrice.change24h) < 50 && // Sanity check: less than 50% change
          currentPrice.source === 'ws-ticker') { // Ensure it's from ticker WebSocket
        setIntervalPercentChange(currentPrice.change24h);
        if (symbol === 'BTCUSDT') {
          console.log(`🎯 ${symbol} Using WebSocket 24h change: ${currentPrice.change24h.toFixed(2)}% (source: ${currentPrice.source})`);
        }
      } else {
        setIntervalPercentChange(percentChange);
        if (symbol === 'BTCUSDT') {
          console.log(`📊 ${symbol} Using calculated ${interval} change: ${percentChange.toFixed(2)}% (source: historical)`);
        }
      }
    }
    
    // Set data based on chart type
    if (chartType === 'candles' || chartType === 'bars') {
      candlestickSeriesRef.current.setData(candles);
    } else {
      const lineData = candles.map((c: any) => ({ time: c.time, value: c.close }));
      candlestickSeriesRef.current.setData(lineData);
    }
    
    if (volumeSeriesRef.current && showVolume) {
      volumeSeriesRef.current.setData(volumes);
    }
    
    // Reset the chart view to fit the new data properly - sync both charts
    chartRef.current.timeScale().fitContent();
    
    // Apply timeScale visibility settings after fitContent
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().applyOptions({
          timeVisible: !showVolume
        });
        
        // Volume is now integrated in the same chart - no separate chart sync needed
      }
    }, 0);
    
    // Auto-scale the price to fit the new asset's price range
    if (candlestickSeriesRef.current) {
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
      });
      // Force the chart to recalculate the visible range - sync both charts
      setTimeout(() => {
        if (chartRef.current && candlestickSeriesRef.current) {
          chartRef.current.timeScale().fitContent();
          
          // Apply timeScale visibility settings after fitContent
          setTimeout(() => {
            if (chartRef.current) {
              chartRef.current.timeScale().applyOptions({
                timeVisible: !showVolume
              });
              
            }
          }, 0);
        }
      }, 0);
    }
  }, [interval, showVolume, chartType, symbol, getChartData, currency, calculateIntervalPercentChange]); // Re-run when these change

  // Real-time price updates
  useEffect(() => {
    if (!isMountedRef.current || !candlestickSeriesRef.current || !currentPrice) return;

    const intervalMs = {
      '1': 60000,
      '5': 300000,
      '15': 900000,
      '30': 1800000,
      '60': 3600000,
      '240': 14400000,
      'D': 86400000,
      'W': 604800000,
      'M': 2629746000 // Average month (30.44 days)
    }[interval] || 900000;

    const updatePrice = () => {
      const now = Date.now();
      const nowSeconds = Math.floor(now / 1000);
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
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
          open: convertedPrice, // Use current converted price for open to avoid currency mismatch
          high: convertedPrice,
          low: convertedPrice,
          close: convertedPrice
        };
        data.candles.push(newCandle);
        
        // Add new volume bar - calculate realistic volume based on historical average
        let estimatedVolume = 100000; // Default fallback
        if (data.volumes.length > 0) {
          // Calculate average volume from recent historical data (last 20 candles)
          const recentVolumes = data.volumes.slice(-20).map(v => v.value);
          const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
          
          // Generate realistic volume within ±50% of average historical volume
          const volumeVariance = (Math.random() - 0.5) * 0.5; // -25% to +25%
          estimatedVolume = avgVolume * (1 + volumeVariance);
          
          // Ensure minimum reasonable volume (1% of average)
          estimatedVolume = Math.max(estimatedVolume, avgVolume * 0.01);
        }
        
        const newVolume = {
          time: newCandle.time,
          value: estimatedVolume,
          color: newCandle.close >= newCandle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        };
        data.volumes.push(newVolume);
        
        if (data.candles.length > 500) {
          data.candles.shift();
          data.volumes.shift();
        }

        if (isMountedRef.current && candlestickSeriesRef.current) {
          if (chartType === 'candles' || chartType === 'bars') {
            candlestickSeriesRef.current.update(newCandle);
          } else {
            candlestickSeriesRef.current.update({ time: newCandle.time, value: convertedPrice });
          }
        }
        
        if (isMountedRef.current && volumeSeriesRef.current && showVolume) {
          volumeSeriesRef.current.update(newVolume);
        }
        
        // Update current candle state for UI display (rate limited)
        if (now - lastUIUpdateRef.current >= UI_UPDATE_INTERVAL) {
          setCurrentCandle({
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close,
            volume: estimatedVolume
          });
          
          // Recalculate interval percentage change with current live price
          const convertedPrice = currentPrice.price * currency.rate;
          const percentChange = calculateIntervalPercentChange(data.candles, interval, convertedPrice);
          setIntervalPercentChange(percentChange);
          
          lastUIUpdateRef.current = now;
        }
      } else {
        // Update last candle with currency conversion
        const convertedPrice = currentPrice.price * currency.rate;
        // Only update if the candle is in the same currency (avoid mixing currencies)
        // Check if the price difference is reasonable (not a currency conversion spike)
        const priceChangeRatio = Math.abs(convertedPrice - lastCandle.close) / lastCandle.close;
        if (priceChangeRatio < 0.5) { // If price hasn't changed by more than 50%, it's likely the same currency
          lastCandle.close = convertedPrice;
          lastCandle.high = Math.max(lastCandle.high, convertedPrice);
          lastCandle.low = Math.min(lastCandle.low, convertedPrice);
        } else {
          // Currency has likely changed, create a new candle instead
          console.log('Large price jump detected, likely currency change. Refreshing chart data.');
          // Clear the chart data to force a reload with correct currency
          chartDataRef.current.delete(`${symbol}-${interval}-${currency.code}`);
          return;
        }
        
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
          
          // Recalculate interval percentage change with current live price
          const convertedPrice = currentPrice.price * currency.rate;
          const percentChange = calculateIntervalPercentChange(data.candles, interval, convertedPrice);
          setIntervalPercentChange(percentChange);
          
          lastUIUpdateRef.current = now;
        }
        
        if (isMountedRef.current && candlestickSeriesRef.current) {
          if (chartType === 'candles' || chartType === 'bars') {
            candlestickSeriesRef.current.update(lastCandle);
          } else {
            candlestickSeriesRef.current.update({ time: lastCandle.time, value: convertedPrice });
          }
        }
      }
    };

    const intervalId = window.setInterval(updatePrice, CHART_UPDATE_INTERVAL);
    updatePrice(); // Initial update

    return () => window.clearInterval(intervalId);
  }, [currentPrice, symbol, interval, chartType, getChartData, currency, showVolume, calculateIntervalPercentChange, CHART_UPDATE_INTERVAL, UI_UPDATE_INTERVAL]);

  // Remove dependency on currentPrice for initial chart rendering
  // The chart should initialize immediately and show "Waiting for data..." in the toolbar
  // This fixes the refresh issue where charts wouldn't render at all

  return (
    <div className="w-full bg-[#131722] rounded">
      {/* TradingView-style Toolbar */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-3 py-2">
        {/* Left side - Symbol and intervals */}
        <div className="flex items-center space-x-4">
          {/* Symbol info */}
          <div className="flex items-center space-x-2">
            <span className="text-white font-semibold text-sm">{displaySymbol || symbol}</span>
            <span className={`text-xs ${
              // Use WebSocket 24h change for daily intervals, otherwise use calculated change
              (interval === 'D' && currentPrice?.change24h !== undefined) ? 
                (currentPrice.change24h >= 0 ? 'text-green-400' : 'text-red-400') :
                (intervalPercentChange >= 0 ? 'text-green-400' : 'text-red-400')
            }`}>
              {/* Show WebSocket 24h change for daily intervals when available */}
              {interval === 'D' && currentPrice?.change24h !== undefined ? (
                <>
                  {currentPrice.change24h >= 0 ? '▲' : '▼'} {Math.abs(currentPrice.change24h).toFixed(2)}%
                </>
              ) : (
                <>
                  {intervalPercentChange >= 0 ? '▲' : '▼'} {Math.abs(intervalPercentChange).toFixed(2)}%
                </>
              )}
            </span>
            <span className="text-gray-500 text-xs">
              {interval === '1' ? '1M' : 
               interval === '5' ? '5M' : 
               interval === '15' ? '15M' : 
               interval === '30' ? '30M' : 
               interval === '60' ? '1H' : 
               interval === '240' ? '4H' : 
               interval === 'D' ? '1D' : 
               interval === 'W' ? '1W' : 
               interval === 'M' ? '1MO' : interval}
            </span>
          </div>

          {/* Interval buttons */}
          <div className="flex items-center space-x-1">
            {[
              { value: '1', label: '1m' },
              { value: '5', label: '5m' },
              { value: '15', label: '15m' },
              { value: '30', label: '30m' },
              { value: '60', label: '1h' },
              { value: '240', label: '4h' },
              { value: 'D', label: '1D' },
              { value: 'W', label: '1W' },
              { value: 'M', label: '1M' }
            ].map((int) => (
              <button
                key={int.value}
                onClick={() => setInterval(int.value as any)}
                className={`px-2 py-1 text-xs font-medium rounded hover:bg-[#2a2e39] transition-colors ${
                  interval === int.value
                    ? 'bg-[#2962FF] text-white'
                    : 'text-gray-400'
                }`}
              >
                {int.label}
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
          
          {/* Loading indicator */}
          {isLoadingData && (
            <div className="flex items-center space-x-2 px-2 py-1 bg-[#2a2e39] rounded">
              <div className="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent"></div>
              <span className="text-xs text-blue-400">Loading...</span>
            </div>
          )}
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
                <span>{displaySymbol || symbol}</span>
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
                          <div className="text-gray-500 text-xs">{sym.displaySymbol || sym.symbol}</div>
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
                              <div className="text-gray-500 text-xs">{sym.displaySymbol || sym.symbol}</div>
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
          
          {/* Price Info - Show actual 24hr OHLC from WebSocket */}
          <div className="flex items-center space-x-6 text-xs">
            {!currentPrice ? (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                <span>Waiting for market data...</span>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-gray-500">O</span>
                  <span className="text-gray-300 ml-1">{currency.symbol}{currentPrice?.open24h ? (currentPrice.open24h * currency.rate).toFixed(2) : '0.00'}</span>
                </div>
                <div>
                  <span className="text-gray-500">H</span>
                  <span className="text-gray-300 ml-1">{currency.symbol}{currentPrice?.high24h ? (currentPrice.high24h * currency.rate).toFixed(2) : '0.00'}</span>
                </div>
                <div>
                  <span className="text-gray-500">L</span>
                  <span className="text-gray-300 ml-1">{currency.symbol}{currentPrice?.low24h ? (currentPrice.low24h * currency.rate).toFixed(2) : '0.00'}</span>
                </div>
                <div>
                  <span className="text-gray-500">C</span>
                  <span className="text-gray-300 ml-1">{currency.symbol}{currentPrice ? (currentPrice.price * currency.rate).toFixed(2) : '0.00'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Vol</span>
                  <span className="text-gray-300 ml-1">{currentCandle ? currentCandle.volume.toFixed(0) : '0'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Single Chart Container */}
      <div className="w-full">
        <div className="border border-[#2a2e39] rounded overflow-hidden">
          <div 
            ref={chartContainerRef} 
            className="w-full"
            style={{ height: height - 40 }}
          />
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-600 pointer-events-none">
        <div>Scroll to zoom • Drag to pan • Double-click to reset</div>
      </div>
    </div>
  );
};