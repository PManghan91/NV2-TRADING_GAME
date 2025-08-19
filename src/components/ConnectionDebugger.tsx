import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../utils/constants';

interface ConnectionTest {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

export const ConnectionDebugger: React.FC = () => {
  const [tests, setTests] = useState<ConnectionTest[]>([
    { name: 'Environment Variables', status: 'pending', message: 'Checking...' },
    { name: 'Finnhub REST API', status: 'pending', message: 'Testing...' },
    { name: 'Finnhub WebSocket', status: 'pending', message: 'Testing...' },
    { name: 'CoinGecko API', status: 'pending', message: 'Testing...' },
  ]);

  const updateTest = (index: number, updates: Partial<ConnectionTest>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...updates } : test));
  };

  const runTests = async () => {
    console.log('🧪 Starting comprehensive connection tests...');

    // Test 1: Environment Variables
    const finnhubKey = API_CONFIG.FINNHUB.API_KEY;
    const coinGeckoKey = API_CONFIG.COINGECKO.API_KEY;
    
    if (finnhubKey && finnhubKey.length > 10) {
      updateTest(0, {
        status: 'success',
        message: `Finnhub key loaded (${finnhubKey.slice(0, 8)}...${finnhubKey.slice(-4)})`,
        details: { length: finnhubKey.length }
      });
    } else {
      updateTest(0, {
        status: 'error',
        message: 'Finnhub API key missing or too short',
        details: { key: finnhubKey, length: finnhubKey?.length || 0 }
      });
      return; // Stop tests if no API key
    }

    // Test 2: Finnhub REST API
    try {
      console.log('Testing Finnhub REST API...');
      const restUrl = `${API_CONFIG.FINNHUB.BASE_URL}/quote?symbol=AAPL&token=${finnhubKey}`;
      console.log('REST URL:', restUrl);
      
      const response = await fetch(restUrl);
      const data = await response.json();
      
      console.log('REST Response:', { status: response.status, data });
      
      if (response.ok && data.c && data.c > 0) {
        updateTest(1, {
          status: 'success',
          message: `REST API working - AAPL: $${data.c}`,
          details: data
        });
      } else {
        updateTest(1, {
          status: 'error',
          message: `REST API error: ${JSON.stringify(data)}`,
          details: { status: response.status, data }
        });
      }
    } catch (error) {
      console.error('REST API Error:', error);
      updateTest(1, {
        status: 'error',
        message: `REST API failed: ${error}`,
        details: error
      });
    }

    // Test 3: Finnhub WebSocket
    console.log('Testing Finnhub WebSocket...');
    const wsUrl = `${API_CONFIG.FINNHUB.WS_URL}?token=${finnhubKey}`;
    console.log('WebSocket URL:', wsUrl);

    try {
      const wsTest = await new Promise<{ success: boolean; message: string; details?: any }>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              message: 'WebSocket connection timeout (15 seconds)',
              details: { timeout: true }
            });
          }
        }, 15000);

        const ws = new WebSocket(wsUrl);
        let connectionTime = Date.now();

        ws.onopen = () => {
          connectionTime = Date.now() - connectionTime;
          console.log('✅ WebSocket connected in', connectionTime, 'ms');
          
          // Send test subscription
          const testMessage = JSON.stringify({ type: 'subscribe', symbol: 'AAPL' });
          ws.send(testMessage);
          console.log('📡 Sent test subscription:', testMessage);
        };

        ws.onmessage = (event) => {
          console.log('📨 WebSocket message received:', event.data);
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            
            try {
              const messageData = JSON.parse(event.data);
              resolve({
                success: true,
                message: `WebSocket working - Connected in ${connectionTime}ms`,
                details: { connectionTime, firstMessage: messageData }
              });
            } catch {
              resolve({
                success: true,
                message: `WebSocket working - Connected in ${connectionTime}ms`,
                details: { connectionTime, firstMessage: event.data }
              });
            }
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: `WebSocket error: ${error}`,
              details: error
            });
          }
        };

        ws.onclose = (event) => {
          console.log('🔒 WebSocket closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: `WebSocket closed: Code ${event.code} - ${event.reason || 'No reason'}`,
              details: { code: event.code, reason: event.reason, wasClean: event.wasClean }
            });
          }
        };
      });

      updateTest(2, {
        status: wsTest.success ? 'success' : 'error',
        message: wsTest.message,
        details: wsTest.details
      });

    } catch (error) {
      console.error('WebSocket test failed:', error);
      updateTest(2, {
        status: 'error',
        message: `WebSocket test failed: ${error}`,
        details: error
      });
    }

    // Test 4: CoinGecko API
    try {
      console.log('Testing CoinGecko API...');
      const cgUrl = `${API_CONFIG.COINGECKO.BASE_URL}/simple/price?ids=bitcoin&vs_currencies=usd`;
      const headers: Record<string, string> = {};
      
      if (coinGeckoKey) {
        headers['x-cg-demo-api-key'] = coinGeckoKey;
      }
      
      const response = await fetch(cgUrl, { headers });
      const data = await response.json();
      
      console.log('CoinGecko Response:', { status: response.status, data });
      
      if (response.ok && data.bitcoin?.usd) {
        updateTest(3, {
          status: 'success',
          message: `CoinGecko working - BTC: $${data.bitcoin.usd}`,
          details: data
        });
      } else {
        updateTest(3, {
          status: 'error',
          message: `CoinGecko error: ${JSON.stringify(data)}`,
          details: { status: response.status, data }
        });
      }
    } catch (error) {
      console.error('CoinGecko Error:', error);
      updateTest(3, {
        status: 'error',
        message: `CoinGecko failed: ${error}`,
        details: error
      });
    }

    console.log('🏁 Connection tests completed');
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🔍 Connection Diagnostics</h3>
        <button
          onClick={runTests}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          Retest
        </button>
      </div>

      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-800 rounded-lg">
            <span className="text-lg mt-0.5">{getStatusIcon(test.status)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-white">{test.name}</span>
                <span className={`text-sm ${getStatusColor(test.status)}`}>
                  {test.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-300 mt-1">{test.message}</div>
              {test.details && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                    Show details
                  </summary>
                  <pre className="text-xs text-gray-400 mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(test.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-900 border-l-4 border-blue-500 rounded">
        <p className="text-sm text-blue-200">
          <strong>Debug Tip:</strong> Open your browser's Developer Console (F12) to see detailed logs during testing.
        </p>
      </div>
    </div>
  );
};