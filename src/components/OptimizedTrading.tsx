import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../stores/marketStore';
import { binanceWebSocket } from '../services/BinanceWebSocketService';
import { useCurrency } from '../contexts/CurrencyContext';
import { TradingViewProfessionalChart } from './TradingViewProfessionalChart';
import { SymbolSelector } from './SymbolSelector';
import { SymbolInfo, createSymbolInfo, getSymbolDisplay } from '../utils/symbolUtils';

// Use SymbolInfo from symbolUtils

// Memoized Header Component
const TradingHeader = memo(({ 
  selectedSymbol, 
  onSymbolChange, 
  connectionStatus,
  currentPrice,
  formatPrice,
  portfolio,
  totalValue,
  totalPL,
  totalPLPercent,
  onNavigate,
  onReconnect,
  currency
}: any) => {
  return (
    <div className="bg-trading-surface border-b border-trading-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <button 
            onClick={onNavigate}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Trading Terminal</h1>
          
          <SymbolSelector
            symbols={AVAILABLE_SYMBOLS.map(symbol => ({
              ...symbol,
              displaySymbol: getSymbolDisplay(symbol, currency.code)
            }))}
            selectedSymbol={{
              ...selectedSymbol,
              displaySymbol: getSymbolDisplay(selectedSymbol, currency.code)
            }}
            onSymbolChange={onSymbolChange}
            currency={currency}
          />

          <PriceDisplay 
            connectionStatus={connectionStatus}
            currentPrice={currentPrice}
            formatPrice={formatPrice}
            selectedSymbol={selectedSymbol}
            onReconnect={onReconnect}
          />
        </div>

        <PortfolioSummary
          portfolio={portfolio}
          totalValue={totalValue}
          totalPL={totalPL}
          totalPLPercent={totalPLPercent}
          formatPrice={formatPrice}
        />
      </div>
    </div>
  );
});

