// API Configuration
export const API_CONFIG = {
  FINNHUB: {
    BASE_URL: 'https://finnhub.io/api/v1',
    WS_URL: 'wss://ws.finnhub.io',
    API_KEY: process.env.REACT_APP_FINNHUB_API_KEY || '',
  },
  COINGECKO: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    API_KEY: process.env.REACT_APP_COINGECKO_API_KEY || '',
  },
  TRADERMADE: {
    BASE_URL: 'https://marketdata.tradermade.com/api/v1',
    API_KEY: process.env.REACT_APP_TRADERMADE_API_KEY || '',
  },
  ALPHA_VANTAGE: {
    BASE_URL: 'https://www.alphavantage.co/query',
    API_KEY: process.env.REACT_APP_ALPHA_VANTAGE_API_KEY || '',
  },
  TWELVE_DATA: {
    BASE_URL: 'https://api.twelvedata.com',
    WS_URL: 'wss://ws.twelvedata.com/v1/quotes/price',
    API_KEY: process.env.REACT_APP_TWELVE_DATA_API_KEY || '',
  },
  NEWS_API: {
    BASE_URL: 'https://newsapi.org/v2',
    API_KEY: process.env.REACT_APP_NEWS_API_KEY || '',
  },
};

// Default symbols to track
export const DEFAULT_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' as const, currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' as const, currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock' as const, currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' as const, currency: 'USD' },
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', type: 'crypto' as const, currency: 'USDT' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', type: 'crypto' as const, currency: 'USDT' },
  { symbol: 'OANDA:EUR_USD', name: 'EUR/USD', type: 'forex' as const, currency: 'USD' },
  { symbol: 'OANDA:GBP_USD', name: 'GBP/USD', type: 'forex' as const, currency: 'USD' },
];

// Trading configuration
export const TRADING_CONFIG = {
  INITIAL_CASH: Number(process.env.REACT_APP_INITIAL_CASH) || 100000,
  COMMISSION_RATE: Number(process.env.REACT_APP_COMMISSION_RATE) || 0.001,
  MAX_POSITION_SIZE: Number(process.env.REACT_APP_MAX_POSITION_SIZE) || 0.1,
  CURRENCY: 'USD',
  DEFAULT_QUANTITY: 100,
  RECONNECT_INTERVAL: Number(process.env.REACT_APP_WS_RECONNECT_INTERVAL) || 5000,
  MAX_RECONNECT_ATTEMPTS: Number(process.env.REACT_APP_WS_MAX_RECONNECT_ATTEMPTS) || 10,
};

// Chart configuration
export const CHART_CONFIG = {
  INTERVALS: [
    { value: '1', label: '1min' },
    { value: '5', label: '5min' },
    { value: '15', label: '15min' },
    { value: '30', label: '30min' },
    { value: '60', label: '1hour' },
    { value: 'D', label: '1day' },
  ],
  THEMES: {
    DARK: {
      background: '#0f1419',
      surface: '#1a2332',
      border: '#2d3748',
      text: '#ffffff',
      upColor: '#10b981',
      downColor: '#ef4444',
    },
    LIGHT: {
      background: '#ffffff',
      surface: '#f8fafc',
      border: '#e2e8f0',
      text: '#1a202c',
      upColor: '#059669',
      downColor: '#dc2626',
    },
  },
};

// Format utilities
export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatVolume = (volume: number): string => {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toString();
};