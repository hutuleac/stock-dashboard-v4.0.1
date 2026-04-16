# 🏗️ Architecture — Stock Market Dashboard

> **Version 3.1.0** | Last updated: 2026-03-16

This document describes how the Stock Market Dashboard works internally — the data flow, module responsibilities, calculation logic, and design decisions.

---

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER                                │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────────┐  │
│  │ index.html│───>│  app.js  │───>│  UI Rendering Layer   │  │
│  │  (entry)  │    │(orchestr)│    │  ui.js + charts.js    │  │
│  └──────────┘    └────┬─────┘    └───────────────────────┘  │
│                       │                                      │
│              ┌────────▼────────┐                             │
│              │     api.js      │                             │
│              │ (FMP Stable API)│                             │
│              └────────┬────────┘                             │
│                       │ HTTPS                                │
│              ┌────────▼────────┐                             │
│              │  Processing     │                             │
│              │  technicals.js  │                             │
│              │  structure.js   │                             │
│              │  scoring.js     │                             │
│              └─────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ fetch() over HTTPS
                        ▼
          ┌──────────────────────────┐
          │  FMP Stable API          │
          │  financialmodelingprep   │
          │  .com/stable/            │
          └──────────────────────────┘
```

---

## 🔄 Data Flow

### 1. Initialization (`app.js` → `DOMContentLoaded`)

```
Page Load
  │
  ├─ API key exists in localStorage?
  │   ├─ NO  → Show setup overlay (enter API key + tickers)
  │   └─ YES → Call App.loadDashboard()
```

### 2. Dashboard Loading (`App.loadDashboard()`)

```
loadDashboard()
  │
  ├─ 1. Validate API key (test call to /stable/profile?symbol=AAPL)
  │     ├─ FAIL → Show error with "Change API Key" button
  │     └─ OK   → Continue
  │
  ├─ 2. Fetch SPY benchmark OHLCV (/stable/historical-price-eod)
  │     └─ Used for Relative Strength calculation
  │
  ├─ 3. Fetch all tickers in PARALLEL (Promise.allSettled)
  │     │
  │     └─ For each ticker, fetchTickerData() calls 7 endpoints:
  │         ├─ /stable/historical-price-eod  (OHLCV — REQUIRED)
  │         ├─ /stable/profile               (fundamentals)
  │         ├─ /stable/key-metrics-ttm       (forward P/E)
  │         ├─ /stable/earnings-calendar     (earnings date)
  │         ├─ /stable/income-statement      (EPS growth)
  │         ├─ /stable/shares-float          (short float)
  │         └─ /stable/grades-consensus      (analyst rating)
  │
  ├─ 4. Process each ticker (App.processTicker())
  │     ├─ Calculate 20+ technical indicators
  │     ├─ Calculate composite score (0-100)
  │     ├─ Detect trading setup (LONG/SHORT/WAIT)
  │     └─ Prepare chart data (last 90 days)
  │
  └─ 5. Render dashboard (UI.renderDashboard())
        ├─ Primary table (price, score, setup, RSI, trend)
        ├─ Detail table (ATR, EMA, AVWAP, POC, ADX, etc.)
        ├─ Ticker summary cards
        └─ Legend
```

### 3. Error Handling Strategy

```
API Call Failure
  │
  ├─ OHLCV fails → Ticker is SKIPPED entirely (critical data)
  ├─ Profile fails → Use empty defaults (partial data)
  ├─ Key metrics fails → Forward P/E = null (optional)
  ├─ Earnings fails → Earnings date = null (optional)
  ├─ Income statement fails → EPS growth = null (optional)
  ├─ Shares float fails → Short float = null (optional)
  └─ Analyst rating fails → Rating = null (optional)

