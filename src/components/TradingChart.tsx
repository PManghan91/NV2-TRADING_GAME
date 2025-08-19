import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';
import { useMarketStore, useChartData } from '../stores/marketStore';
import { OHLCData } from '../types/trading';

interface TradingChartProps {
  symbol: string;
  height?: number;
}

interface ChartSettings {
  interval: string;
  chartType: 'candlestick' | 'line' | 'area';
  showVolume: boolean;
  indicators: {
    sma: { enabled: boolean; period: number; color: string };
    ema: { enabled: boolean; period: number; color: string };
    rsi: { enabled: boolean; period: number; overbought: number; oversold: number };
    macd: { enabled: boolean; fastPeriod: number; slowPeriod: number; signalPeriod: number };
    bollinger: { enabled: boolean; period: number; stdDev: number };
  };
}

export const TradingChart: React.FC<TradingChartProps> = ({ symbol, height = 400 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  const chartData = useChartData(symbol);
  const prices = useMarketStore(state => state.prices);
  
  const [settings, setSettings] = useState<ChartSettings>({
    interval: 'D',
    chartType: 'candlestick',
    showVolume: true,
    indicators: {
      sma: { enabled: false, period: 20, color: '#2196F3' },
      ema: { enabled: false, period: 12, color: '#FF9800' },
      rsi: { enabled: false, period: 14, overbought: 70, oversold: 30 },
      macd: { enabled: false, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollinger: { enabled: false, period: 20, stdDev: 2 },
    },
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#1a2332' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#2d3748' },
        horzLines: { color: '#2d3748' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#485c7b',
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
    });

    chartRef.current = chart;

    // Try to add candlestick series with fallback
    try {
      // For LightweightCharts v5, try the new API
      const candlestickSeries = (chart as any).addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
      });
      candlestickSeriesRef.current = candlestickSeries;
    } catch (error) {
      console.log('Candlestick series creation failed, chart will show without data visualization');
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Update chart data
  useEffect(() => {
    if (!chartData || !candlestickSeriesRef.current) return;

    try {
      const formattedData = chartData.map((item: OHLCData) => ({
        time: Math.floor(item.time / 1000) as any,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      candlestickSeriesRef.current.setData(formattedData);
    } catch (error) {
      console.log('Chart data update failed:', error);
    }
  }, [chartData]);

  // Real-time price updates
  useEffect(() => {
    const currentPrice = prices.get(symbol);
    if (!currentPrice || !candlestickSeriesRef.current) return;

    try {
      // Update the last candle with current price (simplified)
      const lastTime = Math.floor(Date.now() / 1000);
      candlestickSeriesRef.current.update({
        time: lastTime as any,
        open: currentPrice.price,
        high: currentPrice.price,
        low: currentPrice.price,
        close: currentPrice.price,
      });
    } catch (error) {
      console.log('Real-time price update failed:', error);
    }
  }, [prices, symbol]);

  const toggleIndicator = (indicator: keyof ChartSettings['indicators']) => {
    setSettings(prev => ({
      ...prev,
      indicators: {
        ...prev.indicators,
        [indicator]: {
          ...prev.indicators[indicator],
          enabled: !prev.indicators[indicator].enabled,
        },
      },
    }));
  };

  const changeInterval = (interval: string) => {
    setSettings(prev => ({ ...prev, interval }));
    // Trigger data refetch for new interval
    // This would typically call marketDataService.fetchHistoricalData(symbol, interval)
  };

  return (
    <div className="trading-card">
      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">{symbol} Chart</h3>
          <div className="flex space-x-2">
            {['1', '5', '15', '30', '60', 'D'].map((interval) => (
              <button
                key={interval}
                onClick={() => changeInterval(interval)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  settings.interval === interval
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {interval === 'D' ? '1D' : `${interval}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Indicator Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleIndicator('sma')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              settings.indicators.sma.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            SMA
          </button>
          <button
            onClick={() => toggleIndicator('ema')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              settings.indicators.ema.enabled
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            EMA
          </button>
          <button
            onClick={() => toggleIndicator('bollinger')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              settings.indicators.bollinger.enabled
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            BB
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />

      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400 flex justify-between">
        <span>
          {chartData ? `${chartData.length} data points` : 'Loading...'}
        </span>
        <span>
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};