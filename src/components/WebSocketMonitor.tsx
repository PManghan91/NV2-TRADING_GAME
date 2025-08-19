import React, { useState, useEffect } from 'react';
import { wsManager } from '../services/WebSocketManager';
import { useMarketStore } from '../stores/marketStore';

export const WebSocketMonitor: React.FC = () => {
  const [status, setStatus] = useState(wsManager.getConnectionStatus());
  const [isConnected, setIsConnected] = useState(wsManager.isConnected());
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const connectionStatus = useMarketStore(state => state.connectionStatus);
  const prices = useMarketStore(state => state.prices);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(wsManager.getConnectionStatus());
      setIsConnected(wsManager.isConnected());
      setSubscriptions(Array.from(wsManager.getSubscriptions()));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleConnect = async () => {
    try {
      console.log('Attempting to connect WebSocketManager...');
      await wsManager.connect();
      console.log('WebSocketManager connected!');
    } catch (error) {
      console.error('WebSocketManager connection failed:', error);
    }
  };
  
  const handleDisconnect = () => {
    wsManager.disconnect();
  };
  
  const handleSubscribe = (symbol: string) => {
    const success = wsManager.subscribe(symbol);
    console.log(`Subscribe to ${symbol}: ${success ? 'Success' : 'Failed'}`);
  };
  
  return (
    <div className="trading-card">
      <h3 className="text-lg font-semibold text-white mb-4">WebSocket Monitor</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-trading-bg rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Manager Status</div>
          <div className={`font-mono font-semibold ${
            status === 'connected' ? 'text-green-400' : 
            status === 'connecting' ? 'text-yellow-400' : 
            status === 'error' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {status.toUpperCase()}
          </div>
        </div>
        
        <div className="bg-trading-bg rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Store Status</div>
          <div className={`font-mono font-semibold ${
            connectionStatus === 'connected' ? 'text-green-400' : 
            connectionStatus === 'connecting' ? 'text-yellow-400' : 
            connectionStatus === 'error' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {connectionStatus.toUpperCase()}
          </div>
        </div>
        
        <div className="bg-trading-bg rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Socket Open</div>
          <div className={`font-mono font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'YES' : 'NO'}
          </div>
        </div>
        
        <div className="bg-trading-bg rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Active Prices</div>
          <div className="font-mono font-semibold text-white">
            {prices.size}
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Active Subscriptions ({subscriptions.length})</div>
        <div className="bg-black rounded p-2 max-h-24 overflow-y-auto">
          {subscriptions.length === 0 ? (
            <div className="text-gray-500 text-xs">No active subscriptions</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {subscriptions.map(symbol => (
                <span key={symbol} className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded">
                  {symbol}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Live Prices</div>
        <div className="bg-black rounded p-2 max-h-32 overflow-y-auto">
          {prices.size === 0 ? (
            <div className="text-gray-500 text-xs">No price data yet</div>
          ) : (
            <div className="space-y-1">
              {Array.from(prices.entries()).slice(0, 5).map(([symbol, price]) => (
                <div key={symbol} className="flex justify-between text-xs">
                  <span className="text-gray-300">{symbol}</span>
                  <span className="font-mono text-white">${price.price.toFixed(2)}</span>
                  <span className={price.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleConnect}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          Connect
        </button>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Disconnect
        </button>
        <button
          onClick={() => handleSubscribe('AAPL')}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Subscribe AAPL
        </button>
      </div>
      
      <div className="text-xs text-gray-400">
        <div>• Manager Status: Direct from WebSocketManager</div>
        <div>• Store Status: From Zustand store</div>
        <div>• Socket Open: wsManager.isConnected()</div>
        <div>• Refresh rate: 1 second</div>
      </div>
    </div>
  );
};