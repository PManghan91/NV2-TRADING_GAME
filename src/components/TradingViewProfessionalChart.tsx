import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';
import { API_CONFIG } from '../utils/constants';
import { fetchBinanceKlines } from './TradingViewChartData';
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
  height?: number;
  availableSymbols?: { symbol: string; name: string; type: 'crypto' | 'stock'; icon: string }[];
  onSymbolChange?: (symbol: string) => void;
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
  onSymbolChange
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const volumeChartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const volumeChartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const chartDataRef = useRef<Map<string, ChartData>>(new Map());
  const isMountedRef = useRef(true);
  const settings = useSettings();
  const { currency } = useCurrency();
  
  const [interval, setInterval] = useState<'1' | '5' | '15' | '30' | '60' | 'D' | 'W'>('15');
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area' | 'bars'>(settings.chartType === 'bars' ? 'bars' : settings.chartType === 'line' ? 'line' : 'candles');
  const [showVolume, setShowVolume] = useState(settings.showVolume !== undefined ? settings.showVolume : true);
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const [prevCurrency, setPrevCurrency] = useState(currency.code);
  const [currentCandle, setCurrentCandle] = useState<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);
  const [intervalPercentChange, setIntervalPercentChange] = useState<number>(0);
  
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
  const calculateIntervalPercentChange = useCallback((candles: any[]) => {
    if (!candles || candles.length < 2) return 0;
    
    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    
    if (firstCandle.open === 0) return 0;
    
    const percentChange = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
    return percentChange;
  }, []);

  // Fetch real historical data from API
  const fetchHistoricalData = useCallback(async (symbol: string, interval: string) => {
    console.log('Fetching historical data for', symbol, 'with interval', interval);
    
    // For crypto, use Binance API
    if (symbol.includes('USDT')) {
      return await fetchBinanceKlines(symbol, interval, currency.rate);
    }
    
    // For stocks, use Finnhub
    try {
      const intervalMs = {
        '1': 60000,
        '5': 300000,
        '15': 900000,
        '30': 1800000,
        '60': 3600000,
        'D': 86400000,
        'W': 604800000
      }[interval] || 900000;

      // Map interval to API resolution
      const resolution = {
        '1': '1',
        '5': '5',
        '15': '15',
        '30': '30',
        '60': '60',
        'D': 'D',
        'W': 'W'
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
          value: data.v ? data.v[index] : 1000000,
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
      
      // Only fetch if we don't have data or it's older than 1 minute
      if (!existingData || Date.now() - existingData.lastUpdate > 60000) {
        const data = await fetchHistoricalData(symbol, interval);
        if (!isMountedRef.current) return;
        chartDataRef.current.set(key, data);
        
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
          
          if (volumeChartRef.current && showVolume) {
            volumeChartRef.current.timeScale().fitContent();
          }
          
          // Calculate percentage change
          const percentChange = calculateIntervalPercentChange(data.candles);
          setIntervalPercentChange(percentChange);
          
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
        background: { 
          type: ColorType.Solid, 
          color: settings.theme === 'light' ? '#ffffff' : '#131722' 
        },
        textColor: settings.theme === 'light' ? '#2a2e39' : '#d1d4dc',
        fontSize: settings.compactMode ? 10 : 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif'
      },
      grid: {
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
        autoScale: true,
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
        barSpacing: settings.compactMode ? 4 : 6,
        minBarSpacing: settings.compactMode ? 2 : 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        visible: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          if (settings.timezone === 'local') {
            // Use local timezone
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (settings.timezone === 'utc') {
            // Use UTC
            return date.toUTCString().slice(17, 22);
          } else {
            // Exchange time (assuming EST/EDT for US exchanges)
            return date.toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: '2-digit', 
              minute: '2-digit'
            });
          }
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
          background: { 
            type: ColorType.Solid, 
            color: settings.theme === 'light' ? '#ffffff' : '#131722' 
          },
          textColor: settings.theme === 'light' ? '#2a2e39' : '#d1d4dc',
          fontSize: settings.compactMode ? 10 : 11,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif'
        },
        grid: {
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
      if (chart) {
        chart.remove();
      }
      if (volumeChart) {
        volumeChart.remove();
      }
      chartRef.current = null;
      volumeChartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []); // Only run once on mount

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
      const percentChange = calculateIntervalPercentChange(candles);
      setIntervalPercentChange(percentChange);
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
    
    // Reset the chart view to fit the new data properly
    chartRef.current.timeScale().fitContent();
    
    // Auto-scale the price to fit the new asset's price range
    if (candlestickSeriesRef.current) {
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
      });
      // Force the chart to recalculate the visible range
      setTimeout(() => {
        if (chartRef.current && candlestickSeriesRef.current) {
          chartRef.current.timeScale().fitContent();
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
      'D': 86400000,
      'W': 604800000
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
            volume: newVolume.value
          });
          
          // Recalculate interval percentage change
          const percentChange = calculateIntervalPercentChange(data.candles);
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
          
          // Recalculate interval percentage change
          const percentChange = calculateIntervalPercentChange(data.candles);
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
            <span className={`text-xs ${intervalPercentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {intervalPercentChange >= 0 ? '▲' : '▼'} {Math.abs(intervalPercentChange).toFixed(2)}%
            </span>
            <span className="text-gray-500 text-xs">
              {interval === '1' ? '1M' : 
               interval === '5' ? '5M' : 
               interval === '15' ? '15M' : 
               interval === '30' ? '30M' : 
               interval === '60' ? '1H' : 
               interval === 'D' ? '1D' : 
               interval === 'W' ? '1W' : interval}
            </span>
          </div>

          {/* Interval buttons */}
          <div className="flex items-center space-x-1">
            {['1', '5', '15', '30', '60', 'D', 'W'].map((int) => (
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
          
          {/* Price Info - Show actual 24hr OHLC from WebSocket */}
          <div className="flex items-center space-x-6 text-xs">
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
        
        {/* Separator between Price and Volume charts */}
        {showVolume && (
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#2a2e39] to-transparent" />
        )}
        
        {/* Volume Chart */}
        {showVolume && (
          <div 
            ref={volumeChartContainerRef} 
            className="w-full"
            style={{ height: Math.floor((height - 40) * 0.3) - 2 }}
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