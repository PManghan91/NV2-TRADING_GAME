import React, { useState, useEffect } from 'react';
import { X, Settings, Moon, Sun, Clock, TrendingUp, Grid, Volume2, DollarSign } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserSettings {
  theme: 'dark' | 'light';
  timezone: 'local' | 'utc' | 'exchange';
  chartType: 'candles' | 'line' | 'bars';
  showVolume: boolean;
  showGrid: boolean;
  soundEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  priceDecimals: number;
  compactMode: boolean;
  defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  timezone: 'local',
  chartType: 'candles',
  showVolume: true,
  showGrid: true,
  soundEnabled: false,
  autoRefresh: true,
  refreshInterval: 5,
  priceDecimals: 2,
  compactMode: false,
  defaultCurrency: 'USD'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('tradingDashboardSettings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('tradingDashboardSettings', JSON.stringify(settings));
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', settings.theme);
    
    // Dispatch custom event for other components to react to settings changes
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
  }, [settings]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Dashboard Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* Appearance Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Appearance</h3>
              
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.theme === 'dark' ? <Moon className="w-4 h-4 text-gray-500" /> : <Sun className="w-4 h-4 text-gray-500" />}
                  <div>
                    <p className="text-white font-medium">Theme</p>
                    <p className="text-xs text-gray-500">Choose your preferred color scheme</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSetting('theme', 'light')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      settings.theme === 'light' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => updateSetting('theme', 'dark')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      settings.theme === 'dark' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Grid className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Compact Mode</p>
                    <p className="text-xs text-gray-500">Reduce spacing for more information density</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.compactMode}
                    onChange={(e) => updateSetting('compactMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Time & Data Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Time & Data</h3>
              
              {/* Default Currency */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Default Currency</p>
                    <p className="text-xs text-gray-500">Display prices in your preferred currency</p>
                  </div>
                </div>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => updateSetting('defaultCurrency', e.target.value as any)}
                  className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CNY">CNY (¥)</option>
                </select>
              </div>
              
              {/* Timezone */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Timezone</p>
                    <p className="text-xs text-gray-500">Display times in your preferred timezone</p>
                  </div>
                </div>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateSetting('timezone', e.target.value as any)}
                  className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="local">Local Time</option>
                  <option value="utc">UTC</option>
                  <option value="exchange">Exchange Time</option>
                </select>
              </div>

              {/* Auto Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Auto Refresh</p>
                    <p className="text-xs text-gray-500">Automatically update prices and charts</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoRefresh}
                    onChange={(e) => updateSetting('autoRefresh', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Price Decimals */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 text-gray-500 text-center font-mono text-xs">.0</span>
                  <div>
                    <p className="text-white font-medium">Price Decimals</p>
                    <p className="text-xs text-gray-500">Number of decimal places for prices</p>
                  </div>
                </div>
                <select
                  value={settings.priceDecimals}
                  onChange={(e) => updateSetting('priceDecimals', parseInt(e.target.value))}
                  className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="0">0</option>
                  <option value="2">2</option>
                  <option value="4">4</option>
                  <option value="8">8</option>
                </select>
              </div>
            </div>

            {/* Chart Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chart</h3>
              
              {/* Default Chart Type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Default Chart Type</p>
                    <p className="text-xs text-gray-500">Preferred chart visualization</p>
                  </div>
                </div>
                <select
                  value={settings.chartType}
                  onChange={(e) => updateSetting('chartType', e.target.value as any)}
                  className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="candles">Candlestick</option>
                  <option value="line">Line</option>
                  <option value="bars">Bars</option>
                </select>
              </div>

              {/* Show Volume */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Show Volume</p>
                    <p className="text-xs text-gray-500">Display volume chart below price chart</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showVolume}
                    onChange={(e) => updateSetting('showVolume', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Show Grid */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Grid className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Show Grid Lines</p>
                    <p className="text-xs text-gray-500">Display grid lines on charts</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) => updateSetting('showGrid', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Audio Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Audio</h3>
              
              {/* Sound Alerts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">Sound Alerts</p>
                    <p className="text-xs text-gray-500">Play sounds for price alerts and notifications</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Export settings hook
export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('tradingDashboardSettings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const handleSettingsUpdate = (e: CustomEvent<UserSettings>) => {
      setSettings(e.detail);
    };

    window.addEventListener('settingsUpdated' as any, handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated' as any, handleSettingsUpdate);
  }, []);

  return settings;
};