ALL tickers fail → Show detailed error with specific API errors
SOME tickers fail → Show dashboard with successful tickers only
```

---

## 📦 Module Responsibilities

### `config.js` — Configuration & Storage
- All configurable parameters (periods, windows, thresholds)
- localStorage helpers (`getApiKey()`, `setApiKey()`, `getTickers()`, `setTickers()`)
- FMP Stable API base URL

### `api.js` — Data Fetching
- `fmpStableGet(endpoint, params)` — Generic HTTP GET with timeout & error checking
- `fetchWithTimeout(url, ms)` — AbortController-based timeout (15s)
- `checkFmpError(data)` — Detects error messages in HTTP 200 responses
- `validateApiKey()` — Tests API key with a simple profile request
- `fetchOHLCV(ticker)` — Historical daily price data (from/to dates)
- `fetchProfile(ticker)` — Company fundamentals
- `fetchKeyMetrics(ticker)` — Forward P/E from TTM metrics
- `fetchEarningsDate(ticker)` — Next earnings date with fallback endpoint names
- `fetchEpsGrowth(ticker)` — YoY EPS growth from income statements
- `fetchShortFloat(ticker)` — Free float percentage
- `fetchAnalystRating(ticker)` — Analyst consensus (Buy/Hold/Sell)
- `fetchTickerData(ticker)` — Orchestrates all 7 sub-fetches with `Promise.allSettled`
- `fetchBenchmark()` — SPY OHLCV for relative strength

### `technicals.js` — Technical Indicators (Pure Math)
All functions are stateless — input arrays, output values:

| Function | Input | Output |
|---|---|---|
| `calcRSI(closes)` | Close prices | Latest RSI value (0-100) |
| `calcRSISeries(closes)` | Close prices | RSI array (for charts) |
| `calcATR(highs, lows, closes)` | OHLC arrays | `{atr, atr_pct}` |
| `calcEMASeries(values, period)` | Price array + period | EMA array |
| `calcEMA(values, period)` | Price array + period | Latest EMA value |
| `calcTrend(closes, ema50, ema200)` | Prices + EMAs | "Bullish" / "Bearish" / "Neutral" |
| `calcAVWAP(closes, volumes, window)` | Arrays + window | AVWAP price level |
| `calcPOC(closes, volumes, window)` | Arrays + window | Point of Control price |
| `calcADX(highs, lows, closes)` | OHLC arrays | ADX value (0-100) |
| `calcBBBandwidth(closes)` | Close prices | Bandwidth % |
| `calcFibonacci(highs, lows, closes)` | OHLC arrays | `{levels, price_position, swing_high/low}` |
| `calcRSvsSPY(stockCloses, spyCloses)` | Two close arrays | Ratio (>1 = outperforming) |
| `calcVolumeRatio(volumes)` | Volume array | Current / 20-day avg |
| `calc52WPosition(price, high, low)` | 3 values | Position % (0-100) |
| `calcPctBelowATH(price, high)` | 2 values | Distance % from ATH |

### `structure.js` — Market Structure Analysis
| Function | Description |
|---|---|
| `calcStructure(highs, lows)` | HH/HL = Bullish, LH/LL = Bearish, else Neutral |
| `calcSweep(highs, lows, closes)` | Detects buy-side / sell-side liquidity sweeps |
| `calcFVG(highs, lows, closes)` | Finds nearest Fair Value Gap with fill % |

### `scoring.js` — Composite Score & Setup Detection
| Function | Description |
|---|---|
| `calcCompositeScore(data)` | Calculates 0-100 score from 9 criteria + penalties |
| `calcScoreBreakdown(data)` | Detailed breakdown for tooltip display |
| `getConfluenceSetup(data)` | LONG/SHORT/WAIT with criteria list and sizing % |

**Score Criteria (max 100):**
```
Technical (max 50 pts):
  +10  RSI in 30-45 entry zone
  +10  Structure = Bullish
  +10  Price > EMA200
  +10  Price > AVWAP 30d
  +10  Fibonacci value zone (236-618)

Fundamental (max 30 pts):
  +10  Earnings > 21 days away
  +10  EPS growth > 0%
  +10  Forward P/E < Trailing P/E

Sentiment (max 10 pts):
  +10  Relative Strength > SPY

Penalties:
  -20  Earnings < 7 days
  -15  ATR% > 5% (extreme volatility)
  -15  Bearish structure + below EMA200
```

**Setup Detection Logic:**
```
WAIT triggers (any = auto-block):
  - Earnings < 10 days
  - ATR% > 5%
  - Neutral structure + ADX < 20
  - Price between EMA50 and EMA200
  - BB squeeze (bandwidth < 1.5%)
  - RSI overbought + Fib extended
  - Fundamental deterioration

LONG criteria (need 4+ of 6):
  1. Price > EMA200
  2. RSI in 35-55
  3. Structure = Bullish
  4. Price > AVWAP 30d
  5. Fib value zone
  6. ADX favorable

SHORT criteria (need 4+ of 6):
  1. Price < EMA200
  2. RSI in 45-65
  3. Structure = Bearish
  4. Price < AVWAP 30d
  5. Fib rejection zone
  6. ADX trending (>20)
