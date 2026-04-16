// ============================================================
// CONFIG — All configurable parameters
// @version 3.2.0
// @updated 2026-03-18
// ============================================================

const CONFIG = {
    // --- Default Watchlist ---
    DEFAULT_TICKERS: ["TSLA", "HOOD", "SOFI", "AMZN", "SKM", "GOOGL"],
    BENCHMARK: "SPY",

    // --- Finnhub API ---
    FINNHUB_URL: "https://finnhub.io/api/v1",

    // --- Twelve Data API ---
    TWELVE_DATA_URL: "https://api.twelvedata.com",

    // --- Data Fetch ---
    OHLCV_DAYS: 504,          // ~2 years of trading days

    // --- Technical Parameters ---
    RSI_PERIOD: 14,
    ATR_PERIOD: 14,
    EMA_SHORT: 50,
    EMA_LONG: 200,
    BB_PERIOD: 20,
    BB_STD: 2,
    ADX_PERIOD: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,

    // --- AVWAP Windows (trading days) ---
    AVWAP_WINDOWS: { "5d": 5, "14d": 14, "30d": 30, "6m": 126 },

    // --- POC (Point of Control) ---
    POC_WINDOWS: { "5d": 5, "14d": 14 },
    POC_BINS: 20,

    // --- Structure & Sweep ---
    STRUCTURE_WINDOW: 14,

    // --- Fibonacci ---
    FIB_WINDOW: 126,
    FIB_LEVELS: [0.236, 0.382, 0.500, 0.618, 0.786],

    // --- Relative Strength ---
    RS_WINDOW: 30,

    // --- Chart ---
    CHART_DAYS: 90,

    // --- LocalStorage Keys ---
    LS_FINNHUB_KEY: "finnhub_api_key",
    LS_TWELVE_DATA_KEY: "twelve_data_api_key",
    LS_TICKERS: "watchlist_tickers",
    LS_CACHE: "dashboard_cache",
    CACHE_TTL_HOURS: 24,
};

// --- API Key helpers ---
function getFinnhubKey() {
    return localStorage.getItem(CONFIG.LS_FINNHUB_KEY) || "";
}
function setFinnhubKey(key) {
    localStorage.setItem(CONFIG.LS_FINNHUB_KEY, key.trim());
}
function getTwelveDataKey() {
    return localStorage.getItem(CONFIG.LS_TWELVE_DATA_KEY) || "";
}
function setTwelveDataKey(key) {
    localStorage.setItem(CONFIG.LS_TWELVE_DATA_KEY, key.trim());
}

// --- Watchlist helpers ---
function getTickers() {
    const stored = localStorage.getItem(CONFIG.LS_TICKERS);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) { /* ignore */ }
    }
    return CONFIG.DEFAULT_TICKERS;
}

function setTickers(arr) {
    localStorage.setItem(CONFIG.LS_TICKERS, JSON.stringify(arr.map(t => t.toUpperCase().trim()).filter(Boolean)));
}

// --- Cache helpers ---
function getCache() {
    try {
        const raw = localStorage.getItem(CONFIG.LS_CACHE);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function setCache(payload) {
    try {
        localStorage.setItem(CONFIG.LS_CACHE, JSON.stringify({
            timestamp: new Date().toISOString(),
            ...payload,
        }));
    } catch (e) {
        console.warn("Cache write failed (storage quota?):", e.message);
    }
}

function clearCache() {
    localStorage.removeItem(CONFIG.LS_CACHE);
}
