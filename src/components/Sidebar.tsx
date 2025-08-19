import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', active: true },
  { id: 'trading', label: 'Trading', icon: '💱' },
  { id: 'portfolio', label: 'Portfolio', icon: '💼' },
  { id: 'history', label: 'History', icon: '📈' },
  { id: 'analysis', label: 'Analysis', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleNavigation = (path: string) => {
    navigate(`/${path}`);
    onClose(); // Close sidebar on mobile after navigation
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 w-80 h-full bg-trading-surface border-r border-trading-border
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Close button for mobile */}
          <div className="flex justify-end p-4 md:hidden">
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-trading-border transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Navigation
            </h2>
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = location.pathname === `/${item.id}`;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavigation(item.id)}
                      className={`
                        w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left
                        transition-colors duration-200
                        ${isActive 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-300 hover:bg-trading-border hover:text-white'
                        }
                      `}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Spacer to push footer to bottom */}
          <div className="flex-1"></div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-trading-border">
            <div className="text-xs text-gray-400 text-center">
              <p>Demo Trading Environment</p>
              <p className="mt-1">All data is for educational purposes</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};