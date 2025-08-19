import React, { useState, useEffect } from 'react';
import { useMarketStore, usePrice } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { formatCurrency } from '../utils/constants';

interface OrderFormData {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stopLimit' | 'bracket';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  timeInForce: 'GTC' | 'DAY' | 'IOC';
  positionSizeMode: 'shares' | 'dollars' | 'percentage';
  riskAmount?: number;
  riskPercentage?: number;
}

interface PositionSizingData {
  accountValue: number;
  riskPerTrade: number;
  entryPrice: number;
  stopLossPrice: number;
  positionSize: number;
  dollarRisk: number;
  riskRewardRatio?: number;
}

export const AdvancedOrderPanel: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    symbol: 'AAPL',
    side: 'buy',
    orderType: 'market',
    quantity: 100,
    timeInForce: 'GTC',
    positionSizeMode: 'shares',
    riskPercentage: 2,
  });

  const [showPositionSizing, setShowPositionSizing] = useState(false);
  const [positionSizing, setPositionSizing] = useState<PositionSizingData>({
    accountValue: 100000,
    riskPerTrade: 2,
    entryPrice: 0,
    stopLossPrice: 0,
    positionSize: 0,
    dollarRisk: 0,
  });

  const currentPrice = usePrice(selectedSymbol);
  const portfolioStore = usePortfolioStore();
  const addOrder = usePortfolioStore(state => state.addOrder);
  const canPlaceOrder = usePortfolioStore(state => state.canPlaceOrder);

  // Update position sizing when prices change
  useEffect(() => {
    if (currentPrice) {
      setOrderForm(prev => ({
        ...prev,
        limitPrice: prev.limitPrice || currentPrice.price,
      }));

      // Update position sizing calculations
      calculatePositionSizing();
    }
  }, [currentPrice]);

  const calculatePositionSizing = () => {
    if (!currentPrice) return;

    const entryPrice = orderForm.limitPrice || currentPrice.price;
    const stopLoss = orderForm.stopLossPrice || 0;
    const takeProfit = orderForm.takeProfitPrice || 0;

    if (entryPrice > 0 && stopLoss > 0) {
      const riskPerShare = Math.abs(entryPrice - stopLoss);
      const maxRisk = portfolioStore.totalValue * (orderForm.riskPercentage || 2) / 100;
      const positionSize = Math.floor(maxRisk / riskPerShare);
      
      const riskRewardRatio = takeProfit > 0 
        ? Math.abs(takeProfit - entryPrice) / riskPerShare 
        : undefined;

      setPositionSizing({
        accountValue: portfolioStore.totalValue,
        riskPerTrade: orderForm.riskPercentage || 2,
        entryPrice,
        stopLossPrice: stopLoss,
        positionSize,
        dollarRisk: maxRisk,
        riskRewardRatio,
      });

      if (orderForm.positionSizeMode === 'percentage') {
        setOrderForm(prev => ({ ...prev, quantity: positionSize }));
      }
    }
  };

  const handleInputChange = (field: keyof OrderFormData, value: any) => {
    setOrderForm(prev => ({ ...prev, [field]: value }));
  };

  const validateOrder = () => {
    const validation = canPlaceOrder(orderForm.symbol, orderForm.quantity, orderForm.limitPrice || currentPrice?.price || 0);
    return validation;
  };

  const placeOrder = () => {
    if (!currentPrice) return;

    const validation = validateOrder();
    if (!validation.canPlace) {
      alert(`Cannot place order: ${validation.reason}`);
      return;
    }

    const orderData = {
      symbol: orderForm.symbol,
      side: orderForm.side,
      type: orderForm.orderType,
      quantity: orderForm.quantity,
      price: orderForm.orderType === 'limit' ? orderForm.limitPrice : undefined,
      stopPrice: orderForm.orderType === 'stop' ? orderForm.stopPrice : undefined,
      status: 'pending' as const,
    };

    const orderId = addOrder(orderData);
    
    // For demo purposes, immediately fill market orders
    if (orderForm.orderType === 'market') {
      portfolioStore.fillOrder(orderId, currentPrice.price);
    }
    
    // Add stop loss and take profit orders for bracket orders
    if (orderForm.orderType === 'bracket') {
      if (orderForm.stopLossPrice) {
        addOrder({
          symbol: orderForm.symbol,
          side: orderForm.side === 'buy' ? 'sell' : 'buy',
          type: 'stop',
          quantity: orderForm.quantity,
          stopPrice: orderForm.stopLossPrice,
          status: 'pending' as const,
        });
      }

      if (orderForm.takeProfitPrice) {
        addOrder({
          symbol: orderForm.symbol,
          side: orderForm.side === 'buy' ? 'sell' : 'buy',
          type: 'limit',
          quantity: orderForm.quantity,
          price: orderForm.takeProfitPrice,
          status: 'pending' as const,
        });
      }
    }

    // Reset form
    setOrderForm(prev => ({
      ...prev,
      quantity: orderForm.positionSizeMode === 'shares' ? 100 : prev.quantity,
    }));
  };

  const getEstimatedCost = () => {
    if (!currentPrice) return 0;
    const price = orderForm.limitPrice || currentPrice.price;
    return orderForm.quantity * price;
  };

  return (
    <div className="space-y-6">
      {/* Order Entry Panel */}
      <div className="trading-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Advanced Order Entry</h3>
          <button
            onClick={() => setShowPositionSizing(!showPositionSizing)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showPositionSizing ? 'Hide' : 'Show'} Position Sizing
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Symbol
              </label>
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  handleInputChange('symbol', e.target.value);
                }}
                className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="AAPL">AAPL - Apple Inc.</option>
                <option value="GOOGL">GOOGL - Alphabet Inc.</option>
                <option value="MSFT">MSFT - Microsoft Corp.</option>
                <option value="TSLA">TSLA - Tesla Inc.</option>
                <option value="BINANCE:BTCUSDT">BTC - Bitcoin</option>
                <option value="BINANCE:ETHUSDT">ETH - Ethereum</option>
              </select>
            </div>

            {/* Side & Order Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Side
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => handleInputChange('side', 'buy')}
                    className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderForm.side === 'buy'
                        ? 'bg-trading-green text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => handleInputChange('side', 'sell')}
                    className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderForm.side === 'sell'
                        ? 'bg-trading-red text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Order Type
                </label>
                <select
                  value={orderForm.orderType}
                  onChange={(e) => handleInputChange('orderType', e.target.value)}
                  className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                  <option value="stopLimit">Stop Limit</option>
                  <option value="bracket">Bracket</option>
                </select>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Position Size
              </label>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {(['shares', 'dollars', 'percentage'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleInputChange('positionSizeMode', mode)}
                    className={`py-1 px-2 rounded text-xs font-medium transition-colors ${
                      orderForm.positionSizeMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {mode === 'shares' ? 'Shares' : mode === 'dollars' ? '$' : '%'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={orderForm.quantity}
                onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Current Price Display */}
            <div className="bg-trading-bg rounded-md p-3">
              <div className="text-sm text-gray-400 mb-1">Current Price</div>
              <div className="text-2xl font-mono font-bold text-white">
                {currentPrice ? formatCurrency(currentPrice.price) : 'Loading...'}
              </div>
              {currentPrice && (
                <div className={`text-sm font-mono ${
                  currentPrice.changePercent >= 0 ? 'text-trading-green' : 'text-trading-red'
                }`}>
                  {currentPrice.changePercent >= 0 ? '+' : ''}{currentPrice.changePercent.toFixed(2)}%
                </div>
              )}
            </div>

            {/* Price Inputs */}
            {orderForm.orderType !== 'market' && (
              <div className="space-y-3">
                {(orderForm.orderType === 'limit' || orderForm.orderType === 'stopLimit' || orderForm.orderType === 'bracket') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Limit Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={orderForm.limitPrice || ''}
                      onChange={(e) => handleInputChange('limitPrice', parseFloat(e.target.value))}
                      className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {(orderForm.orderType === 'stop' || orderForm.orderType === 'stopLimit') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Stop Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={orderForm.stopPrice || ''}
                      onChange={(e) => handleInputChange('stopPrice', parseFloat(e.target.value))}
                      className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {orderForm.orderType === 'bracket' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Stop Loss Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={orderForm.stopLossPrice || ''}
                        onChange={(e) => handleInputChange('stopLossPrice', parseFloat(e.target.value))}
                        className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Take Profit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={orderForm.takeProfitPrice || ''}
                        onChange={(e) => handleInputChange('takeProfitPrice', parseFloat(e.target.value))}
                        className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Risk Management */}
            {orderForm.positionSizeMode === 'percentage' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Risk Per Trade (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={orderForm.riskPercentage || ''}
                  onChange={(e) => handleInputChange('riskPercentage', parseFloat(e.target.value))}
                  className="w-full bg-trading-bg border border-trading-border rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                  min="0.1"
                  max="10"
                />
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-6 p-3 bg-trading-bg rounded-md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Estimated Cost</div>
              <div className="font-mono text-white">
                {formatCurrency(getEstimatedCost())}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Available Cash</div>
              <div className="font-mono text-white">
                {formatCurrency(portfolioStore.cash)}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Commission</div>
              <div className="font-mono text-white">
                {formatCurrency(getEstimatedCost() * 0.001)}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Time in Force</div>
              <div className="font-mono text-white">{orderForm.timeInForce}</div>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <div className="mt-6">
          <button
            onClick={placeOrder}
            className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
              orderForm.side === 'buy'
                ? 'bg-trading-green hover:bg-green-600'
                : 'bg-trading-red hover:bg-red-600'
            }`}
          >
            {orderForm.side === 'buy' ? 'Buy' : 'Sell'} {orderForm.symbol}
          </button>
        </div>
      </div>

      {/* Position Sizing Calculator */}
      {showPositionSizing && (
        <div className="trading-card">
          <h3 className="text-lg font-semibold text-white mb-4">Position Sizing Calculator</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Account Value</div>
                <div className="text-xl font-mono text-white">
                  {formatCurrency(positionSizing.accountValue)}
                </div>
              </div>
              
              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Risk Per Trade</div>
                <div className="text-xl font-mono text-white">
                  {positionSizing.riskPerTrade}%
                </div>
              </div>

              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Dollar Risk</div>
                <div className="text-xl font-mono text-trading-red">
                  {formatCurrency(positionSizing.dollarRisk)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Entry Price</div>
                <div className="text-xl font-mono text-white">
                  {formatCurrency(positionSizing.entryPrice)}
                </div>
              </div>

              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Stop Loss</div>
                <div className="text-xl font-mono text-trading-red">
                  {formatCurrency(positionSizing.stopLossPrice)}
                </div>
              </div>

              <div className="bg-trading-bg rounded-md p-3">
                <div className="text-sm text-gray-400 mb-1">Position Size</div>
                <div className="text-xl font-mono text-trading-green">
                  {positionSizing.positionSize} shares
                </div>
              </div>

              {positionSizing.riskRewardRatio && (
                <div className="bg-trading-bg rounded-md p-3">
                  <div className="text-sm text-gray-400 mb-1">Risk/Reward Ratio</div>
                  <div className={`text-xl font-mono ${
                    positionSizing.riskRewardRatio >= 2 ? 'text-trading-green' : 'text-yellow-500'
                  }`}>
                    1:{positionSizing.riskRewardRatio.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};