```

### `charts.js` — Interactive Charts
- Uses [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) library
- Renders candlestick chart with overlays (EMA50, EMA200, AVWAP, POC, Fibonacci)
- Volume + RSI sub-chart with synchronized time scale
- Crosshair OHLCV legend (real-time hover data)
- Markers for sweeps and FVGs
- Screenshot export (PNG download)
- Toggle open/close per ticker (click row to expand)

### `ui.js` — DOM Rendering
- `renderDashboard()` — Main render: tables, summaries, legends
- `buildSummaries()` — Per-ticker analysis cards with action recommendations
- `showLoading()` / `showError()` — State management with error recovery buttons
- `showSettings()` / `saveSettings()` — API key and watchlist management
- `showSetupScreen()` / `saveInitialSetup()` — First-time setup overlay
- Color helpers for conditional formatting (RSI, trend, delta, earnings, etc.)
- Tooltip builders for score and setup breakdowns

### `app.js` — Main Orchestrator
- `loadDashboard()` — Full pipeline: validate → fetch → process → render
- `processTicker()` — Transforms raw API data into computed indicators + chart data
- DOM ready listener — auto-starts dashboard or shows setup screen

---

## 🔌 API Endpoints Used

All endpoints use the FMP Stable API base URL: `https://financialmodelingprep.com/stable/`

| Endpoint | Method | Key Parameters | Response Format |
|---|---|---|---|
| `profile` | GET | `symbol` | Array of profile objects |
| `historical-price-eod` | GET | `symbol`, `from`, `to` | Array of OHLCV objects |
| `key-metrics-ttm` | GET | `symbol` | Array of metrics objects |
| `earnings-calendar` | GET | `symbol` | Array of earnings events |
| `income-statement` | GET | `symbol`, `period`, `limit` | Array of statement objects |
| `shares-float` | GET | `symbol` | Array of float data |
| `grades-consensus` | GET | `symbol` | Array of consensus objects |

All requests include `apikey` as a query parameter.

---

## 🗄️ Local Storage

| Key | Type | Purpose |
|---|---|---|
| `fmp_api_key` | string | FMP API key (never sent anywhere except FMP) |
| `watchlist_tickers` | JSON array | User's ticker watchlist (e.g., `["TSLA","AMZN"]`) |

---

## 🛡️ Error Handling

1. **Network errors** — Caught by `fetchWithTimeout()`, displayed as specific messages
2. **HTTP errors** — Status codes 401/403 (invalid key), 429 (rate limit), others
3. **API errors at HTTP 200** — FMP sometimes returns `{"Error Message": "..."}` at status 200; detected by `checkFmpError()`
4. **Timeout** — 15-second AbortController timeout per request
5. **Partial failures** — Non-critical endpoints fail gracefully (return null/defaults)
6. **Total failure** — Detailed error screen with per-ticker error list + recovery buttons

---

## 📊 Chart Data Pipeline

```
Raw OHLCV (504 days)
  │
  ├─ Calculate EMA50 series (full length)
  ├─ Calculate EMA200 series (full length)
  ├─ Calculate RSI series (full length)
  ├─ Calculate AVWAP 30d (single value → horizontal line)
  ├─ Calculate POC 14d (single value → horizontal line)
  │
  └─ Slice last 90 days for chart display
      │
      ├─ Candlestick series (OHLCV)
      ├─ EMA50 line (blue)
      ├─ EMA200 line (orange)
      ├─ AVWAP 30d line (purple, dashed)
      ├─ POC 14d line (gray, dotted)
      ├─ Fibonacci levels (colored dashed lines)
      ├─ Volume histogram (green/red)
      ├─ RSI line (purple)
      ├─ RSI reference lines (30, 70)
      └─ Markers (sweep arrows, FVG circles)
```

---

## 🎨 Design Decisions

1. **No build step** — Plain HTML/CSS/JS for maximum portability and zero setup
2. **No backend** — All processing happens client-side; API key stays in browser
3. **CDN dependencies only** — Tailwind CSS and Lightweight Charts loaded from CDN
4. **Stable API only** — Uses FMP's `/stable/` endpoints for future compatibility
5. **Graceful degradation** — Dashboard loads with whatever data is available
6. **localStorage persistence** — API key and watchlist survive page reloads
7. **Promise.allSettled** — Parallel fetching; one ticker's failure doesn't block others