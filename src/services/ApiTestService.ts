import { API_CONFIG } from '../utils/constants';

// Service to test API connections and diagnose issues
export class ApiTestService {
  
  // Test Finnhub REST API connection
  static async testFinnhubConnection(): Promise<{ success: boolean; error?: string; data?: any }> {
    const apiKey = API_CONFIG.FINNHUB.API_KEY;
    
    if (!apiKey) {
      return { 
        success: false, 
        error: 'Finnhub API key not found in environment variables' 
      };
    }

    try {
      console.log('Testing Finnhub REST API connection...');
      const testUrl = `${API_CONFIG.FINNHUB.BASE_URL}/quote?symbol=AAPL&token=${apiKey}`;
      
      const response = await fetch(testUrl);
      const data = await response.json();
      
      if (response.ok && data.c) {
        console.log('✅ Finnhub REST API working - AAPL price:', data.c);
        return { success: true, data };
      } else {
        console.error('❌ Finnhub REST API error:', data);
        return { 
          success: false, 
          error: `API returned: ${JSON.stringify(data)}` 
        };
      }
    } catch (error) {
      console.error('❌ Finnhub REST API connection failed:', error);
      return { 
        success: false, 
        error: `Network error: ${error}` 
      };
    }
  }

  // Test WebSocket connection
  static testFinnhubWebSocket(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const apiKey = API_CONFIG.FINNHUB.API_KEY;
      
      if (!apiKey) {
        resolve({ 
          success: false, 
          error: 'Finnhub API key not found' 
        });
        return;
      }

      console.log('Testing Finnhub WebSocket connection...');
      
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws?.close();
          resolve({ 
            success: false, 
            error: 'WebSocket connection timeout (10s)' 
          });
        }
      }, 10000);

      let ws: WebSocket;
      
      try {
        ws = new WebSocket(`${API_CONFIG.FINNHUB.WS_URL}?token=${apiKey}`);
        
        ws.onopen = () => {
          console.log('✅ Finnhub WebSocket connected');
          
          // Test subscription
          ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL' }));
          console.log('📡 Sent test subscription for AAPL');
        };

        ws.onmessage = (event) => {
          console.log('✅ Received WebSocket message:', event.data);
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({ success: true });
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({ 
              success: false, 
              error: `WebSocket error: ${error}` 
            });
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({ 
              success: false, 
              error: `WebSocket closed: ${event.code} - ${event.reason}` 
            });
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        clearTimeout(timeout);
        resolve({ 
          success: false, 
          error: `Failed to create WebSocket: ${error}` 
        });
      }
    });
  }

  // Test CoinGecko API
  static async testCoinGeckoConnection(): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      console.log('Testing CoinGecko API connection...');
      const testUrl = `${API_CONFIG.COINGECKO.BASE_URL}/simple/price?ids=bitcoin&vs_currencies=usd`;
      
      const headers: Record<string, string> = {};
      if (API_CONFIG.COINGECKO.API_KEY) {
        headers['x-cg-demo-api-key'] = API_CONFIG.COINGECKO.API_KEY;
      }
      
      const response = await fetch(testUrl, { headers });
      const data = await response.json();
      
      if (response.ok && data.bitcoin?.usd) {
        console.log('✅ CoinGecko API working - BTC price:', data.bitcoin.usd);
        return { success: true, data };
      } else {
        console.error('❌ CoinGecko API error:', data);
        return { 
          success: false, 
          error: `API returned: ${JSON.stringify(data)}` 
        };
      }
    } catch (error) {
      console.error('❌ CoinGecko API connection failed:', error);
      return { 
        success: false, 
        error: `Network error: ${error}` 
      };
    }
  }

  // Run all connection tests
  static async runDiagnostics(): Promise<void> {
    console.log('\n🔧 Running API Connection Diagnostics...\n');
    
    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log('- Finnhub API Key:', API_CONFIG.FINNHUB.API_KEY ? `${API_CONFIG.FINNHUB.API_KEY.slice(0, 8)}...` : 'NOT SET');
    console.log('- CoinGecko API Key:', API_CONFIG.COINGECKO.API_KEY ? `${API_CONFIG.COINGECKO.API_KEY.slice(0, 8)}...` : 'NOT SET');
    
    // Test REST APIs
    console.log('\n🌐 Testing REST API Connections:');
    const finnhubRest = await this.testFinnhubConnection();
    const coinGecko = await this.testCoinGeckoConnection();
    
    // DISABLED: Finnhub WebSocket test - using Binance WebSocket for real-time data
    // console.log('\n🔌 Testing WebSocket Connection:');
    // const finnhubWs = await this.testFinnhubWebSocket();
    const finnhubWs = { success: false, error: 'Finnhub WebSocket disabled - using Binance instead' };
    
    // Summary
    console.log('\n📊 Connection Test Results:');
    console.log(`- Finnhub REST: ${finnhubRest.success ? '✅ Working' : '❌ Failed - ' + finnhubRest.error}`);
    console.log(`- Finnhub WebSocket: ${finnhubWs.success ? '✅ Working' : '❌ Failed - ' + finnhubWs.error}`);
    console.log(`- CoinGecko REST: ${coinGecko.success ? '✅ Working' : '❌ Failed - ' + coinGecko.error}`);
    
    if (!finnhubRest.success || !finnhubWs.success) {
      console.log('\n🚨 Troubleshooting Tips:');
      console.log('1. Verify your Finnhub API key at: https://finnhub.io/dashboard');
      console.log('2. Check if you have exceeded rate limits (60 calls/minute)');
      console.log('3. Ensure your API key has WebSocket access enabled');
      console.log('4. Try refreshing the page or restarting the development server');
    }
  }
}