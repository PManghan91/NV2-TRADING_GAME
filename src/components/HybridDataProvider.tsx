import React, { useEffect } from 'react';
import { binanceWebSocket } from '../services/BinanceWebSocketService';
import { stockDataService, DEFAULT_STOCK_SYMBOLS } from '../services/StockDataService';
import { MarketPrice } from '../types/trading';
import { useMarketStore } from '../stores/marketStore';

// Crypto pairs to auto-subscribe - include all that we show in trading
const DEFAULT_CRYPTO_PAIRS = [
  'BTCUSDT',
  'ETHUSDT', 
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'MATICUSDT',
];

export const HybridDataProvider: React.FC = () => {
  const updatePrice = useMarketStore(state => state.updatePrice);
  const setConnectionStatus = useMarketStore(state => state.setConnectionStatus);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const initializeDataServices = async () => {
      if (!mounted) return;

      // 1. Initialize Binance WebSocket for crypto
      binanceWebSocket.setHandlers({
        onPriceUpdate: (price: MarketPrice) => {
          // ONLY track price, don't let PriceHistoryService calculate percentages
          // priceHistoryService.updatePrice(price.symbol, price.price); // DISABLED - causes percentage overwrites
          
          // Pass through data directly from Binance
          updatePrice(price);
        },
        onStatusChange: (status) => {
          // Only update to connected when both services are running
          if (status === 'connected' && stockDataService.isRunning()) {
            setConnectionStatus('connected');
          } else if (status === 'connecting') {
            setConnectionStatus('connecting');
          } else if (status === 'error') {
            setConnectionStatus('error');
          } else if (status === 'disconnected') {
            setConnectionStatus('disconnected');
          }
        },
        onError: (error) => {
          console.error('Binance WebSocket error:', error);
        },
      });

      try {
        // Connect to Binance
        console.log('Connecting to Binance WebSocket...');
        await binanceWebSocket.connect();
        
        // Wait for connection to stabilize
        setTimeout(() => {
          if (!mounted) return;
          
          // Subscribe to all crypto pairs through the service's batching mechanism
          DEFAULT_CRYPTO_PAIRS.forEach(symbol => {
            binanceWebSocket.subscribe(symbol, 'ticker');
            useMarketStore.getState().addSubscription(symbol);
          });
          
          console.log('✅ Queued subscriptions for', DEFAULT_CRYPTO_PAIRS.length, 'crypto pairs');
          
          console.log('✅ Subscribed to crypto pairs:', DEFAULT_CRYPTO_PAIRS);
          
          // No REST API fallback - WebSocket only
          console.log('✅ WebSocket-only mode - no REST API fallback');
        }, 500);
        
      } catch (error) {
        console.error('Failed to connect to Binance:', error);
      }

      // 2. Start polling for stock data
      console.log('Starting stock data polling...');
      stockDataService.startPolling(DEFAULT_STOCK_SYMBOLS);
      
      // Add stock symbols to subscriptions
      DEFAULT_STOCK_SYMBOLS.forEach(symbol => {
        useMarketStore.getState().addSubscription(symbol);
      });
      
      // Set overall status to connected
      setTimeout(() => {
        if (mounted && binanceWebSocket.getConnectionStatus()) {
          setConnectionStatus('connected');
        }
      }, 1000);
      
      // Set up periodic connection check only
      refreshInterval = setInterval(() => {
        if (!mounted) return;
        
        // Check if WebSocket is still connected
        if (!binanceWebSocket.getConnectionStatus()) {
          console.log('WebSocket disconnected, attempting to reconnect...');
          setConnectionStatus('disconnected');
          binanceWebSocket.forceReconnect();
        }
      }, 30000); // Check connection every 30 seconds
    };

    initializeDataServices();

    return () => {
      mounted = false;
      // Clear refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      // Stop stock polling on unmount
      stockDataService.stopPolling();
      // Keep Binance connected for other components
    };
  }, [updatePrice, setConnectionStatus]);

  // This component doesn't render anything
  return null;
};