import React, { useState, useEffect } from 'react';
import { wsManager } from '../services/WebSocketManager';
import { API_CONFIG } from '../utils/constants';

export const WebSocketDebugger: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState(wsManager.getConnectionStatus());
  const [lastError, setLastError] = useState<string>('');
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{
    apiKeyValid: boolean | null;
    urlReachable: boolean | null;
    manualConnection: boolean | null;
  }>({
    apiKeyValid: null,
    urlReachable: null,
    manualConnection: null,
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const handleStatusChange = (status: any) => {
      setConnectionStatus(status);
      addLog(`Status changed to: ${status}`);
    };

    wsManager.setStatusChangeHandler(handleStatusChange);
    
    return () => {
      wsManager.setStatusChangeHandler(() => {});
    };
  }, []);

  const testApiKey = async () => {
    addLog('Testing API key with REST endpoint...');
    try {
      const response = await fetch(
        `${API_CONFIG.FINNHUB.BASE_URL}/quote?symbol=AAPL&token=${API_CONFIG.FINNHUB.API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.c && data.c > 0) {
          setTestResults(prev => ({ ...prev, apiKeyValid: true }));
          addLog('✅ API key is valid - REST endpoint responded with data');
        } else {
          setTestResults(prev => ({ ...prev, apiKeyValid: false }));
          addLog('❌ API key may be invalid - REST endpoint returned empty data');
        }
      } else {
        setTestResults(prev => ({ ...prev, apiKeyValid: false }));
        addLog(`❌ API key test failed - HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, apiKeyValid: false }));
      addLog(`❌ API key test error: ${error}`);
    }
  };

  const testWebSocketEndpoint = () => {
    addLog('Testing manual WebSocket connection...');
    setTestResults(prev => ({ ...prev, manualConnection: null }));
    
    try {
      const wsUrl = `${API_CONFIG.FINNHUB.WS_URL}?token=${API_CONFIG.FINNHUB.API_KEY}`;
      addLog(`Connecting to: ${wsUrl}`);
      
      const testWs = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        testWs.close();
        setTestResults(prev => ({ ...prev, manualConnection: false }));
        addLog('❌ Manual WebSocket connection timed out after 10 seconds');
      }, 10000);

      testWs.onopen = () => {
        clearTimeout(timeout);
        addLog('✅ Manual WebSocket connection opened successfully');
        setTestResults(prev => ({ ...prev, manualConnection: true }));
        
        // Test subscription
        const testMessage = JSON.stringify({type: 'subscribe', symbol: 'AAPL'});
        testWs.send(testMessage);
        addLog(`Sent test subscription: ${testMessage}`);
        
        setTimeout(() => testWs.close(), 5000);
      };

      testWs.onmessage = (event) => {
        addLog(`📨 Received message: ${event.data}`);
      };

      testWs.onerror = (error) => {
        clearTimeout(timeout);
        addLog(`❌ Manual WebSocket error: ${error}`);
        setTestResults(prev => ({ ...prev, manualConnection: false }));
      };

      testWs.onclose = (event) => {
        clearTimeout(timeout);
        addLog(`Manual WebSocket closed: Code ${event.code} - ${event.reason || 'No reason'}`);
        if (event.code === 1000) {
          addLog('✅ Clean close - connection was successful');
        } else if (event.code === 1006) {
          addLog('❌ Abnormal closure - likely authentication or network issue');
        }
      };

    } catch (error) {
      setTestResults(prev => ({ ...prev, manualConnection: false }));
      addLog(`❌ Failed to create manual WebSocket: ${error}`);
    }
  };

  const connectWebSocket = () => {
    addLog('Attempting to connect via WebSocketManager...');
    wsManager.connect()
      .then(() => {
        addLog('✅ WebSocketManager connected successfully');
      })
      .catch((error) => {
        addLog(`❌ WebSocketManager connection failed: ${error}`);
        setLastError(error.toString());
      });
  };

  const disconnectWebSocket = () => {
    addLog('Disconnecting WebSocket...');
    wsManager.disconnect();
  };

  const runAllTests = () => {
    setConnectionLogs([]);
    addLog('🧪 Starting comprehensive WebSocket diagnostics...');
    testApiKey();
    setTimeout(() => testWebSocketEndpoint(), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="trading-card">
      <h3 className="text-lg font-semibold text-white mb-4">WebSocket Diagnostics</h3>
      
      {/* Current Status */}
      <div className="mb-4 p-3 bg-trading-bg rounded-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300">Current Status:</span>
          <span className={`font-mono font-semibold ${getStatusColor(connectionStatus)}`}>
            {connectionStatus.toUpperCase()}
          </span>
        </div>
        
        <div className="text-sm text-gray-400">
          <div>API Key: {API_CONFIG.FINNHUB.API_KEY ? `${API_CONFIG.FINNHUB.API_KEY.substring(0, 8)}...` : 'Not configured'}</div>
          <div>WebSocket URL: {API_CONFIG.FINNHUB.WS_URL}</div>
        </div>
      </div>

      {/* Test Results */}
      <div className="mb-4 p-3 bg-trading-bg rounded-md">
        <h4 className="text-sm font-semibold text-white mb-2">Test Results</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">API Key Valid:</span>
            <span className={testResults.apiKeyValid === true ? 'text-green-400' : testResults.apiKeyValid === false ? 'text-red-400' : 'text-gray-400'}>
              {testResults.apiKeyValid === null ? 'Not tested' : testResults.apiKeyValid ? '✅ Valid' : '❌ Invalid'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Manual WebSocket:</span>
            <span className={testResults.manualConnection === true ? 'text-green-400' : testResults.manualConnection === false ? 'text-red-400' : 'text-gray-400'}>
              {testResults.manualConnection === null ? 'Not tested' : testResults.manualConnection ? '✅ Success' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={runAllTests}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Run Diagnostics
        </button>
        <button
          onClick={connectWebSocket}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
        >
          Connect WebSocket
        </button>
        <button
          onClick={disconnectWebSocket}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Connection Logs */}
      <div className="bg-black rounded-md p-3 max-h-64 overflow-y-auto">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Connection Logs</h4>
        <div className="space-y-1">
          {connectionLogs.length === 0 ? (
            <div className="text-gray-500 text-xs">No logs yet. Click "Run Diagnostics" to start testing.</div>
          ) : (
            connectionLogs.map((log, index) => (
              <div key={index} className="text-xs font-mono text-gray-300">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};