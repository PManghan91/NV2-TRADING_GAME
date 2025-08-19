import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../stores/marketStore';

// Import components
import { TradingViewProfessionalChart } from '../components/TradingViewProfessionalChart';
import { SymbolSelector } from '../components/SymbolSelector';

interface SymbolInfo {
  symbol: string;
  name: string;
  type: 'crypto' | 'stock';
  icon: string;
}

interface Currency {
  code: 'USD' | 'EUR' | 'GBP';
  symbol: string;
  name: string;
  rate: number; // Conversion rate from USD
}

const AVAILABLE_SYMBOLS: SymbolInfo[] = [
  // Crypto
  { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'crypto', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', type: 'crypto', icon: 'Ξ' },
  { symbol: 'BNBUSDT', name: 'BNB', type: 'crypto', icon: 'B' },
  { symbol: 'SOLUSDT', name: 'Solana', type: 'crypto', icon: 'S' },
  // Stocks
  { symbol: 'AAPL', name: 'Apple', type: 'stock', icon: '🍎' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', icon: '💻' },
  { symbol: 'GOOGL', name: 'Google', type: 'stock', icon: '🔍' },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock', icon: '🚗' },
];

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.00 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79 },
];

export const Trading: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolInfo>(AVAILABLE_SYMBOLS[0]);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[0]);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  
  // Rate limiting for price ticker updates (250ms = 4 updates per second)
  const lastPriceUpdateRef = React.useRef<number>(0);
  const PRICE_UPDATE_INTERVAL = 250;
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
  
  // Helper function to convert prices
  const convertPrice = (priceInUSD: number) => {
    return priceInUSD * selectedCurrency.rate;
  };
  
  // Helper function to format price with currency symbol
  const formatPrice = (priceInUSD: number, decimals: number = 2) => {
    const convertedPrice = convertPrice(priceInUSD);
    const formatted = convertedPrice.toFixed(decimals);
    return `${selectedCurrency.symbol}${formatted}`;
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.currency-selector-container')) {
        setShowCurrencySelector(false);
      }
    };
    
    if (showCurrencySelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCurrencySelector]);
  
  // Debug: Log when symbol changes and ensure data connection
  React.useEffect(() => {
    console.log('Selected symbol changed to:', selectedSymbol.symbol);
    console.log('Current price for', selectedSymbol.symbol, ':', currentPrice);
    console.log('All available prices:', Array.from(prices.keys()));
    
    // If we're trying to view crypto but have no crypto prices, try to reconnect
    if (selectedSymbol.type === 'crypto' && !currentPrice) {
      console.log('No crypto prices available, checking Binance connection...');
      // Import and check Binance connection
      Promise.all([
        import('../services/BinanceWebSocketService'),
        import('../services/PriceHistoryService'),
        import('../stores/marketStore')
      ]).then(([{ binanceWebSocket }, { priceHistoryService }, { useMarketStore }]) => {
        // Ensure handlers are set
        binanceWebSocket.setHandlers({
          onPriceUpdate: (price) => {
            console.log('Received price update for', price.symbol, ':', price.price);
            priceHistoryService.updatePrice(price.symbol, price.price);
            const changes = priceHistoryService.getChanges(price.symbol);
            const enrichedPrice = {
              ...price,
              ...changes
            };
            useMarketStore.getState().updatePrice(enrichedPrice);
          },
          onStatusChange: (status) => {
            console.log('Binance status changed to:', status);
          },
          onError: (error) => {
            console.error('Binance error:', error);
          }
        });
        
        if (!binanceWebSocket.getConnectionStatus()) {
          console.log('Binance not connected, attempting to connect...');
          binanceWebSocket.connect().then(() => {
            console.log('Binance reconnected, subscribing to', selectedSymbol.symbol);
            binanceWebSocket.subscribe(selectedSymbol.symbol, 'trade');
            binanceWebSocket.subscribe(selectedSymbol.symbol, 'ticker');
          }).catch(err => {
            console.error('Failed to connect to Binance:', err);
          });
        } else {
          console.log('Binance is connected, subscribing to', selectedSymbol.symbol);
          binanceWebSocket.subscribe(selectedSymbol.symbol, 'trade');
          binanceWebSocket.subscribe(selectedSymbol.symbol, 'ticker');
        }
      });
    }
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
              symbols={AVAILABLE_SYMBOLS}
              selectedSymbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />

            {/* Current Price Display */}
            {currentPrice && (
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-gray-400 text-sm">Price</span>
                  <div className="text-xl font-bold text-white">
                    {formatPrice(currentPrice.price, selectedSymbol.type === 'crypto' ? 4 : 2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">24h Change</span>
                  <div className={`text-lg font-semibold ${
                    (currentPrice.change24h !== undefined ? currentPrice.change24h : currentPrice.changePercent) >= 0 
                      ? 'text-trading-green' 
                      : 'text-trading-red'
                  }`}>
                    {(() => {
                      const change = currentPrice.change24h !== undefined ? currentPrice.change24h : currentPrice.changePercent;
                      return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                    })()}
                  </div>
                </div>
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
                
                {/* Currency Selector */}
                <div className="relative currency-selector-container">
                  <button
                    onClick={() => setShowCurrencySelector(!showCurrencySelector)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                  >
                    <span className="text-lg font-bold">{selectedCurrency.symbol}</span>
                    <span className="font-medium">{selectedCurrency.code}</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showCurrencySelector && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="px-3 py-2 text-xs text-gray-400 font-semibold border-b border-gray-700">SELECT CURRENCY</div>
                    {CURRENCIES.map(currency => (
                      <button
                        key={currency.code}
                        onClick={() => {
                          setSelectedCurrency(currency);
                          setShowCurrencySelector(false);
                        }}
                        className={`w-full px-3 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors ${
                          selectedCurrency.code === currency.code ? 'bg-gray-700' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-xl font-bold">{currency.symbol}</span>
                          <div className="text-left">
                            <div className="text-white text-sm font-medium">{currency.code}</div>
                            <div className="text-gray-400 text-xs">{currency.name}</div>
                          </div>
                        </div>
                        {selectedCurrency.code === currency.code && (
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              </div>
              
              <TradingViewProfessionalChart 
                symbol={selectedSymbol.symbol} 
                height={500}
                availableSymbols={AVAILABLE_SYMBOLS}
                onSymbolChange={(newSymbol) => {
                  const newSelection = AVAILABLE_SYMBOLS.find(s => s.symbol === newSymbol);
                  if (newSelection) {
                    setSelectedSymbol(newSelection);
                  }
                }}
                currency={selectedCurrency}
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
                                {position.quantity} @ ${position.avgPrice.toFixed(2)}
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
                              {trade.quantity} @ ${trade.price.toFixed(2)}
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
                        <div className="text-red-400 text-right">{price.toFixed(4)}</div>
                        <div className="text-gray-500 text-center">{volume.toFixed(3)}</div>
                        <div className="text-gray-600 text-right">${(price * volume).toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Current Price Divider */}
                <div className="border-t border-b border-trading-border py-2">
                  <div className="text-center font-semibold text-white">
                    {currentPrice ? `$${currentPrice.price.toFixed(4)}` : '---'}
                  </div>
                </div>

                {/* Buy Orders */}
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => {
                    const price = currentPrice ? currentPrice.price * (1 - (0.001 * (i + 1))) : 0;
                    const volume = Math.random() * 10;
                    return (
                      <div key={`buy-${i}`} className="grid grid-cols-3 text-xs">
                        <div className="text-green-400 text-right">{price.toFixed(4)}</div>
                        <div className="text-gray-500 text-center">{volume.toFixed(3)}</div>
                        <div className="text-gray-600 text-right">${(price * volume).toFixed(2)}</div>
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