import React from 'react';
import { useConnectionStatus } from '../stores/marketStore';
import { WSConnectionStatus } from '../services/WebSocketManager';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const getStatusColor = (status: WSConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'text-trading-green';
    case 'connecting':
      return 'text-yellow-500';
    case 'disconnected':
      return 'text-gray-400';
    case 'error':
      return 'text-trading-red';
    default:
      return 'text-gray-400';
  }
};

const getStatusText = (status: WSConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Live';
    case 'connecting':
      return 'Connecting';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
};

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const connectionStatus = useConnectionStatus();

  return (
    <header className="bg-trading-surface border-b border-trading-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {/* Mobile menu button */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-md hover:bg-trading-border transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-white">TradingDashboard</h1>
          <span className="text-sm text-gray-400 hidden sm:inline">v1.0</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Market Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' 
              ? 'bg-trading-green animate-pulse' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-gray-400'
          }`}></div>
          <span className={`text-sm font-medium ${getStatusColor(connectionStatus)}`}>
            {getStatusText(connectionStatus)}
          </span>
        </div>

        {/* Current time */}
        <div className="text-sm text-gray-400 hidden sm:block">
          {new Date().toLocaleTimeString()}
        </div>

        {/* User menu placeholder */}
        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium text-white">U</span>
        </div>
      </div>
    </header>
  );
};