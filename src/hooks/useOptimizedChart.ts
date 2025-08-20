import { useEffect, useRef, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, LineStyle } from 'lightweight-charts';

interface ChartOptions {
  symbol: string;
  interval: string;
  height: number;
  theme: 'light' | 'dark';
}

/**
 * Optimized chart hook with performance improvements:
 * - Throttled updates
 * - Efficient data management
 * - Memory leak prevention
 * - Canvas rendering optimizations
 */
export const useOptimizedChart = (options: ChartOptions) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const dataBufferRef = useRef<any[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Performance constants
  const UPDATE_THROTTLE = 100; // Minimum ms between chart updates
  const MAX_DATA_POINTS = 500; // Maximum data points to keep in memory
  const BATCH_SIZE = 10; // Number of updates to batch before rendering
  
  // Memoized chart configuration
  const chartConfig = useMemo(() => ({
    width: 0, // Will be set dynamically
    height: options.height,
    layout: {
      background: { type: ColorType.Solid, color: options.theme === 'dark' ? '#131722' : '#ffffff' },
      textColor: options.theme === 'dark' ? '#d1d4dc' : '#2a2e39',
    },
    rightPriceScale: {
      borderVisible: false,
      autoScale: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    },
    timeScale: {
      borderVisible: false,
      rightOffset: 5,
      barSpacing: 6,
      fixLeftEdge: false,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
    crosshair: {
      vertLine: {
        width: 1 as const,
        color: '#434651',
        style: LineStyle.Dashed,
      },
      horzLine: {
        width: 1 as const,
        color: '#434651',
        style: LineStyle.Dashed,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
      mouseWheel: true,
      pinch: true,
    },
  }), [options.height, options.theme]);

  /**
   * Initialize chart with optimizations
   */
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    // Create new chart with performance optimizations
    const chart = createChart(chartContainerRef.current, {
      ...chartConfig,
      width: chartContainerRef.current.clientWidth,
    });

    // Use candlestick series for better performance with OHLC data
    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Enable hardware acceleration
    const canvas = chartContainerRef.current.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false; // Disable antialiasing for better performance
      }
    }

    return chart;
  }, [chartConfig]);

  /**
   * Throttled chart update function
   */
  const updateChart = useCallback((newData: any) => {
    const now = Date.now();
    
    // Throttle updates
    if (now - lastUpdateRef.current < UPDATE_THROTTLE) {
      // Buffer the data for later update
      dataBufferRef.current.push(newData);
      
      // Schedule update if not already scheduled
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          flushDataBuffer();
          animationFrameRef.current = null;
        });
      }
      return;
    }

    lastUpdateRef.current = now;
    
    // Apply update immediately
    if (seriesRef.current) {
      seriesRef.current.update(newData);
    }
  }, []);

  /**
   * Flush buffered data to chart
   */
  const flushDataBuffer = useCallback(() => {
    if (dataBufferRef.current.length === 0 || !seriesRef.current) return;

    // Process buffered data
    const buffer = [...dataBufferRef.current];
    dataBufferRef.current = [];

    // Update chart with the latest data point only (to avoid redundant updates)
    if (buffer.length > 0) {
      const latestData = buffer[buffer.length - 1];
      seriesRef.current.update(latestData);
    }

    lastUpdateRef.current = Date.now();
  }, []);

  /**
   * Set chart data with performance optimizations
   */
  const setChartData = useCallback((data: any[]) => {
    if (!seriesRef.current) return;

    // Limit data points for performance
    const trimmedData = data.length > MAX_DATA_POINTS 
      ? data.slice(-MAX_DATA_POINTS)
      : data;

    // Use setData for bulk updates (more efficient than individual updates)
    seriesRef.current.setData(trimmedData);

    // Fit content with animation disabled for better performance
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  /**
   * Handle window resize efficiently
   */
  const handleResize = useCallback(() => {
    if (!chartRef.current || !chartContainerRef.current) return;

    // Debounced resize
    const width = chartContainerRef.current.clientWidth;
    chartRef.current.applyOptions({ width });
  }, []);

  /**
   * Cleanup function to prevent memory leaks
   */
  const cleanup = useCallback(() => {
    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear data buffer
    dataBufferRef.current = [];

    // Remove chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }
  }, []);

  // Initialize chart on mount
  useEffect(() => {
    const chart = initializeChart();
    
    if (!chart) return;

    // Set up resize observer for better performance than window resize event
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      cleanup();
    };
  }, [initializeChart, handleResize, cleanup]);

  // Handle symbol or interval changes
  useEffect(() => {
    // Clear data when symbol or interval changes
    dataBufferRef.current = [];
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
  }, [options.symbol, options.interval]);

  return {
    chartContainerRef,
    updateChart,
    setChartData,
    cleanup,
  };
};

/**
 * Performance monitoring hook for charts
 */
export const useChartPerformanceMonitor = () => {
  const metricsRef = useRef({
    updateCount: 0,
    totalUpdateTime: 0,
    lastUpdateTime: 0,
    fps: 0,
  });

  const fpsIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const calculateFPS = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      metricsRef.current.fps = Math.round((frameCount * 1000) / deltaTime);
      
      frameCount = 0;
      lastTime = currentTime;
    };

    // Monitor FPS
    fpsIntervalRef.current = window.setInterval(calculateFPS, 1000);

    // Monitor frame updates
    const monitorFrame = () => {
      frameCount++;
      requestAnimationFrame(monitorFrame);
    };
    
    requestAnimationFrame(monitorFrame);

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);

  const logPerformance = useCallback(() => {
    const metrics = metricsRef.current;
    console.log('Chart Performance Metrics:', {
      fps: metrics.fps,
      avgUpdateTime: metrics.updateCount > 0 
        ? (metrics.totalUpdateTime / metrics.updateCount).toFixed(2) + 'ms'
        : '0ms',
      updateCount: metrics.updateCount,
    });
  }, []);

  return {
    metrics: metricsRef.current,
    logPerformance,
  };
};