import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
// import { marketDataService } from '../services/MarketDataService';
import { useConnectionStatus } from '../stores/marketStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const connectionStatus = useConnectionStatus();

  useEffect(() => {
    // DISABLED: Finnhub WebSocket - using Binance WebSocket for crypto instead
    // marketDataService.initialize().catch(error => {
    //   console.error('Failed to initialize market data service:', error);
    // });

    // Cleanup on unmount
    return () => {
      // marketDataService.shutdown();
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-trading-bg text-white flex flex-col">
      {/* Header */}
      <Header onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Connection status banner */}
          {connectionStatus !== 'connected' && (
            <div className={`
              mb-4 p-3 rounded-lg border-l-4 
              ${connectionStatus === 'connecting' 
                ? 'bg-yellow-900 border-yellow-500 text-yellow-200'
                : connectionStatus === 'error'
                ? 'bg-red-900 border-red-500 text-red-200'  
                : 'bg-gray-800 border-gray-500 text-gray-300'
              }
            `}>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${
                  connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                <span className="text-sm font-medium">
                  {connectionStatus === 'connecting' && 'Connecting to market data...'}
                  {connectionStatus === 'disconnected' && 'Market data disconnected. Some features may be limited.'}
                  {connectionStatus === 'error' && 'Connection error. Please check your API configuration.'}
                </span>
              </div>
            </div>
          )}

          {/* Main content area */}
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Portfolio Summary Card Component
export const PortfolioSummary: React.FC = () => {
  const portfolioData = {
    totalValue: 100000,
    dayChange: 0,
    dayChangePercent: 0,
  };

  return (
    <div className="trading-card">
      <h2 className="text-lg font-semibold mb-4 text-white">Portfolio Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center md:text-left">
          <div className="text-sm text-gray-400 mb-1">Total Value</div>
          <div className="text-2xl font-mono font-bold text-white">
            ${portfolioData.totalValue.toLocaleString()}
          </div>
        </div>
        <div className="text-center md:text-left">
          <div className="text-sm text-gray-400 mb-1">Day Change</div>
          <div className={`text-xl font-mono font-bold ${
            portfolioData.dayChange >= 0 ? 'text-trading-green' : 'text-trading-red'
          }`}>
            {portfolioData.dayChange >= 0 ? '+' : ''}${portfolioData.dayChange.toFixed(2)}
          </div>
        </div>
        <div className="text-center md:text-left">
          <div className="text-sm text-gray-400 mb-1">Day Change %</div>
          <div className={`text-xl font-mono font-bold ${
            portfolioData.dayChangePercent >= 0 ? 'text-trading-green' : 'text-trading-red'
          }`}>
            {portfolioData.dayChangePercent >= 0 ? '+' : ''}{portfolioData.dayChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

// Quick Actions Component
export const QuickActions: React.FC = () => {
  return (
    <div className="trading-card">
      <h2 className="text-lg font-semibold mb-4 text-white">Quick Actions</h2>
      <div className="flex flex-wrap gap-3">
        <button className="trading-button trading-button-success">
          Buy Stock
        </button>
        <button className="trading-button trading-button-danger">
          Sell Position
        </button>
        <button className="trading-button trading-button-primary">
          View Orders
        </button>
        <button className="trading-button trading-button-primary">
          Add to Watchlist
        </button>
      </div>
    </div>
  );
};

// Market Overview Component
export const MarketOverview: React.FC = () => {
  return (
    <div className="trading-card">
      <h2 className="text-lg font-semibold mb-4 text-white">Market Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">S&P 500</div>
          <div className="text-lg font-mono text-white">4,185.47</div>
          <div className="text-sm text-trading-green">+0.75%</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">NASDAQ</div>
          <div className="text-lg font-mono text-white">12,839.29</div>
          <div className="text-sm text-trading-red">-0.23%</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">BTC/USD</div>
          <div className="text-lg font-mono text-white">$43,250</div>
          <div className="text-sm text-trading-green">+2.45%</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">EUR/USD</div>
          <div className="text-lg font-mono text-white">1.0825</div>
          <div className="text-sm text-trading-red">-0.12%</div>
        </div>
      </div>
    </div>
  );
};