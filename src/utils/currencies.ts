export interface Currency {
  code: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
  symbol: string;
  name: string;
  rate: number; // Exchange rate relative to USD
}

export const CURRENCIES: Record<string, Currency> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    rate: 1.00
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    rate: 0.92  // Example rate, should be fetched from API
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    rate: 0.79  // Example rate, should be fetched from API
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    rate: 147.50  // Example rate, should be fetched from API
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    rate: 7.30  // Example rate, should be fetched from API
  }
};

export const getCurrency = (code: string): Currency => {
  return CURRENCIES[code] || CURRENCIES.USD;
};

export const formatPrice = (price: number, currency: Currency, decimals?: number): string => {
  const convertedPrice = price * currency.rate;
  const decimalPlaces = decimals !== undefined ? decimals : 
    currency.code === 'JPY' ? 0 : 2;
  
  const formattedNumber = convertedPrice.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
  
  // Special formatting for different currencies
  if (currency.code === 'EUR') {
    return `€${formattedNumber}`;
  } else if (currency.code === 'GBP') {
    return `£${formattedNumber}`;
  } else if (currency.code === 'JPY' || currency.code === 'CNY') {
    return `¥${formattedNumber}`;
  }
  
  return `$${formattedNumber}`;
};

// Hook to fetch and update exchange rates
export const updateExchangeRates = async (): Promise<void> => {
  try {
    // In a real app, you would fetch from an exchange rate API
    // For now, we'll use the static rates defined above
    console.log('Exchange rates updated');
  } catch (error) {
    console.error('Failed to update exchange rates:', error);
  }
};