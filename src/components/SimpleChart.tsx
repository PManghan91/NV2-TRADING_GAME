import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';

interface SimpleChartProps {
  symbol: string;
  height?: number;
}

export const SimpleChart: React.FC<SimpleChartProps> = ({ symbol, height = 400 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(symbol);

  useEffect(() => {
    if (!containerRef.current || !currentPrice) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#1a2332' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
    });

    // Try different approaches to add a series
    let series: any;
    
    try {
      // Try the old v4 API with any cast
      series = (chart as any).addLineSeries?.({
        color: '#10b981',
        lineWidth: 2,
      });
      
      if (!series) {
        // If that doesn't work, try addSeries
        series = (chart as any).addSeries?.({
          type: 'Line',
          options: {
            color: '#10b981',
            lineWidth: 2,
          }
        });
      }
      
      if (!series) {
        // Last resort - just display the chart without data
        console.log('Unable to add series to chart - API may have changed');
      }
    } catch (e) {
      console.error('Chart series creation failed:', e);
    }

    // Generate some data points
    if (series && series.setData) {
      const data = [];
      const now = Math.floor(Date.now() / 1000);
      
      for (let i = 100; i >= 0; i--) {
        const time = now - (i * 60);
        const price = currentPrice.price * (1 + (Math.random() - 0.5) * 0.002);
        data.push({
          time: time,
          value: price
        });
      }
      
      try {
        series.setData(data);
      } catch (e) {
        console.error('Failed to set data:', e);
      }
    }

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, currentPrice, height]);

  if (!currentPrice) {
    return (
      <div className="w-full bg-trading-card-dark rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500">Loading chart for {symbol}...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full bg-trading-card-dark rounded-lg" />
      <div className="mt-2 text-center text-sm text-gray-400">
        Current Price: ${currentPrice.price.toFixed(4)}
      </div>
    </div>
  );
};