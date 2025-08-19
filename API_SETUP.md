# 📊 Trading Dashboard - API Setup Guide

## 🚀 Quick Start (2 Required APIs)

For **complete trading functionality** across stocks, forex, and crypto, you only need **2 free API keys**:

### 1. 🏢 **FINNHUB** (Stocks + Forex + Crypto)
- **Sign up**: [https://finnhub.io/register](https://finnhub.io/register)
- **Free tier**: 60 API calls/minute
- **Coverage**: 
  - ✅ US Stocks (AAPL, GOOGL, TSLA, etc.)
  - ✅ Forex pairs (EUR/USD, GBP/USD, etc.) 
  - ✅ Major cryptocurrencies (BTC, ETH, etc.)
  - ✅ Real-time WebSocket data
  - ✅ Historical charts
  - ✅ Company fundamentals

### 2. 🪙 **COINGECKO** (Enhanced Crypto)
- **Sign up**: [https://www.coingecko.com/en/api/pricing](https://www.coingecko.com/en/api/pricing)
- **Free tier**: 30 calls/minute, 10,000/month
- **Coverage**:
  - ✅ 13,000+ cryptocurrencies
  - ✅ Market cap rankings
  - ✅ Price history
  - ✅ DeFi and NFT data

---

## 🔑 API Key Setup

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`**:
   ```bash
   REACT_APP_FINNHUB_API_KEY=your_finnhub_key_here
   REACT_APP_COINGECKO_API_KEY=your_coingecko_key_here
   ```

3. **Restart the development server**:
   ```bash
   npm start
   ```

---

## 🎯 What Each API Provides

| API | Stocks | Forex | Crypto | Real-time | Historical | Free Tier |
|-----|--------|-------|---------|-----------|------------|-----------|
| **Finnhub** | ✅ US Markets | ✅ Major pairs | ✅ Top coins | ✅ WebSocket | ✅ Yes | 60/min |
| **CoinGecko** | ❌ | ❌ | ✅ 13K+ coins | ✅ | ✅ Yes | 30/min |
| Tradermade | ❌ | ✅ 170+ pairs | ✅ 4K+ pairs | ✅ | ✅ Yes | 1K/month |
| Alpha Vantage | ✅ Global | ✅ Major pairs | ✅ Top coins | ❌ | ✅ Yes | 25/day |
| Twelve Data | ✅ US+Global | ✅ Major pairs | ✅ Top coins | ✅ WebSocket | ✅ Yes | 8/min |

---

## 🌟 Optional Enhanced APIs

### 3. 💱 **TRADERMADE** (Premium Forex)
- **When to use**: If you need more forex pairs or lower latency
- **Sign up**: [https://tradermade.com/pricing](https://tradermade.com/pricing)
- **Benefits**: 170+ currency pairs, sub-50ms latency, enterprise reliability

### 4. 📈 **ALPHA VANTAGE** (Technical Analysis)
- **When to use**: If you want built-in technical indicators
- **Sign up**: [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
- **Benefits**: 50+ technical indicators (RSI, MACD, Bollinger Bands, etc.)

### 5. ⚡ **TWELVE DATA** (High-Performance)
- **When to use**: For high-frequency trading or global markets
- **Sign up**: [https://twelvedata.com/pricing](https://twelvedata.com/pricing)
- **Benefits**: Real-time WebSocket, 120 symbols per API call, global coverage

---

## 🛠️ API Integration Status

| Feature | Primary API | Backup API | Status |
|---------|-------------|------------|---------|
| **Real-time Stock Prices** | Finnhub | Alpha Vantage | ✅ Ready |
| **Stock Charts** | Finnhub | Twelve Data | ✅ Ready |
| **Forex Real-time** | Finnhub | Tradermade | ✅ Ready |
| **Crypto Real-time** | Finnhub + CoinGecko | - | ✅ Ready |
| **WebSocket Streaming** | Finnhub | Twelve Data | ✅ Ready |
| **Historical Data** | Finnhub | Alpha Vantage | ✅ Ready |

---

## 🚨 Important Notes

### Rate Limits (Free Tiers)
- **Finnhub**: 60 calls/minute (excellent for real-time)
- **CoinGecko**: 30 calls/minute (good for crypto)
- **Be mindful**: Implement caching to maximize free usage

### API Key Security
- ✅ Keys are stored in `.env` (not committed to git)
- ✅ All keys use `REACT_APP_` prefix for client-side access
- ❌ **Never commit API keys to version control**

### Demo Mode
- If no API keys provided, dashboard runs in demo mode
- Perfect for testing UI without API setup
- Set `REACT_APP_ENV=development` for enhanced demo data

---

## 🎮 Trading Features by API Combination

### Minimum Setup (Finnhub Only)
- ✅ Stock trading simulation
- ✅ Basic forex pairs
- ✅ Major cryptocurrencies
- ✅ Real-time price updates
- ✅ Interactive charts

### Recommended Setup (Finnhub + CoinGecko)
- ✅ Everything above +
- ✅ 13,000+ cryptocurrencies
- ✅ Market cap data
- ✅ Comprehensive crypto analytics

### Power User Setup (All APIs)
- ✅ Maximum coverage across all asset classes
- ✅ Redundancy (backup data sources)
- ✅ Technical indicators
- ✅ Global markets
- ✅ Institutional-grade data

---

## 🆘 Troubleshooting

### "Connection Failed" Error
1. Check API keys in `.env` file
2. Verify keys are active (test in browser: `https://finnhub.io/api/v1/quote?symbol=AAPL&token=YOUR_KEY`)
3. Check rate limits haven't been exceeded

### "No Data Available"
1. Ensure internet connection
2. Try different symbols (some may not be supported)
3. Check API status pages

### Development vs Production
- Development: Uses demo data when APIs unavailable
- Production: Requires valid API keys for all features

---

**Ready to trade? Get your free API keys and start testing strategies! 🚀**