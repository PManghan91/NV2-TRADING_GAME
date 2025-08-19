import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Portfolio, Position, Order, Trade } from '../types/trading';
import { TRADING_CONFIG } from '../utils/constants';

interface PortfolioStore extends Portfolio {
  // Portfolio actions
  updateTotalValue: (marketPrices: Map<string, number>) => void;
  
  // Position actions
  addPosition: (position: Omit<Position, 'id' | 'timestamp'>) => string;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
  getPosition: (symbol: string) => Position | undefined;
  
  // Order actions
  addOrder: (order: Omit<Order, 'id' | 'timestamp'>) => string;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  cancelOrder: (id: string) => void;
  fillOrder: (id: string, filledPrice: number, filledQuantity?: number) => void;
  
  // Trade actions
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp'>) => string;
  
  // Portfolio analysis
  getPortfolioPerformance: () => {
    totalReturn: number;
    totalReturnPercent: number;
    dayReturn: number;
    dayReturnPercent: number;
    unrealizedPL: number;
    realizedPL: number;
  };
  
  // Risk management
  canPlaceOrder: (symbol: string, quantity: number, price: number) => {
    canPlace: boolean;
    reason?: string;
  };
  
  // Reset portfolio (for demo/game purposes)
  resetPortfolio: () => void;
  
  // Settings
  initialCash: number;
}

let nextId = 1;
const generateId = () => `id_${nextId++}`;

