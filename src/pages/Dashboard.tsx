import React from 'react';
import { MarketDataStatus } from '../components/MarketDataProvider';
import { MarketStatus } from '../components/MarketStatus';
import { PortfolioSummary } from '../components/DashboardLayout';
import { StockPriceWidget } from '../components/StockPriceWidget';
import { CryptoPriceWidget } from '../components/CryptoPriceWidget';
import { TradingChart } from '../components/TradingChart';
import { AdvancedOrderPanel } from '../components/AdvancedOrderPanel';

export const Dashboard: React.FC = () => {
  return (
    <>
      {/* Market Data Status - Connection info */}
      <MarketDataStatus />
      
      {/* Market Status - US Stock Market */}
      <MarketStatus />
      
      {/* Portfolio Summary */}
      <PortfolioSummary />
    
      {/* Stock Price Widget */}
      <StockPriceWidget />
      
      {/* Crypto Price Widget */}
      <CryptoPriceWidget />
      
      {/* Main dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Market data and charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Advanced Trading Chart */}
          <TradingChart symbol="BTCUSDT" height={500} />
        </div>
        
        {/* Right column - Trading panel and activities */}
        <div className="space-y-6">
          {/* Advanced Order Panel */}
          <AdvancedOrderPanel />
          
          {/* Recent Activity */}
          <div className="trading-card">
            <h2 className="text-lg font-semibold mb-4 text-white">Recent Activity</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">No recent trades</span>
                <span className="text-gray-500">--</span>
              </div>
              <div className="text-center text-gray-500 text-sm py-8">
                Start trading to see your activity here
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};