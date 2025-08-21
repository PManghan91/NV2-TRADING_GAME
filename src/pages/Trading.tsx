import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../stores/marketStore';
import { binanceWebSocket } from '../services/BinanceWebSocketService';
import { useCurrency } from '../contexts/CurrencyContext';

// Import components
import { TradingViewProfessionalChart } from '../components/TradingViewProfessionalChart';
import { SymbolSelector } from '../components/SymbolSelector';
import { createSymbolInfo, getSymbolDisplay, SymbolInfo as EnhancedSymbolInfo } from '../utils/symbolUtils';

// Use the enhanced SymbolInfo from symbolUtils
type SymbolInfo = EnhancedSymbolInfo;


const AVAILABLE_SYMBOLS: SymbolInfo[] = [
  // Crypto
  createSymbolInfo('BTCUSDT', 'Bitcoin', 'crypto', '₿'),
  createSymbolInfo('ETHUSDT', 'Ethereum', 'crypto', 'Ξ'),
  createSymbolInfo('BNBUSDT', 'BNB', 'crypto', 'B'),
  createSymbolInfo('SOLUSDT', 'Solana', 'crypto', 'S'),
  // Stocks
  createSymbolInfo('AAPL', 'Apple', 'stock', '🍎'),
  createSymbolInfo('MSFT', 'Microsoft', 'stock', '💻'),
  createSymbolInfo('GOOGL', 'Google', 'stock', '🔍'),
  createSymbolInfo('TSLA', 'Tesla', 'stock', '🚗'),
];