export const usePortfolioStore = create<PortfolioStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    cash: TRADING_CONFIG.INITIAL_CASH,
    totalValue: TRADING_CONFIG.INITIAL_CASH,
    dayChange: 0,
    dayChangePercent: 0,
    positions: [],
    orders: [],
    trades: [],
    initialCash: TRADING_CONFIG.INITIAL_CASH,

    // Portfolio actions
    updateTotalValue: (marketPrices: Map<string, number>) => {
      set((state) => {
        let positionsValue = 0;
        let unrealizedPL = 0;
        
        const updatedPositions = state.positions.map(position => {
          const currentPrice = marketPrices.get(position.symbol) || position.currentPrice;
          const marketValue = currentPrice * Math.abs(position.quantity);
          const positionPL = position.side === 'long' 
            ? (currentPrice - position.avgPrice) * position.quantity
            : (position.avgPrice - currentPrice) * position.quantity;
          
          positionsValue += marketValue;
          unrealizedPL += positionPL;
          
          return {
            ...position,
            currentPrice,
            unrealizedPL: positionPL,
          };
        });
        
        const totalValue = state.cash + positionsValue;
        const dayChange = totalValue - state.initialCash;
        const dayChangePercent = (dayChange / state.initialCash) * 100;
        
        return {
          positions: updatedPositions,
          totalValue,
          dayChange,
          dayChangePercent,
        };
      });
    },

    // Position actions
    addPosition: (positionData) => {
      const id = generateId();
      const position: Position = {
        ...positionData,
        id,
        timestamp: Date.now(),
        unrealizedPL: 0,
        realizedPL: 0,
      };
      
      set((state) => ({
        positions: [...state.positions, position],
      }));
      
      return id;
    },

    updatePosition: (id: string, updates: Partial<Position>) => {
      set((state) => ({
        positions: state.positions.map(position =>
          position.id === id ? { ...position, ...updates } : position
        ),
      }));
    },

    removePosition: (id: string) => {
      set((state) => ({
        positions: state.positions.filter(position => position.id !== id),
      }));
    },

    getPosition: (symbol: string) => {
      return get().positions.find(position => position.symbol === symbol);
    },

    // Order actions
    addOrder: (orderData) => {
      const id = generateId();
      const order: Order = {
        ...orderData,
        id,
        timestamp: Date.now(),
        status: 'pending',
      };
      
      set((state) => ({
        orders: [...state.orders, order],
      }));
      
      return id;
    },

    updateOrder: (id: string, updates: Partial<Order>) => {
      set((state) => ({
        orders: state.orders.map(order =>
          order.id === id ? { ...order, ...updates } : order
        ),
      }));
    },

    cancelOrder: (id: string) => {
      set((state) => ({
        orders: state.orders.map(order =>
          order.id === id ? { ...order, status: 'cancelled' as const } : order
        ),
      }));
    },

    fillOrder: (id: string, filledPrice: number, filledQuantity?: number) => {
      const state = get();
      const order = state.orders.find(o => o.id === id);
      
      if (!order || order.status !== 'pending') return;
      
      const quantity = filledQuantity || order.quantity;
      const commission = quantity * filledPrice * TRADING_CONFIG.COMMISSION_RATE;
      const totalCost = quantity * filledPrice + commission;
      
      // Update order status
      set((state) => ({
        orders: state.orders.map(o =>
          o.id === id ? {
            ...o,
            status: 'filled' as const,
            filledPrice,
            filledQuantity: quantity,
          } : o
        ),
      }));
      
      // Create trade record
      const tradeId = get().addTrade({
        symbol: order.symbol,
        side: order.side,
        quantity,
        price: filledPrice,
        commission,
        orderId: id,
      });
      
      // Update cash
      const cashChange = order.side === 'buy' ? -totalCost : totalCost - commission;
      set((state) => ({
        cash: state.cash + cashChange,
      }));
      
      // Update or create position
      const existingPosition = get().getPosition(order.symbol);
      
      if (existingPosition) {
        // Update existing position
        const newQuantity = order.side === 'buy' 
          ? existingPosition.quantity + quantity
          : existingPosition.quantity - quantity;
          
        if (newQuantity === 0) {
          get().removePosition(existingPosition.id);
        } else {
          const newAvgPrice = order.side === 'buy'
            ? ((existingPosition.avgPrice * existingPosition.quantity) + (filledPrice * quantity)) / newQuantity
            : existingPosition.avgPrice;
            
          get().updatePosition(existingPosition.id, {
            quantity: newQuantity,
            avgPrice: newAvgPrice,
            side: newQuantity > 0 ? 'long' : 'short',
          });
        }
      } else if (order.side === 'buy') {
        // Create new position for buy orders
        get().addPosition({
          symbol: order.symbol,
          side: 'long',
          quantity,
          avgPrice: filledPrice,
          currentPrice: filledPrice,
          unrealizedPL: 0,
          realizedPL: 0,
        });
      }
    },

    // Trade actions
    addTrade: (tradeData) => {
      const id = generateId();
      const trade: Trade = {
        ...tradeData,
        id,
        timestamp: Date.now(),
      };
      
      set((state) => ({
        trades: [...state.trades, trade],
      }));
      
      return id;
    },

    // Portfolio analysis
    getPortfolioPerformance: () => {
      const state = get();
      const unrealizedPL = state.positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
      const realizedPL = state.trades
        .filter(trade => trade.side === 'sell')
        .reduce((sum, trade) => sum - trade.commission, 0); // Simplified calculation
      
      const totalReturn = state.totalValue - state.initialCash;
      const totalReturnPercent = (totalReturn / state.initialCash) * 100;
      
      return {
        totalReturn,
        totalReturnPercent,
        dayReturn: state.dayChange,
        dayReturnPercent: state.dayChangePercent,
        unrealizedPL,
        realizedPL,
      };
    },

    // Risk management
    canPlaceOrder: (symbol: string, quantity: number, price: number) => {
      const state = get();
      const orderValue = quantity * price;
      const commission = orderValue * TRADING_CONFIG.COMMISSION_RATE;
      const totalCost = orderValue + commission;
      
      // Check if enough cash for buy orders
      if (totalCost > state.cash) {
        return {
          canPlace: false,
          reason: 'Insufficient cash balance',
        };
      }
      
      // Check position size limit
      const positionValue = orderValue / state.totalValue;
      if (positionValue > TRADING_CONFIG.MAX_POSITION_SIZE) {
        return {
          canPlace: false,
          reason: `Position size would exceed ${TRADING_CONFIG.MAX_POSITION_SIZE * 100}% limit`,
        };
      }
      
      return { canPlace: true };
    },

    // Reset portfolio
    resetPortfolio: () => {
      set({
        cash: TRADING_CONFIG.INITIAL_CASH,
        totalValue: TRADING_CONFIG.INITIAL_CASH,
        dayChange: 0,
        dayChangePercent: 0,
        positions: [],
        orders: [],
        trades: [],
      });
      nextId = 1; // Reset ID counter
    },
  }))
);

// Selector hooks
export const usePortfolioValue = () => usePortfolioStore(state => state.totalValue);
export const useCashBalance = () => usePortfolioStore(state => state.cash);
export const usePositions = () => usePortfolioStore(state => state.positions);
export const useOrders = () => usePortfolioStore(state => state.orders);
export const useTrades = () => usePortfolioStore(state => state.trades);
export const usePortfolioPerformance = () => usePortfolioStore(state => state.getPortfolioPerformance());