// Memoized Price Display Component
const PriceDisplay = memo(({ connectionStatus, currentPrice, formatPrice, selectedSymbol, onReconnect }: any) => {
  if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-900/50 rounded-lg">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-red-400 font-medium">
          {connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
        </span>
        <button
          onClick={onReconnect}
          className="ml-2 px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
        <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-yellow-400 font-medium">Connecting...</span>
      </div>
    );
  }

  if (!currentPrice) {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
        <span className="text-gray-400">Waiting for data...</span>
      </div>
    );
  }

  const change = currentPrice.change24h !== undefined ? currentPrice.change24h : currentPrice.changePercent;
  
  return (
    <div className="flex items-center space-x-4">
      <div>
        <span className="text-gray-400 text-sm">Price</span>
        <div className="text-xl font-bold text-white">
          {formatPrice(currentPrice.price, selectedSymbol.type === 'crypto' ? 4 : 2)}
        </div>
      </div>
      <div>
        <span className="text-gray-400 text-sm">24h Change</span>
        <div className={`text-lg font-semibold ${change >= 0 ? 'text-trading-green' : 'text-trading-red'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
});

// Memoized Portfolio Summary Component
const PortfolioSummary = memo(({ portfolio, totalValue, totalPL, totalPLPercent, formatPrice }: any) => {
  return (
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
  );
});

// Memoized Order Entry Component
const OrderEntry = memo(({ 
  selectedSymbol, 
  currentPrice, 
  portfolio, 
  formatPrice, 
  onExecuteTrade 
}: any) => {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');

  const handleExecuteTrade = useCallback(() => {
    onExecuteTrade({
      orderType,
      side,
      quantity,
      limitPrice,
      stopPrice
    });
    // Reset form
    setQuantity('1');
    setLimitPrice('');
    setStopPrice('');
  }, [orderType, side, quantity, limitPrice, stopPrice, onExecuteTrade]);

  const estimatedCost = useMemo(() => {
    if (!currentPrice || !quantity || parseFloat(quantity) <= 0) return 0;
    return parseFloat(quantity) * (orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice.price);
  }, [currentPrice, quantity, orderType, limitPrice]);

  return (
    <div className="trading-card">
      <h3 className="text-lg font-semibold text-white mb-4">Place Order</h3>
      
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

      {currentPrice && quantity && parseFloat(quantity) > 0 && (
        <div className="mb-4 p-3 bg-trading-card-dark rounded">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Estimated Cost</span>
            <span className="text-white">{formatPrice(estimatedCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Available Balance</span>
            <span className="text-white">{formatPrice(portfolio.cash)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleExecuteTrade}
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
  );
});

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

export const OptimizedTrading: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolInfo>(AVAILABLE_SYMBOLS[0]);
  const connectionStatus = useMarketStore(state => state.connectionStatus);
  const { currency, formatPrice } = useCurrency();
  
  const [portfolio, setPortfolio] = useState({
    cash: 100000,
    positions: [] as any[],
    trades: [] as any[]
  });

  const prices = useMarketStore(state => state.prices);
  const currentPrice = prices.get(selectedSymbol.symbol);

  // Memoized callbacks
  const handleNavigate = useCallback(() => navigate('/dashboard'), [navigate]);
  
  const handleReconnect = useCallback(() => {
    console.log('Manual reconnect triggered');
    binanceWebSocket.forceReconnect();
  }, []);

  const handleSymbolChange = useCallback((newSymbol: SymbolInfo) => {
    setSelectedSymbol(newSymbol);
  }, []);

  const handleExecuteTrade = useCallback((tradeParams: any) => {
    if (!currentPrice || !tradeParams.quantity || parseFloat(tradeParams.quantity) <= 0) return;

    const qty = parseFloat(tradeParams.quantity);
    const price = tradeParams.orderType === 'limit' && tradeParams.limitPrice 
      ? parseFloat(tradeParams.limitPrice) 
      : currentPrice.price;

    const totalCost = qty * price;
    
    if (tradeParams.side === 'buy' && totalCost > portfolio.cash) {
      alert('Insufficient funds!');
      return;
    }

    const trade = {
      id: Date.now().toString(),
      symbol: selectedSymbol.symbol,
      name: selectedSymbol.name,
      side: tradeParams.side,
      quantity: qty,
      price,
      totalValue: totalCost,
      timestamp: new Date().toISOString(),
      type: tradeParams.orderType
    };

    setPortfolio(prev => {
      const newCash = tradeParams.side === 'buy' 
        ? prev.cash - totalCost 
        : prev.cash + totalCost;

      const existingPosition = prev.positions.find(p => p.symbol === selectedSymbol.symbol);
      let newPositions = [...prev.positions];

      if (tradeParams.side === 'buy') {
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
        trades: [trade, ...prev.trades].slice(0, 50)
      };
    });

    console.log('Trade executed:', `${tradeParams.side.toUpperCase()} ${qty} ${selectedSymbol.name} @ $${price.toFixed(2)}`);
  }, [currentPrice, portfolio.cash, selectedSymbol]);

  // Memoized portfolio calculations
  const { totalValue, totalPL, totalPLPercent } = useMemo(() => {
    let value = portfolio.cash;
    portfolio.positions.forEach(position => {
      const currentPrice = prices.get(position.symbol);
      if (currentPrice) {
        value += position.quantity * currentPrice.price;
      }
    });
    const pl = value - 100000;
    const plPercent = (pl / 100000) * 100;
    return { totalValue: value, totalPL: pl, totalPLPercent: plPercent };
  }, [portfolio, prices]);

  // WebSocket subscription effect
  useEffect(() => {
    if (selectedSymbol.type === 'crypto' && selectedSymbol.symbol.includes('USDT')) {
      const subscriptions = useMarketStore.getState().subscriptions;
      if (!subscriptions.has(selectedSymbol.symbol)) {
        console.log(`📡 Subscribing to newly selected symbol: ${selectedSymbol.symbol}`);
        binanceWebSocket.subscribe(selectedSymbol.symbol, 'ticker');
        useMarketStore.getState().addSubscription(selectedSymbol.symbol);
      }
    }
  }, [selectedSymbol]);

  return (
    <div className="min-h-screen bg-trading-bg">
      <TradingHeader
        selectedSymbol={selectedSymbol}
        onSymbolChange={handleSymbolChange}
        connectionStatus={connectionStatus}
        currentPrice={currentPrice}
        formatPrice={formatPrice}
        portfolio={portfolio}
        totalValue={totalValue}
        totalPL={totalPL}
        totalPLPercent={totalPLPercent}
        onNavigate={handleNavigate}
        onReconnect={handleReconnect}
        currency={currency}
      />

      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <div className="trading-card">
              <TradingViewProfessionalChart 
                symbol={selectedSymbol.symbol} 
                displaySymbol={getSymbolDisplay(selectedSymbol, currency.code)}
                height={500}
                availableSymbols={AVAILABLE_SYMBOLS.map(symbol => ({
                  ...symbol,
                  displaySymbol: getSymbolDisplay(symbol, currency.code)
                }))}
                onSymbolChange={(newSymbol) => {
                  const newSelection = AVAILABLE_SYMBOLS.find(s => s.symbol === newSymbol);
                  if (newSelection) {
                    setSelectedSymbol(newSelection);
                  }
                }}
              />
            </div>
          </div>

          <div className="xl:col-span-1 space-y-6">
            <OrderEntry
              selectedSymbol={selectedSymbol}
              currentPrice={currentPrice}
              portfolio={portfolio}
              formatPrice={formatPrice}
              onExecuteTrade={handleExecuteTrade}
            />
          </div>
        </div>
      </div>
    </div>
  );
};