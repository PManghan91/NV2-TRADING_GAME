import React, { createContext, useContext, useState, useEffect } from 'react';
import { Currency, getCurrency, CURRENCIES } from '../utils/currencies';
import { useSettings } from '../components/SettingsModal';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (code: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY') => void;
  convertPrice: (priceInUSD: number) => number;
  formatPrice: (priceInUSD: number, decimals?: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const settings = useSettings();
  const [currency, setCurrencyState] = useState<Currency>(
    getCurrency(settings.defaultCurrency || 'USD')
  );

  // Update currency when settings change
  useEffect(() => {
    if (settings.defaultCurrency) {
      setCurrencyState(getCurrency(settings.defaultCurrency));
    }
  }, [settings.defaultCurrency]);

  const setCurrency = (code: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY') => {
    setCurrencyState(CURRENCIES[code]);
  };

  const convertPrice = (priceInUSD: number): number => {
    return priceInUSD * currency.rate;
  };

  const formatPrice = (priceInUSD: number, decimals?: number): string => {
    const convertedPrice = convertPrice(priceInUSD);
    const decimalPlaces = decimals !== undefined ? decimals : 
      settings.priceDecimals !== undefined ? settings.priceDecimals :
      currency.code === 'JPY' ? 0 : 2;
    
    const formattedNumber = convertedPrice.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
    
    // Format with currency symbol
    switch (currency.code) {
      case 'EUR':
        return `€${formattedNumber}`;
      case 'GBP':
        return `£${formattedNumber}`;
      case 'JPY':
      case 'CNY':
        return `¥${formattedNumber}`;
      default:
        return `$${formattedNumber}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convertPrice, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};