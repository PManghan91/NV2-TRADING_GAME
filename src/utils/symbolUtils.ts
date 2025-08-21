/**
 * Utility functions for handling symbol display based on currency selection
 */

export interface SymbolInfo {
  symbol: string; // The actual trading symbol (e.g., 'BTCUSDT')
  baseSymbol: string; // The base asset (e.g., 'BTC')
  name: string;
  type: 'crypto' | 'stock';
  icon: string;
}

/**
 * Gets the display symbol based on the selected currency
 * For crypto: converts BTCUSDT to BTCGBP for display when GBP is selected
 * For stocks: returns symbol as-is
 * 
 * @param symbol - The base trading symbol (e.g., 'BTCUSDT')
 * @param selectedCurrency - The selected currency code (e.g., 'GBP', 'USD', etc.)
 * @returns The display symbol (e.g., 'BTCGBP')
 */
export const getDisplaySymbol = (symbol: string, selectedCurrency: string): string => {
  // For stocks, return as-is
  if (!symbol.includes('USDT')) {
    return symbol;
  }
  
  // For crypto pairs ending with USDT, replace with selected currency
  if (symbol.endsWith('USDT')) {
    const baseAsset = symbol.replace('USDT', '');
    
    // Map currency codes to trading pair suffixes
    const currencyMap: Record<string, string> = {
      'USD': 'USDT',
      'EUR': 'EUR',
      'GBP': 'GBP',
      'JPY': 'JPY',
      'CNY': 'CNY'
    };
    
    const currencySuffix = currencyMap[selectedCurrency] || 'USDT';
    return `${baseAsset}${currencySuffix}`;
  }
  
  return symbol;
};

/**
 * Gets the base asset symbol from a trading pair
 * @param symbol - The trading symbol (e.g., 'BTCUSDT')
 * @returns The base asset (e.g., 'BTC')
 */
export const getBaseAsset = (symbol: string): string => {
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '');
  }
  if (symbol.endsWith('EUR')) {
    return symbol.replace('EUR', '');
  }
  if (symbol.endsWith('GBP')) {
    return symbol.replace('GBP', '');
  }
  if (symbol.endsWith('JPY')) {
    return symbol.replace('JPY', '');
  }
  if (symbol.endsWith('CNY')) {
    return symbol.replace('CNY', '');
  }
  
  // For stocks, return as-is
  return symbol;
};

/**
 * Creates enhanced symbol info with dynamic display capabilities
 * @param symbol - The base trading symbol
 * @param name - The asset name
 * @param type - The asset type
 * @param icon - The display icon
 * @returns SymbolInfo with baseSymbol extracted
 */
export const createSymbolInfo = (
  symbol: string, 
  name: string, 
  type: 'crypto' | 'stock', 
  icon: string
): SymbolInfo => {
  return {
    symbol,
    baseSymbol: getBaseAsset(symbol),
    name,
    type,
    icon
  };
};

/**
 * Gets the display symbol for a SymbolInfo object
 * @param symbolInfo - The symbol info object
 * @param selectedCurrency - The selected currency code
 * @returns The display symbol
 */
export const getSymbolDisplay = (symbolInfo: SymbolInfo, selectedCurrency: string): string => {
  return getDisplaySymbol(symbolInfo.symbol, selectedCurrency);
};