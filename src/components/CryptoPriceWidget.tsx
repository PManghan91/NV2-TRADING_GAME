import React from 'react';
import { useMarketStore } from '../stores/marketStore';

const CRYPTO_DISPLAY_CONFIG = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
  { symbol: 'BNBUSDT', name: 'BNB', icon: 'B' },
  { symbol: 'SOLUSDT', name: 'Solana', icon: 'S' },
  { symbol: 'ADAUSDT', name: 'Cardano', icon: 'A' },
];

export const CryptoPriceWidget: React.FC = () => {
  const prices = useMarketStore(state => state.prices);
  const connectionStatus = useMarketStore(state => state.connectionStatus);

  const formatPrice = (price: number): string => {
    if (price > 1000) return price.toFixed(2);
    if (price > 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  if (connectionStatus !== 'connected' || prices.size === 0) {
    return (
      <div className="trading-card">
        <h2 className="text-lg font-semibold mb-4 text-white">Crypto Markets</h2>
        <div className="text-center py-8 text-gray-500">
          {connectionStatus === 'connecting' ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Connecting to market data...</span>
            </div>
          ) : (
            'Waiting for market data...'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Crypto Markets</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {CRYPTO_DISPLAY_CONFIG.map(crypto => {
          const priceData = prices.get(crypto.symbol);
          
          if (!priceData) {
            return (
              <div key={crypto.symbol} className="bg-trading-card-dark rounded-lg p-3">
                <div className="flex items-center space-x-1 mb-1">
                  <span className="text-sm">{crypto.icon}</span>
                  <span className="text-xs text-gray-400">{crypto.name}</span>
                </div>
                <div className="text-sm text-gray-500">Loading...</div>
              </div>
            );
          }

          const isPositive = priceData.changePercent >= 0;

          return (
            <div key={crypto.symbol} className="bg-trading-card-dark rounded-lg p-3 hover:bg-opacity-80 transition-colors cursor-pointer">
              <div className="flex items-center space-x-1 mb-1">
                <span className="text-sm">{crypto.icon}</span>
                <span className="text-xs text-gray-400">{crypto.name}</span>
              </div>
              <div className="text-lg font-mono font-bold text-white">
                ${formatPrice(priceData.price)}
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs font-mono mt-1">
                <span className={priceData.change15m !== undefined ? (priceData.change15m >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-gray-500'}>
                  15m: {priceData.change15m !== undefined ? `${priceData.change15m >= 0 ? '+' : ''}${priceData.change15m.toFixed(2)}%` : '---'}
                </span>
                <span className={priceData.change1h !== undefined ? (priceData.change1h >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-gray-500'}>
                  1h: {priceData.change1h !== undefined ? `${priceData.change1h >= 0 ? '+' : ''}${priceData.change1h.toFixed(2)}%` : '---'}
                </span>
                <span className={priceData.change24h !== undefined ? (priceData.change24h >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-gray-500'}>
                  24h: {priceData.change24h !== undefined ? `${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%` : '---'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Extended crypto list */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          {['XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'].map(symbol => {
            const priceData = prices.get(symbol);
            if (!priceData) return null;

            const isPositive = priceData.changePercent >= 0;
            const displayName = symbol.replace('USDT', '');

            return (
              <div key={symbol} className="flex items-center justify-between p-2 bg-black bg-opacity-30 rounded">
                <span className="text-gray-400">{displayName}</span>
                <div className="text-right">
                  <div className="font-mono text-white">${formatPrice(priceData.price)}</div>
                  <div className={`font-mono ${isPositive ? 'text-trading-green' : 'text-trading-red'}`}>
                    {formatChange(priceData.changePercent)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};