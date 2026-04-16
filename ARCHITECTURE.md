# 🏗️ Architecture — Stock Market Dashboard

> **Version 3.1.0** | Last updated: 2026-03-16

See README.md for quick start. This document covers internal architecture, data flow, and design decisions.

---

## 📐 High-Level Architecture

```
┌───────────────────────────────────────────────────┐
│                    BROWSER                           │
│  index.html → app.js → UI Rendering (ui.js + charts.js)│
│                 ↓                                    │
│              api.js (Finnhub + Twelve Data)          │
│                 ↓                                    │
│  Processing: technicals.js / structure.js / scoring.js│
└───────────────────────────────────────────────────┘
```

## 🔄 Data Flow

1. Check localStorage for API keys → show setup overlay if missing
2. Validate Finnhub key with test call
3. Fetch all OHLCV via Twelve Data (chunked, 8 symbols/min max)
4. Fetch Finnhub data per ticker (parallel, 6 at a time)
5. Calculate 20+ indicators per ticker
6. Score, detect setup (LONG/SHORT/WAIT), build chart data
7. Render tables, cards, charts

## 📦 Module Responsibilities

| File | Role |
|---|---|
| `config.js` | All parameters, localStorage helpers |
| `api.js` | Finnhub + Twelve Data fetching, rate limiting, error handling |
| `technicals.js` | Pure math: RSI, ATR, EMA, AVWAP, POC, ADX, BB, Fib, RS, MACD, OBV, Pivots |
| `structure.js` | Market structure (HH/HL), sweeps, Fair Value Gaps |
| `scoring.js` | Composite score (0–100) + LONG/SHORT/WAIT detection |
| `charts.js` | Candlestick + RSI/Volume charts via Lightweight Charts |
| `ui.js` | DOM rendering, tooltips, color helpers, settings |
| `app.js` | Main orchestrator: validate → fetch → process → render |

## 📊 Scoring System

```
Technical (max 50):  RSI zone, Structure, EMA200, AVWAP30d, Fib position
Fundamental (max 30): Earnings safety, EPS growth, Fwd P/E vs Trail P/E
Sentiment (max 10):  Relative strength vs SPY
Penalties:           Earnings <7d (-20), ATR >5% (-15), Bearish+below EMA200 (-15)
```

## 🛑 Setup Detection (LONG/SHORT/WAIT)

```
WAIT auto-triggers: earnings <10d, ATR >5%, neutral+ADX<20,
                    price between EMAs, BB squeeze, RSI overbought+Fib extended

LONG (need 4+ of 6): Price > EMA200, RSI 35-55, Structure Bullish,
                     Price > AVWAP30d, Fib value zone, ADX favorable

SHORT (need 4+ of 6): Price < EMA200, RSI 45-65, Structure Bearish,
                      Price < AVWAP30d, Fib rejection zone, ADX trending

4 met = 60% position size | 5+ met = 100% position size
```

## 🗄️ Local Storage Keys

| Key | Purpose |
|---|---|
| `finnhub_api_key` | Finnhub API key |
| `twelve_data_api_key` | Twelve Data API key |
| `watchlist_tickers` | JSON array of tickers |
| `dashboard_cache` | 24h data cache |
