import { useEffect, useCallback, useState } from 'react';
import { wsManager, WSConnectionStatus, WSMessageHandler } from '../services/WebSocketManager';
import { MarketPrice } from '../types/trading';

interface UseWebSocketReturn {
  connectionStatus: WSConnectionStatus;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (symbol: string) => boolean;
  unsubscribe: (symbol: string) => boolean;
  subscriptions: Set<string>;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [connectionStatus, setConnectionStatus] = useState<WSConnectionStatus>(
    wsManager.getConnectionStatus()
  );
  const [subscriptions, setSubscriptions] = useState<Set<string>>(
    wsManager.getSubscriptions()
  );

  useEffect(() => {
    // Set up status change handler
    const handleStatusChange = (status: WSConnectionStatus) => {
      setConnectionStatus(status);
    };

    wsManager.setStatusChangeHandler(handleStatusChange);

    // Update subscriptions periodically
    const interval = setInterval(() => {
      setSubscriptions(new Set(wsManager.getSubscriptions()));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      await wsManager.connect();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  const subscribe = useCallback((symbol: string) => {
    const result = wsManager.subscribe(symbol);
    setSubscriptions(new Set(wsManager.getSubscriptions()));
    return result;
  }, []);

  const unsubscribe = useCallback((symbol: string) => {
    const result = wsManager.unsubscribe(symbol);
    setSubscriptions(new Set(wsManager.getSubscriptions()));
    return result;
  }, []);

  const isConnected = connectionStatus === 'connected';

  return {
    connectionStatus,
    isConnected,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    subscriptions,
  };
};

// Hook for listening to price updates
export const usePriceUpdates = (
  callback: (price: MarketPrice) => void,
  dependencies: React.DependencyList = []
): void => {
  useEffect(() => {
    const handler: WSMessageHandler = (data: MarketPrice) => {
      callback(data);
    };

    wsManager.addMessageHandler('price', handler);

    return () => {
      wsManager.removeMessageHandler('price', handler);
    };
  }, dependencies);
};

// Hook for listening to any WebSocket message type
export const useWebSocketMessage = (
  messageType: string,
  callback: (data: any) => void,
  dependencies: React.DependencyList = []
): void => {
  useEffect(() => {
    const handler: WSMessageHandler = callback;

    wsManager.addMessageHandler(messageType, handler);

    return () => {
      wsManager.removeMessageHandler(messageType, handler);
    };
  }, dependencies);
};