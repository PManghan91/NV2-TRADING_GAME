import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { MarketDataProvider } from './components/MarketDataProvider';
import { HybridDataProvider } from './components/HybridDataProvider';
import { Dashboard } from './pages/Dashboard';
import { Trading } from './pages/Trading';

function App() {
  return (
    <Router>
      <MarketDataProvider>
        {/* Auto-connect to data sources: Binance WebSocket + Stock REST API */}
        <HybridDataProvider />
        
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          } />
          <Route path="/trading" element={<Trading />} />
          <Route path="/portfolio" element={
            <DashboardLayout>
              <div className="trading-card">
                <h2 className="text-2xl font-bold text-white mb-4">Portfolio</h2>
                <p className="text-gray-400">Portfolio management coming soon...</p>
              </div>
            </DashboardLayout>
          } />
          <Route path="/history" element={
            <DashboardLayout>
              <div className="trading-card">
                <h2 className="text-2xl font-bold text-white mb-4">History</h2>
                <p className="text-gray-400">Trade history coming soon...</p>
              </div>
            </DashboardLayout>
          } />
          <Route path="/analysis" element={
            <DashboardLayout>
              <div className="trading-card">
                <h2 className="text-2xl font-bold text-white mb-4">Analysis</h2>
                <p className="text-gray-400">Market analysis coming soon...</p>
              </div>
            </DashboardLayout>
          } />
          <Route path="/settings" element={
            <DashboardLayout>
              <div className="trading-card">
                <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
                <p className="text-gray-400">Settings panel coming soon...</p>
              </div>
            </DashboardLayout>
          } />
        </Routes>
      </MarketDataProvider>
    </Router>
  );
}

export default App;
