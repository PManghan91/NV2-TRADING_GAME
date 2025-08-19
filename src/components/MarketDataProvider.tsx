import React, { useEffect, useCallback } from 'react';
import { useMarketStore, useWatchlist } from '../stores/marketStore';
// import { marketDataService } from '../services/MarketDataService';
import { usePriceUpdates } from '../hooks/useWebSocket';
import { MarketPrice } from '../types/trading';

interface MarketDataProviderProps {
  children: React.ReactNode;
}

export const MarketDataProvider: React.FC<MarketDataProviderProps> = ({ children }) => {
  const watchlist = useWatchlist();
  const updatePrice = useMarketStore(state => state.updatePrice);
  const setConnectionStatus = useMarketStore(state => state.setConnectionStatus);

  // Handle incoming price updates
  const handlePriceUpdate = useCallback((price: MarketPrice) => {
    console.log('Received price update:', price.symbol, '$' + price.price.toFixed(2));
    updatePrice(price);
  }, [updatePrice]);

  // Set up price update listener
  usePriceUpdates(handlePriceUpdate);

  useEffect(() => {
    let isInitialized = false;

    const initializeMarketData = async () => {
      if (isInitialized) return;
      
      try {
        console.log('Initializing market data service...');
        
        // DISABLED: API diagnostics - Finnhub WebSocket no longer used
        // await ApiTestService.runDiagnostics();
        
        // Initialize the market data service
        // DISABLED: Finnhub WebSocket - using Binance WebSocket for crypto instead
        // await marketDataService.initialize();
        
        console.log('Market data service initialized successfully');
        
        // DISABLED: Finnhub subscriptions - using Binance WebSocket for crypto instead
        // console.log('Subscribing to watchlist symbols:', watchlist);
        // watchlist.forEach(symbol => {
        //   const success = marketDataService.subscribeToSymbol(symbol);
        //   if (success) {
        //     console.log(`✅ Subscribed to ${symbol}`);
        //   } else {
        //     console.warn(`❌ Failed to subscribe to ${symbol}`);
        //   }
        // });

        // DISABLED: Finnhub historical data - will use REST API or Binance for charts
        // console.log('Fetching historical data...');
        // const promises = watchlist.slice(0, 3).map(async (symbol) => {
        //   try {
        //     const historicalData = await marketDataService.fetchHistoricalData(symbol, 'D');
        //     console.log(`📈 Loaded ${historicalData.length} historical data points for ${symbol}`);
        //   } catch (error) {
        //     console.warn(`Failed to load historical data for ${symbol}:`, error);
        //   }
        // });
        // await Promise.all(promises);
        // console.log('Historical data loading completed');
        
        isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize market data:', error);
        setConnectionStatus('error');
      }
    };

    // Initialize with a small delay to allow components to mount
    const timeout = setTimeout(initializeMarketData, 1000);

    return () => {
      clearTimeout(timeout);
      // DISABLED: Finnhub shutdown
      // if (isInitialized) {
      //   marketDataService.shutdown();
      // }
    };
  }, []); // Empty dependency array - only run once on mount

  // DISABLED: Handle watchlist changes - using Binance WebSocket instead
  // useEffect(() => {
  //   if (!marketDataService.isServiceInitialized()) return;
  //   // Subscribe to new symbols in watchlist
  //   watchlist.forEach(symbol => {
  //     const activeSubscriptions = marketDataService.getActiveSubscriptions();
  //     if (!activeSubscriptions.has(symbol)) {
  //       console.log(`🔔 Adding subscription for new watchlist symbol: ${symbol}`);
  //       marketDataService.subscribeToSymbol(symbol);
  //     }
  //   });
  //   // Note: We don't unsubscribe from removed symbols to keep the connection efficient
  //   // In a production app, you might want to implement cleanup for removed symbols
  // }, [watchlist]);

  return <>{children}</>;
};

// Component to display connection status and stats
export const MarketDataStatus: React.FC = () => {
  const connectionStatus = useMarketStore(state => state.connectionStatus);
  const subscriptions = useMarketStore(state => state.subscriptions);
  const prices = useMarketStore(state => state.prices);

  // Test connection removed - Binance auto-connects

  const getStatusInfo = () => {
    // Count crypto and stock symbols
    const cryptoSymbols = Array.from(subscriptions).filter(s => s.includes('USDT')).length;
    const stockSymbols = Array.from(subscriptions).filter(s => !s.includes('USDT')).length;
    
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'text-trading-green',
          bgColor: 'bg-green-900',
          borderColor: 'border-green-500',
          icon: '🟢',
          message: `Connected - ${cryptoSymbols} crypto (WebSocket) + ${stockSymbols} stocks (REST) = ${prices.size} total prices`
        };
      case 'connecting':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-900',
          borderColor: 'border-yellow-500',
          icon: '🟡',
          message: 'Connecting to Binance WebSocket...'
        };
      case 'disconnected':
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-800',
          borderColor: 'border-gray-500',
          icon: '⚪',
          message: 'Binance WebSocket Disconnected'
        };
      case 'error':
        return {
          color: 'text-trading-red',
          bgColor: 'bg-red-900',
          borderColor: 'border-red-500',
          icon: '🔴',
          message: 'Binance WebSocket Connection Error'
        };
      default:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-800',
          borderColor: 'border-gray-500',
          icon: '⚪',
          message: 'Unknown status'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className={`mb-4 p-3 rounded-lg border-l-4 ${status.bgColor} ${status.borderColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-lg mr-2">{status.icon}</span>
          <span className={`text-sm font-medium ${status.color}`}>
            {status.message}
          </span>
        </div>
        {connectionStatus === 'connecting' && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
        )}
      </div>
      {connectionStatus === 'connected' && prices.size > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Last update: {new Date().toLocaleTimeString()}
        </div>
      )}
      {connectionStatus === 'error' && (
        <div className="mt-2 text-xs text-gray-400">
          Check browser console (F12) for detailed error information
        </div>
      )}
    </div>
  );
};