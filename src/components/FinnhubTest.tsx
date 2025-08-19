import React, { useState } from 'react';

export const FinnhubTest: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[FinnhubTest] ${message}`);
  };

  const testWithDemoKey = () => {
    setLogs([]);
    addLog('Testing with Finnhub demo/sandbox key...');
    
    // Try with a demo key first to see if the issue is API key related
    const demoKey = 'sandbox_c7q5a8iad3i9vd5g9ujg'; // Finnhub's public sandbox key
    const wsUrl = `wss://ws.finnhub.io?token=${demoKey}`;
    
    addLog(`Connecting to: ${wsUrl}`);
    
    try {
      const testWs = new WebSocket(wsUrl);
      
      testWs.onopen = () => {
        addLog('✅ Connected with sandbox key!');
        
        // Test subscription
        const msg = JSON.stringify({type: 'subscribe', symbol: 'AAPL'});
        testWs.send(msg);
        addLog(`Sent: ${msg}`);
        
        setWs(testWs);
      };
      
      testWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addLog(`📨 Message: ${JSON.stringify(data).substring(0, 100)}`);
      };
      
      testWs.onerror = (error) => {
        addLog(`❌ Error with sandbox key`);
        console.error('Sandbox WebSocket error:', error);
      };
      
      testWs.onclose = (event) => {
        addLog(`Closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
        setWs(null);
      };
      
    } catch (error: any) {
      addLog(`❌ Exception: ${error.message}`);
    }
  };

  const testWithYourKey = () => {
    setLogs([]);
    addLog('Testing with your API key...');
    
    const yourKey = process.env.REACT_APP_FINNHUB_API_KEY || '';
    const wsUrl = `wss://ws.finnhub.io?token=${yourKey}`;
    
    addLog(`Connecting to: ${wsUrl.substring(0, 50)}...`);
    
    try {
      const testWs = new WebSocket(wsUrl);
      
      let connectionTimer: any;
      
      testWs.onopen = () => {
        addLog('✅ Connected with your key!');
        
        // Wait a bit before subscribing
        setTimeout(() => {
          const msg = JSON.stringify({type: 'subscribe', symbol: 'AAPL'});
          testWs.send(msg);
          addLog(`Sent: ${msg}`);
        }, 1000);
        
        // Keep alive - send ping every 20 seconds
        connectionTimer = setInterval(() => {
          if (testWs.readyState === WebSocket.OPEN) {
            const ping = JSON.stringify({type: 'ping'});
            testWs.send(ping);
            addLog('Sent ping to keep connection alive');
          }
        }, 20000);
        
        setWs(testWs);
      };
      
      testWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping') {
            addLog('📨 Received pong');
          } else {
            addLog(`📨 Data: ${JSON.stringify(data).substring(0, 100)}`);
          }
        } catch {
          addLog(`📨 Raw message: ${event.data.substring(0, 100)}`);
        }
      };
      
      testWs.onerror = (error) => {
        addLog(`❌ Error with your key`);
        console.error('Your key WebSocket error:', error);
        if (connectionTimer) clearInterval(connectionTimer);
      };
      
      testWs.onclose = (event) => {
        addLog(`Closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
        if (connectionTimer) clearInterval(connectionTimer);
        setWs(null);
        
        if (event.code === 1006) {
          addLog('💡 Error 1006 - Possible causes:');
          addLog('• API key doesn\'t have WebSocket access');
          addLog('• Account is on free tier without real-time data');
          addLog('• Rate limit exceeded');
          addLog('• Key was recently created (needs time to activate)');
        }
      };
      
    } catch (error: any) {
      addLog(`❌ Exception: ${error.message}`);
    }
  };

  const closeConnection = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      addLog('Manually closed connection');
    }
  };

  const checkAPIKeyStatus = async () => {
    setLogs([]);
    addLog('Checking API key status via REST...');
    
    const yourKey = process.env.REACT_APP_FINNHUB_API_KEY || '';
    
    try {
      // Test basic quote endpoint
      const quoteResponse = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${yourKey}`
      );
      
      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        addLog(`✅ Quote endpoint works: AAPL = $${quoteData.c}`);
      } else {
        addLog(`❌ Quote endpoint failed: ${quoteResponse.status}`);
      }
      
      // Test WebSocket availability endpoint (if exists)
      const wsStatusResponse = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=AAPL&resolution=1&from=${Math.floor(Date.now()/1000) - 60}&to=${Math.floor(Date.now()/1000)}&token=${yourKey}`
      );
      
      if (wsStatusResponse.ok) {
        addLog('✅ Real-time data endpoint accessible');
      } else {
        addLog(`⚠️ Real-time data endpoint status: ${wsStatusResponse.status}`);
      }
      
      // Check rate limit headers
      const rateLimitRemaining = quoteResponse.headers.get('X-Ratelimit-Remaining');
      const rateLimitReset = quoteResponse.headers.get('X-Ratelimit-Reset');
      
      if (rateLimitRemaining) {
        addLog(`Rate limit remaining: ${rateLimitRemaining}`);
      }
      if (rateLimitReset) {
        addLog(`Rate limit resets at: ${new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString()}`);
      }
      
    } catch (error: any) {
      addLog(`❌ Error checking API: ${error.message}`);
    }
  };

  return (
    <div className="trading-card">
      <h3 className="text-lg font-semibold text-white mb-4">Finnhub WebSocket Test</h3>
      
      <div className="mb-4 p-3 bg-yellow-900 rounded">
        <p className="text-yellow-200 text-sm">
          This tests WebSocket connections with different API keys to isolate the issue.
        </p>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testWithDemoKey}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          Test Sandbox Key
        </button>
        <button
          onClick={testWithYourKey}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Test Your Key
        </button>
        <button
          onClick={checkAPIKeyStatus}
          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
        >
          Check API Status
        </button>
        <button
          onClick={closeConnection}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          disabled={!ws}
        >
          Close Connection
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
      
      {ws && (
        <div className="mt-3 p-2 bg-green-900 rounded">
          <span className="text-green-200 text-sm">🟢 WebSocket is connected</span>
        </div>
      )}
    </div>
  );
};