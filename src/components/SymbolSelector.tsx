import React, { useState, useRef, useEffect } from 'react';

interface SymbolInfo {
  symbol: string;
  name: string;
  type: 'crypto' | 'stock';
  icon: string;
}

interface SymbolSelectorProps {
  symbols: SymbolInfo[];
  selectedSymbol: SymbolInfo;
  onSymbolChange: (symbol: SymbolInfo) => void;
}

export const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  symbols,
  selectedSymbol,
  onSymbolChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: SymbolInfo) => {
    onSymbolChange(symbol);
    setIsOpen(false);
  };

  const cryptoSymbols = symbols.filter(s => s.type === 'crypto');
  const stockSymbols = symbols.filter(s => s.type === 'stock');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-trading-card-dark text-white px-4 py-2 rounded-md border border-trading-border hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors flex items-center space-x-2 min-w-[200px]"
      >
        <span className="text-lg">{selectedSymbol.icon}</span>
        <span className="flex-1 text-left">{selectedSymbol.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-trading-surface border border-trading-border rounded-md shadow-xl max-h-96 overflow-y-auto">
          {/* Cryptocurrencies */}
          {cryptoSymbols.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-black bg-opacity-20">
                Cryptocurrencies
              </div>
              {cryptoSymbols.map(symbol => (
                <button
                  key={symbol.symbol}
                  onClick={() => handleSelect(symbol)}
                  className={`w-full px-3 py-2 text-left hover:bg-trading-border transition-colors flex items-center space-x-2 ${
                    selectedSymbol.symbol === symbol.symbol
                      ? 'bg-blue-600 bg-opacity-20 text-blue-400'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{symbol.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{symbol.name}</div>
                    <div className="text-xs text-gray-500">{symbol.symbol}</div>
                  </div>
                  {selectedSymbol.symbol === symbol.symbol && (
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Stocks */}
          {stockSymbols.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-black bg-opacity-20 border-t border-trading-border">
                Stocks
              </div>
              {stockSymbols.map(symbol => (
                <button
                  key={symbol.symbol}
                  onClick={() => handleSelect(symbol)}
                  className={`w-full px-3 py-2 text-left hover:bg-trading-border transition-colors flex items-center space-x-2 ${
                    selectedSymbol.symbol === symbol.symbol
                      ? 'bg-blue-600 bg-opacity-20 text-blue-400'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{symbol.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{symbol.name}</div>
                    <div className="text-xs text-gray-500">{symbol.symbol}</div>
                  </div>
                  {selectedSymbol.symbol === symbol.symbol && (
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};