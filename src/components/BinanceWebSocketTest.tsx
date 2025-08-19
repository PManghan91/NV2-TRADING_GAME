import React, { useState, useEffect } from 'react';
import { binanceWebSocket } from '../services/BinanceWebSocketService';
import { MarketPrice } from '../types/trading';

export const BinanceWebSocketTest: React.FC = () => {
  const [status, setStatus] = useState<string>('disconnected');
  const [prices, setPrices] = useState<Map<string, MarketPrice>>(new Map());
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const popularPairs = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'BNBUSDT', name: 'Binance Coin' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'ADAUSDT', name: 'Cardano' },
  ];
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    // Set up handlers
    binanceWebSocket.setHandlers({
      onPriceUpdate: (price: MarketPrice) => {
        setPrices(prev => {
          const newPrices = new Map(prev);
          newPrices.set(price.symbol, price);
          return newPrices;
        });
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        setIsConnected(newStatus === 'connected');
        addLog(`Status: ${newStatus}`);
      },
      onError: (error) => {
        addLog(`Error: ${error.message}`);
      },
    });
  }, []);

  const connectBinance = async () => {
    addLog('Connecting to Binance WebSocket...');
    try {
      await binanceWebSocket.connect();
      addLog('✅ Connected to Binance!');
      
      // Subscribe to popular crypto pairs
      setTimeout(() => {
        popularPairs.forEach(pair => {
          binanceWebSocket.subscribe(pair.symbol, 'trade');
          addLog(`Subscribed to ${pair.symbol}`);
        });
      }, 500);
    } catch (error) {
      addLog(`❌ Connection failed: ${error}`);
    }
  };

  const disconnectBinance = () => {
    binanceWebSocket.disconnect();
    setPrices(new Map());
    addLog('Disconnected from Binance');
  };

  const subscribeTicker = (symbol: string) => {
    binanceWebSocket.subscribe(symbol, 'ticker');
    addLog(`Subscribed to ${symbol} ticker`);
  };

  const formatPrice = (price: number): string => {
    if (price > 1000) return price.toFixed(2);
    if (price > 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Binance WebSocket Test</h3>
        <div className={`px-3 py-1 rounded text-sm font-semibold ${
          status === 'connected' ? 'bg-green-600 text-white' : 
          status === 'connecting' ? 'bg-yellow-600 text-white' : 
          status === 'error' ? 'bg-red-600 text-white' : 
          'bg-gray-600 text-white'
        }`}>
          {status.toUpperCase()}
        </div>
      </div>
      
      <div className="mb-4 p-3 bg-green-900 rounded">
        <p className="text-green-200 text-sm">
          ✅ <strong>Binance WebSocket is FREE</strong> - No API key required!
        </p>
        <p className="text-green-200 text-xs mt-1">
          Real-time cryptocurrency prices with no rate limits
        </p>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={connectBinance}
          disabled={isConnected}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          Connect to Binance
        </button>
        <button
          onClick={disconnectBinance}
          disabled={!isConnected}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      
      {/* Live Prices */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-white mb-2">Live Crypto Prices</h4>
        <div className="bg-black rounded p-3 max-h-48 overflow-y-auto">
          {prices.size === 0 ? (
            <div className="text-gray-500 text-xs">
              {isConnected ? 'Waiting for price updates...' : 'Connect to see live prices'}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from(prices.entries()).map(([symbol, price]) => {
                const pair = popularPairs.find(p => p.symbol === symbol);
                return (
                  <div key={symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">{pair?.name || symbol}</span>
                      <span className="text-xs text-gray-500">({symbol})</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-white">
                        ${formatPrice(price.price)}
                      </span>
                      {price.changePercent !== 0 && (
                        <span className={`text-xs font-mono ${
                          price.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Additional Subscriptions */}
      {isConnected && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-white mb-2">Subscribe to More</h4>
          <div className="flex flex-wrap gap-1">
            {['XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'].map(symbol => (
              <button
                key={symbol}
                onClick={() => subscribeTicker(symbol)}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Connection Logs */}
      <div className="bg-black rounded p-2 max-h-32 overflow-y-auto">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">Connection Logs</h4>
        <div className="space-y-0.5">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-xs">No logs yet</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-xs font-mono text-gray-300">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};