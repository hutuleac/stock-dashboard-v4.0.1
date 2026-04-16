# 📊 Stock Market Dashboard

> **v3.2.5** | Client-side stock analysis. 100% browser. Zero backend.

Real-time technical & fundamental analysis dashboard. Built for traders who want instant insights without the noise.

![HTML](https://img.shields.io/badge/HTML_CSS_JS-blue?style=flat)
![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white&style=flat)
![FMP API](https://img.shields.io/badge/API-FMP_Stable-green?style=flat)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

---

## 🎯 Dashboard Overview

Live data from Financial Modeling Prep Stable API. All calculations happen in your browser — no backend, no server costs.

**Main Dashboard View:**
![Stock Market Dashboard](./images/dashboard-main.png)

**Detailed Ticker Analysis:**
![Detailed Ticker Actions](./images/ticker-details.png)

---

## ⚡ Quick Start

### Deploy to Cloudflare Pages (2 min)
1. Fork this repo
2. Connect to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Set build output to `/` — done, no build step needed
4. Add your API keys → live

### Run Locally
```bash
# Python
python -m http.server 8080

# Or Node.js
npx serve .
```
Open `http://localhost:8080` → enter API keys → analyze

### GitHub Pages
Fork → Settings → Pages → Source: main/root folder → live

---

## 📖 How to Use

### 1️⃣ Add Your API Keys
- Click **Settings** (top right)
- Enter your **Finnhub** key (free tier: 60 req/min) and **Twelve Data** key (free: 8 req/min)
- Keys stored in browser localStorage only — never sent to any server except the APIs directly

### 2️⃣ Watch Your Tickers
- Default: TSLA, HOOD, SOFI, AMZN, SKM, GOOGL
- Edit watchlist in Settings (max 12 tickers)
- Click **Refresh** for live data

### 3️⃣ Read the Signals
Each ticker shows:
- **Score (0–100)**: Composite signal strength
- **Setup**: LONG / SHORT / WAIT with entry signals
- **RSI, Trend, Structure**: Quick momentum reads
- **Earnings**: Days until earnings (avoid trading through)
- **Rating**: Buy/Hold/Sell based on analyst consensus

### 4️⃣ Expand Charts
- Click ticker row → full candlestick chart
- See EMA 50/200, AVWAP, Fibonacci levels
- Hover for full technical breakdown
- Export as PNG

---

## ✨ What It Calculates

**In-Browser (Real-Time):**
- RSI, ATR, EMA 50/200, AVWAP (multiple anchors)
- Point of Control (POC), ADX, Bollinger Bandwidth
- Fibonacci retracements, Market structure, Sweeps, FVGs
- MACD, OBV, Pivot Points (R1/S1)
- Relative strength vs SPY

**From APIs:**
- Finnhub: live quotes, fundamentals, earnings dates, analyst ratings
- Twelve Data: 2 years OHLCV history

**Scoring System:**
- **Technical** (50 pts): Structure, RSI, EMAs, AVWAP, Fib levels
- **Fundamental** (30 pts): Earnings safety, EPS growth, P/E
- **Sentiment** (10 pts): Strength vs SPY
- **Penalties**: Earnings risk (−20), Extreme volatility (−15)

---

## 🔑 Setup

### Get Your API Keys

**Finnhub** (quotes, fundamentals, analyst data):
1. Sign up: [finnhub.io](https://finnhub.io/)
2. Free tier: 60 req/min — no credit card needed

**Twelve Data** (OHLCV history):
1. Sign up: [twelvedata.com](https://twelvedata.com/)
2. Free tier: 8 req/min, 800 credits/day

### Change Default Tickers
Edit `js/config.js`:
```javascript
DEFAULT_TICKERS: ['AAPL', 'MSFT', 'NVDA'],  // your tickers
```

---

## 🏗️ Architecture

```
├── index.html           Main dashboard (single page)
├── js/
│   ├── config.js       Parameters + localStorage helpers
│   ├── api.js          Finnhub + Twelve Data fetching
│   ├── technicals.js   20+ indicators (RSI, ATR, EMA, MACD...)
│   ├── structure.js    Market structure, sweeps, FVG
│   ├── scoring.js      Composite score + LONG/SHORT/WAIT signals
│   ├── charts.js       Lightweight Charts rendering
│   └── ui.js           DOM + tooltips + summaries
└── .github/workflows/deploy.yml  Auto-deploy to GitHub Pages
```

**Zero dependencies.** Tailwind & Lightweight Charts loaded from CDN.

---

## 🚀 Deploy

| Platform | Setup | Output Dir |
|---|---|---|
| **Cloudflare Pages** | Fork + connect | `/` |
| **GitHub Pages** | Settings → Pages | main / root |
| **Any static host** | Upload files | N/A |

---

## ⚠️ Disclaimer

**Educational & research purposes only.** Not financial advice. Trading carries risk. Consult a qualified advisor before investing.

---

## 📄 License

MIT License. Use, modify, share freely.
