import React, { useState, useEffect } from 'react';
import { getMarketStatus, formatTimeUntil, MarketHours } from '../utils/marketHours';

export const MarketStatus: React.FC = () => {
  const [marketStatus, setMarketStatus] = useState<MarketHours>(getMarketStatus());

  useEffect(() => {
    const updateStatus = () => {
      setMarketStatus(getMarketStatus());
    };

    // Update every minute
    const interval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const { isOpen, nextOpen, nextClose } = marketStatus;

  return (
    <div className={`mb-4 p-4 rounded-lg border-l-4 ${
      isOpen 
        ? 'bg-green-900 border-green-500' 
        : 'bg-gray-800 border-gray-500'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          }`} />
          <div>
            <h3 className="font-semibold text-white">
              US Stock Market
            </h3>
            <p className={`text-sm ${
              isOpen ? 'text-green-200' : 'text-gray-300'
            }`}>
              {isOpen ? 'Currently Open' : 'Currently Closed'}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-300">
            {isOpen ? 'Closes in' : 'Opens in'}
          </div>
          <div className="font-mono font-semibold text-white">
            {isOpen && nextClose ? formatTimeUntil(nextClose) : ''}
            {!isOpen && nextOpen ? formatTimeUntil(nextOpen) : ''}
          </div>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-400">
        <div>Market Hours: 9:30 AM - 4:00 PM EST (Monday-Friday)</div>
        <div className="mt-1">
          {isOpen ? (
            <span className="text-green-400">
              ✅ Live data streaming available
            </span>
          ) : (
            <span className="text-yellow-400">
              📊 Showing last available prices - Live data when market opens
            </span>
          )}
        </div>
      </div>
    </div>
  );
};