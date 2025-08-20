// Core trading data types
export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: number;
  change15m?: number;  // 15-minute percentage change
  change1h?: number;   // 1-hour percentage change
  change24h?: number;  // 24-hour percentage change
  
  // OHLC data
  open24h?: number;    // 24-hour open price
  high24h?: number;    // 24-hour high price
  low24h?: number;     // 24-hour low price
}

export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  realizedPL: number;
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stopLimit' | 'bracket';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
  filledQuantity?: number;
  filledPrice?: number;
}

export interface Portfolio {
  cash: number;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  timestamp: number;
  orderId: string;
}

export interface MarketData {
  prices: Map<string, MarketPrice>;
  charts: Map<string, OHLCData[]>;
  subscriptions: Set<string>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface TradingSymbol {
  symbol: string;
  name: string;
  type: 'stock' | 'forex' | 'crypto';
  exchange?: string;
  currency: string;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  symbol?: string;
  data: any;
  timestamp: number;
}

export interface FinnhubMessage {
  data: Array<{
    s: string; // Symbol
    p: number; // Price
    t: number; // Timestamp
    v: number; // Volume
  }>;
  type: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// Chart configuration
export interface ChartConfig {
  symbol: string;
  interval: '1' | '5' | '15' | '30' | '60' | 'D';
  theme: 'light' | 'dark';
}