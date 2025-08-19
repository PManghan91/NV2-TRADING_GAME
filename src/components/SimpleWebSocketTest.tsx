import React, { useState } from 'react';

export const SimpleWebSocketTest: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testDirectConnection = () => {
    setLogs([]);
    addLog('Starting direct WebSocket test...');
    
    const apiKey = process.env.REACT_APP_FINNHUB_API_KEY || '';
    
    // Test 1: Try the exact URL format from Finnhub docs
    const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`;
    addLog(`Attempting connection to: ${wsUrl.substring(0, 50)}...`);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        addLog('✅ WebSocket opened!');
        
        // Try subscribing to a symbol as per Finnhub docs
        const subscribeMsg = JSON.stringify({'type':'subscribe', 'symbol': 'AAPL'});
        ws.send(subscribeMsg);
        addLog(`Sent: ${subscribeMsg}`);
      };
      
      ws.onmessage = (event) => {
        addLog(`📨 Received: ${event.data.substring(0, 100)}`);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error details:', error);
        addLog(`❌ Error occurred (check console for details)`);
      };
      
      ws.onclose = (event) => {
        addLog(`Closed: Code ${event.code}, Reason: ${event.reason || 'None'}, Clean: ${event.wasClean}`);
        
        // Try to provide more specific error information
        if (event.code === 1006) {
          addLog('Error 1006 typically means:');
          addLog('• Network/firewall blocking WebSocket');
          addLog('• Invalid API key format');
          addLog('• Finnhub service issue');
          addLog('• CORS or browser security restriction');
        }
      };
      
      // Auto-close after 15 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          addLog('Auto-closing after 15 seconds...');
          ws.close();
        }
      }, 15000);
      
    } catch (error: any) {
      addLog(`❌ Failed to create WebSocket: ${error.message}`);
    }
  };

  const testAlternativeEndpoint = () => {
    setLogs([]);
    addLog('Testing alternative connection methods...');
    
    // Test if we can reach Finnhub at all
    fetch('https://finnhub.io/api/v1/stock/symbol?exchange=US&token=d1ld9g9r01qt4thfg8s0d1ld9g9r01qt4thfg8sg')
      .then(response => {
        if (response.ok) {
          addLog('✅ REST API is accessible');
        } else {
          addLog(`❌ REST API returned status: ${response.status}`);
        }
      })
      .catch(error => {
        addLog(`❌ Cannot reach Finnhub REST API: ${error.message}`);
      });
    
    // Try WebSocket with different parameters
    const apiKey = process.env.REACT_APP_FINNHUB_API_KEY || '';
    
    // Test without SSL (not recommended for production)
    addLog('Note: WebSocket must use wss:// (secure) in browser');
    
    // Try with explicit protocol
    try {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`, []);
      
      ws.onopen = () => addLog('✅ Connected with explicit protocol!');
      ws.onerror = () => addLog('❌ Failed with explicit protocol');
      ws.onclose = (e) => addLog(`Closed with explicit protocol: ${e.code}`);
      
      setTimeout(() => ws.close(), 5000);
    } catch (error: any) {
      addLog(`Cannot create WebSocket: ${error.message}`);
    }
  };

  const testWithDifferentBrowser = () => {
    setLogs([]);
    addLog('Browser Compatibility Check:');
    addLog(`User Agent: ${navigator.userAgent.substring(0, 50)}...`);
    addLog(`WebSocket Support: ${typeof WebSocket !== 'undefined' ? 'Yes' : 'No'}`);
    
    if (typeof WebSocket !== 'undefined') {
      addLog(`WebSocket.CONNECTING: ${WebSocket.CONNECTING}`);
      addLog(`WebSocket.OPEN: ${WebSocket.OPEN}`);
      addLog(`WebSocket.CLOSING: ${WebSocket.CLOSING}`);
      addLog(`WebSocket.CLOSED: ${WebSocket.CLOSED}`);
    }
    
    // Check for any browser extensions that might block WebSockets
    addLog('');
    addLog('If connection fails, try:');
    addLog('1. Disable browser extensions (ad blockers, privacy tools)');
    addLog('2. Try in Incognito/Private mode');
    addLog('3. Try a different browser');
    addLog('4. Check Windows Firewall/Defender settings');
    addLog('5. Check if VPN is interfering');
  };

  return (
    <div className="trading-card">
      <h3 className="text-lg font-semibold text-white mb-4">Simple WebSocket Test</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={testDirectConnection}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Test Direct Connection
        </button>
        <button
          onClick={testAlternativeEndpoint}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          Test Alternatives
        </button>
        <button
          onClick={testWithDifferentBrowser}
          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
        >
          Browser Check
        </button>
      </div>
      
      <div className="bg-black rounded p-3 max-h-96 overflow-y-auto">
        <div className="space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-xs">Click a button to start testing...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-xs font-mono text-gray-300">{log}</div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-yellow-900 rounded text-yellow-200 text-xs">
        <strong>Note:</strong> If WebSocket fails with error 1006, it's usually a connection issue rather than an API problem.
        The fact that REST API works but WebSocket doesn't suggests a WebSocket-specific blocking issue.
      </div>
    </div>
  );
};