export const Trading: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolInfo>(AVAILABLE_SYMBOLS[0]);
  const connectionStatus = useMarketStore(state => state.connectionStatus);
  const { currency, formatPrice } = useCurrency();
  
  // Create currency-aware symbol list for display
  const getDisplaySymbols = (): (SymbolInfo & { displaySymbol: string })[] => {
    return AVAILABLE_SYMBOLS.map(symbol => ({
      ...symbol,
      displaySymbol: getSymbolDisplay(symbol, currency.code)
    }));
  };
  
  // Ensure WebSocket connection and data initialization on component mount
  useEffect(() => {
    console.log('Trading component mounted - initializing WebSocket and data');
    
    // Always force WebSocket connection to ensure it's active for the Trading page
    // This handles cases where user navigates directly to /trading on refresh
    console.log('Ensuring WebSocket connection for Trading page...');
    binanceWebSocket.forceReconnect();
    
    // Subscribe to all default crypto symbols immediately
    const defaultCryptoSymbols = AVAILABLE_SYMBOLS
      .filter(s => s.type === 'crypto')
      .map(s => s.symbol);
    
    defaultCryptoSymbols.forEach(symbol => {
      console.log(`Ensuring subscription for ${symbol}`);
      binanceWebSocket.subscribe(symbol, 'ticker');
      useMarketStore.getState().addSubscription(symbol);
    });
    
    // Don't clear chart cache immediately on refresh - let it use cached data while fetching fresh data
    // This prevents the chart from appearing empty
  }, []); // Run only once on mount
  
  // Ensure WebSocket subscription and historical data for selected symbol
  useEffect(() => {
    if (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT')) {
      // Always try to subscribe (the service handles duplicates)
      console.log(`📡 Ensuring subscription for symbol: ${selectedSymbol.symbol}`);
      binanceWebSocket.subscribe(selectedSymbol.symbol, 'ticker');
      useMarketStore.getState().addSubscription(selectedSymbol.symbol);
      
      // Fetch historical data for the selected symbol with multiple retry attempts
      const updateHistoricalData = useMarketStore.getState().updateHistoricalData;
      
      // Immediate attempt
      updateHistoricalData(selectedSymbol.symbol);
      
      // Multiple retry attempts to handle refresh scenarios
      const retryTimer1 = setTimeout(() => {
        console.log(`🔄 Retry 1: historical data fetch for ${selectedSymbol.symbol}`);
        updateHistoricalData(selectedSymbol.symbol);
      }, 1000);
      
      const retryTimer2 = setTimeout(() => {
        console.log(`🔄 Retry 2: historical data fetch for ${selectedSymbol.symbol}`);
        updateHistoricalData(selectedSymbol.symbol);
      }, 3000);
      
      const retryTimer3 = setTimeout(() => {
        console.log(`🔄 Retry 3: historical data fetch for ${selectedSymbol.symbol}`);
        updateHistoricalData(selectedSymbol.symbol);
      }, 5000);
      
      return () => {
        clearTimeout(retryTimer1);
        clearTimeout(retryTimer2);
        clearTimeout(retryTimer3);
      };
    }
  }, [selectedSymbol, connectionStatus]);

  // Batch update historical data for all crypto symbols on component mount
  useEffect(() => {
    const cryptoSymbols = AVAILABLE_SYMBOLS
      .filter(s => s.type === 'crypto')
      .map(s => s.symbol);
    
    if (cryptoSymbols.length > 0) {
      console.log('Batch updating historical data for all crypto symbols on page load');
      const batchUpdateHistoricalData = useMarketStore.getState().batchUpdateHistoricalData;
      
      // Multiple attempts to ensure historical data loads properly on refresh
      const timer1 = setTimeout(() => {
        console.log('Batch update attempt 1');
        batchUpdateHistoricalData(cryptoSymbols);
      }, 500);
      
      const timer2 = setTimeout(() => {
        console.log('Batch update attempt 2');
        batchUpdateHistoricalData(cryptoSymbols);
      }, 2000);
      
      const timer3 = setTimeout(() => {
        console.log('Batch update attempt 3 (final)');
        batchUpdateHistoricalData(cryptoSymbols);
      }, 4000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, []); // Run only once on mount
  
  // Rate limiting for price ticker updates (250ms = 4 updates per second)
  // const lastPriceUpdateRef = React.useRef<number>(0);
  // const PRICE_UPDATE_INTERVAL = 250;
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [portfolio, setPortfolio] = useState({
    cash: 100000,
    positions: [] as any[],
    trades: [] as any[]
  });

  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(selectedSymbol.symbol);
  
  // Use real historical data from the market store
  const enrichedCurrentPrice = currentPrice;
  
  // Debug: Log when symbol changes
  React.useEffect(() => {
    console.log('Selected symbol changed to:', selectedSymbol.symbol);
    console.log('Current price for', selectedSymbol.symbol, ':', currentPrice);
    console.log('All available prices:', Array.from(prices.keys()));
  }, [selectedSymbol, currentPrice, prices]);

  // Paper trading functions
  const executeTrade = () => {
    if (!currentPrice || !quantity || parseFloat(quantity) <= 0) return;

    const qty = parseFloat(quantity);
    const price = orderType === 'limit' && limitPrice 
      ? parseFloat(limitPrice) 
      : currentPrice.price;

    const totalCost = qty * price;
    
    if (side === 'buy' && totalCost > portfolio.cash) {
      alert('Insufficient funds!');
      return;
    }

    const trade = {
      id: Date.now().toString(),
      symbol: selectedSymbol.symbol,
      name: selectedSymbol.name,
      side,
      quantity: qty,
      price,
      totalValue: totalCost,
      timestamp: new Date().toISOString(),
      type: orderType
    };

    // Update portfolio
    setPortfolio(prev => {
      const newCash = side === 'buy' 
        ? prev.cash - totalCost 
        : prev.cash + totalCost;

      // Update or create position
      const existingPosition = prev.positions.find(p => p.symbol === selectedSymbol.symbol);
      let newPositions = [...prev.positions];

      if (side === 'buy') {
        if (existingPosition) {
          existingPosition.quantity += qty;
          existingPosition.avgPrice = 
            ((existingPosition.avgPrice * (existingPosition.quantity - qty)) + (price * qty)) 
            / existingPosition.quantity;
        } else {
          newPositions.push({
            symbol: selectedSymbol.symbol,
            name: selectedSymbol.name,
            quantity: qty,
            avgPrice: price,
            type: selectedSymbol.type
          });
        }
      } else {
        if (existingPosition) {
          existingPosition.quantity -= qty;
          if (existingPosition.quantity <= 0) {
            newPositions = newPositions.filter(p => p.symbol !== selectedSymbol.symbol);
          }
        }
      }

      return {
        cash: newCash,
        positions: newPositions,
        trades: [trade, ...prev.trades].slice(0, 50) // Keep last 50 trades
      };
    });

    // Reset form
    setQuantity('1');
    setLimitPrice('');
    setStopPrice('');
    
    // Show success message
    const message = `${side.toUpperCase()} ${qty} ${selectedSymbol.name} @ $${price.toFixed(2)}`;
    console.log('Trade executed:', message);
  };

  // Calculate portfolio value
  const calculatePortfolioValue = () => {
    let totalValue = portfolio.cash;
    portfolio.positions.forEach(position => {
      const currentPrice = prices.get(position.symbol);
      if (currentPrice) {
        totalValue += position.quantity * currentPrice.price;
      }
    });
    return totalValue;
  };

  const totalValue = calculatePortfolioValue();
  const totalPL = totalValue - 100000; // Initial cash was 100k
  const totalPLPercent = (totalPL / 100000) * 100;

  return (
    <div className="min-h-screen bg-trading-bg">
      {/* Header */}
      <div className="bg-trading-surface border-b border-trading-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-white">Trading Terminal</h1>
            
            {/* Symbol Selector */}
            <SymbolSelector
              symbols={getDisplaySymbols()}
              selectedSymbol={{
                ...selectedSymbol,
                displaySymbol: getSymbolDisplay(selectedSymbol, currency.code)
              }}
              onSymbolChange={(symbol) => {
                // Find the original symbol without displaySymbol for state
                const originalSymbol = AVAILABLE_SYMBOLS.find(s => s.symbol === symbol.symbol);
                if (originalSymbol) {
                  setSelectedSymbol(originalSymbol);
                }
              }}
              currency={currency}
            />

            {/* Current Price Display */}
            {connectionStatus === 'error' || connectionStatus === 'disconnected' ? (
              <div className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-900/50 rounded-lg">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 font-medium">
                  {connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
                </span>
                <button
                  onClick={() => {
                    console.log('Manual reconnect triggered');
                    binanceWebSocket.forceReconnect();
                  }}
                  className="ml-2 px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Reconnect
                </button>
              </div>
            ) : connectionStatus === 'connecting' ? (
              <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
                <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-yellow-400 font-medium">Connecting...</span>
              </div>
            ) : currentPrice ? (
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-gray-400 text-sm">Price</span>
                  <div className="text-xl font-bold text-white">
                    {formatPrice(currentPrice.price, selectedSymbol.type === 'crypto' ? 4 : 2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">24h</span>
                  <div className={`text-lg font-semibold ${
                    (enrichedCurrentPrice?.change24h !== undefined ? enrichedCurrentPrice.change24h : enrichedCurrentPrice?.changePercent ?? 0) >= 0 
                      ? 'text-trading-green' 
                      : 'text-trading-red'
                  }`}>
                    {(() => {
                      const change = enrichedCurrentPrice?.change24h !== undefined ? enrichedCurrentPrice.change24h : enrichedCurrentPrice?.changePercent ?? 0;
                      return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">7d</span>
                  <div className={`text-lg font-semibold ${
                    enrichedCurrentPrice?.change7d !== undefined 
                      ? (enrichedCurrentPrice.change7d >= 0 ? 'text-trading-green' : 'text-trading-red')
                      : 'text-gray-500'
                  }`}>
                    {enrichedCurrentPrice?.change7d !== undefined 
                      ? `${enrichedCurrentPrice.change7d >= 0 ? '+' : ''}${enrichedCurrentPrice.change7d.toFixed(2)}%`
                      : (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT') ? 'Loading...' : 'N/A')
                    }
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">30d</span>
                  <div className={`text-lg font-semibold ${
                    enrichedCurrentPrice?.change30d !== undefined 
                      ? (enrichedCurrentPrice.change30d >= 0 ? 'text-trading-green' : 'text-trading-red')
                      : 'text-gray-500'
                  }`}>
                    {enrichedCurrentPrice?.change30d !== undefined 
                      ? `${enrichedCurrentPrice.change30d >= 0 ? '+' : ''}${enrichedCurrentPrice.change30d.toFixed(2)}%`
                      : (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT') ? 'Loading...' : 'N/A')
                    }
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">90d</span>
                  <div className={`text-lg font-semibold ${
                    enrichedCurrentPrice?.change90d !== undefined 
                      ? (enrichedCurrentPrice.change90d >= 0 ? 'text-trading-green' : 'text-trading-red')
                      : 'text-gray-500'
                  }`}>
                    {enrichedCurrentPrice?.change90d !== undefined 
                      ? `${enrichedCurrentPrice.change90d >= 0 ? '+' : ''}${enrichedCurrentPrice.change90d.toFixed(2)}%`
                      : (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT') ? 'Loading...' : 'N/A')
                    }
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">1y</span>
                  <div className={`text-lg font-semibold ${
                    enrichedCurrentPrice?.change1y !== undefined 
                      ? (enrichedCurrentPrice.change1y >= 0 ? 'text-trading-green' : 'text-trading-red')
                      : 'text-gray-500'
                  }`}>
                    {enrichedCurrentPrice?.change1y !== undefined 
                      ? `${enrichedCurrentPrice.change1y >= 0 ? '+' : ''}${enrichedCurrentPrice.change1y.toFixed(2)}%`
                      : (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT') ? 'Loading...' : 'N/A')
                    }
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                <span className="text-gray-400">Waiting for data...</span>
              </div>
            )}
          </div>

          {/* Portfolio Summary */}
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-gray-400 text-sm">Cash Balance</span>
              <div className="text-lg font-semibold text-white">{formatPrice(portfolio.cash)}</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Total Value</span>
              <div className="text-lg font-semibold text-white">{formatPrice(totalValue)}</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Total P&L</span>
              <div className={`text-lg font-semibold ${totalPL >= 0 ? 'text-trading-green' : 'text-trading-red'}`}>
                {totalPL >= 0 ? '+' : ''}{formatPrice(Math.abs(totalPL))} ({totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Chart Section - Takes up 3 columns */}
          <div className="xl:col-span-3 space-y-6">
            {/* Interactive Chart */}
            <div className="trading-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Price Chart</h2>
                
                {/* Currency Display */}
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg text-white">
                  <span className="text-sm text-gray-400">Currency:</span>
                  <span className="text-lg font-bold">{currency.symbol}</span>
                  <span className="font-medium">{currency.code}</span>
                </div>
              </div>
              
              <TradingViewProfessionalChart 
                symbol={selectedSymbol.symbol} 
                displaySymbol={getSymbolDisplay(selectedSymbol, currency.code)}
                height={500}
                availableSymbols={getDisplaySymbols()}
                onSymbolChange={(newSymbol) => {
                  const newSelection = AVAILABLE_SYMBOLS.find(s => s.symbol === newSymbol);
                  if (newSelection) {
                    setSelectedSymbol(newSelection);
                  }
                }}
              />
            </div>

            {/* Positions & Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Open Positions */}
              <div className="trading-card">
                <h3 className="text-lg font-semibold text-white mb-4">Open Positions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {portfolio.positions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No open positions</div>
                  ) : (
                    portfolio.positions.map(position => {
                      const currentPrice = prices.get(position.symbol);
                      const currentValue = currentPrice ? position.quantity * currentPrice.price : 0;
                      const pl = currentPrice ? (currentPrice.price - position.avgPrice) * position.quantity : 0;
                      const plPercent = position.avgPrice ? (pl / (position.avgPrice * position.quantity)) * 100 : 0;
                      
                      return (
                        <div key={position.symbol} className="bg-trading-card-dark p-3 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-white">{position.name}</div>
                              <div className="text-sm text-gray-400">
                                {position.quantity} @ {formatPrice(position.avgPrice, 2)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white">{formatPrice(currentValue)}</div>
                              <div className={`text-sm ${pl >= 0 ? 'text-trading-green' : 'text-trading-red'}`}>
                                {pl >= 0 ? '+' : ''}{formatPrice(Math.abs(pl))} ({plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Trades */}
              <div className="trading-card">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {portfolio.trades.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No trades yet</div>
                  ) : (
                    portfolio.trades.slice(0, 10).map(trade => (
                      <div key={trade.id} className="bg-trading-card-dark p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                trade.side === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                              }`}>
                                {trade.side.toUpperCase()}
                              </span>
                              <span className="text-white">{trade.name}</span>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              {trade.quantity} @ {formatPrice(trade.price, 2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white">{formatPrice(trade.totalValue)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(trade.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trading Panel - Right Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            {/* Order Entry */}
            <div className="trading-card">
              <h3 className="text-lg font-semibold text-white mb-4">Place Order</h3>
              
              {/* Buy/Sell Toggle */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setSide('buy')}
                  className={`py-2 rounded font-semibold transition-colors ${
                    side === 'buy' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-trading-card-dark text-gray-400 hover:text-white'
                  }`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`py-2 rounded font-semibold transition-colors ${
                    side === 'sell' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-trading-card-dark text-gray-400 hover:text-white'
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Order Type */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as any)}
                  className="w-full bg-trading-card-dark text-white px-3 py-2 rounded border border-trading-border focus:outline-none focus:border-blue-500"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full bg-trading-card-dark text-white px-3 py-2 rounded border border-trading-border focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Limit Price (for limit orders) */}
              {orderType === 'limit' && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Limit Price</label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full bg-trading-card-dark text-white px-3 py-2 rounded border border-trading-border focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Stop Price (for stop orders) */}
              {orderType === 'stop' && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Stop Price</label>
                  <input
                    type="number"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full bg-trading-card-dark text-white px-3 py-2 rounded border border-trading-border focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Order Summary */}
              {currentPrice && quantity && parseFloat(quantity) > 0 && (
                <div className="mb-4 p-3 bg-trading-card-dark rounded">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Estimated Cost</span>
                    <span className="text-white">
                      {formatPrice(parseFloat(quantity) * (orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice.price))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available Balance</span>
                    <span className="text-white">{formatPrice(portfolio.cash)}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={executeTrade}
                disabled={!currentPrice || !quantity || parseFloat(quantity) <= 0}
                className={`w-full py-3 rounded font-semibold transition-colors ${
                  side === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700 text-white disabled:bg-green-900 disabled:text-green-700' 
                    : 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-900 disabled:text-red-700'
                } disabled:cursor-not-allowed`}
              >
                {side === 'buy' ? 'BUY' : 'SELL'} {selectedSymbol.name}
              </button>
            </div>

            {/* Market Depth / Order Book */}
            <div className="trading-card">
              <h3 className="text-lg font-semibold text-white mb-4">Order Book</h3>
              <div className="space-y-2">
                {/* Sell Orders */}
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => {
                    const price = currentPrice ? currentPrice.price * (1 + (0.001 * (5 - i))) : 0;
                    const volume = Math.random() * 10;
                    return (
                      <div key={`sell-${i}`} className="grid grid-cols-3 text-xs">
                        <div className="text-red-400 text-right">{formatPrice(price, 4)}</div>
                        <div className="text-gray-500 text-center">{volume.toFixed(3)}</div>
                        <div className="text-gray-600 text-right">{formatPrice(price * volume, 2)}</div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Current Price Divider */}
                <div className="border-t border-b border-trading-border py-2">
                  <div className="text-center font-semibold text-white">
                    {currentPrice ? formatPrice(currentPrice.price, 4) : '---'}
                  </div>
                </div>

                {/* Buy Orders */}
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => {
                    const price = currentPrice ? currentPrice.price * (1 - (0.001 * (i + 1))) : 0;
                    const volume = Math.random() * 10;
                    return (
                      <div key={`buy-${i}`} className="grid grid-cols-3 text-xs">
                        <div className="text-green-400 text-right">{formatPrice(price, 4)}</div>
                        <div className="text-gray-500 text-center">{volume.toFixed(3)}</div>
                        <div className="text-gray-600 text-right">{formatPrice(price * volume, 2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};