import React, { useEffect } from 'react';
import { binanceWebSocket } from '../services/BinanceWebSocketService';
import { MarketPrice } from '../types/trading';
import { useMarketStore } from '../stores/marketStore';

// Popular crypto pairs to auto-subscribe
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
  'MATICUSDT'
];

export const BinanceDataProvider: React.FC = () => {
  const updatePrice = useMarketStore(state => state.updatePrice);
  const setConnectionStatus = useMarketStore(state => state.setConnectionStatus);

  useEffect(() => {
    let mounted = true;

    const initializeBinance = async () => {
      if (!mounted) return;

      // Set up handlers
      binanceWebSocket.setHandlers({
        onPriceUpdate: (price: MarketPrice) => {
          updatePrice(price);
        },
        onStatusChange: (status) => {
          // Map Binance status to market store status
          if (status === 'connected') {
            setConnectionStatus('connected');
          } else if (status === 'connecting') {
            setConnectionStatus('connecting');
          } else if (status === 'error') {
            setConnectionStatus('error');
          } else {
            setConnectionStatus('disconnected');
          }
        },
        onError: (error) => {
          console.error('Binance WebSocket error:', error);
        },
      });

      try {
        // Auto-connect to Binance
        console.log('Auto-connecting to Binance WebSocket...');
        await binanceWebSocket.connect();
        
        // Wait a moment for connection to stabilize
        setTimeout(() => {
          if (!mounted) return;
          
          // Subscribe to default crypto pairs and update store
          DEFAULT_CRYPTO_PAIRS.forEach(symbol => {
            binanceWebSocket.subscribe(symbol, 'trade');
            // Add to store's subscriptions
            useMarketStore.getState().addSubscription(symbol);
          });
          
          console.log('✅ Auto-subscribed to crypto pairs:', DEFAULT_CRYPTO_PAIRS);
        }, 500);
        
      } catch (error) {
        console.error('Failed to auto-connect to Binance:', error);
      }
    };

    initializeBinance();

    return () => {
      mounted = false;
      // Don't disconnect on unmount to keep prices flowing
      // binanceWebSocket.disconnect();
    };
  }, [updatePrice, setConnectionStatus]);

  // This component doesn't render anything - it just manages the connection
  return null;
};