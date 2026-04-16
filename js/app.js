// ============================================================
// APP — Main orchestrator
// @version 3.2.3
// @updated 2026-03-18
// ============================================================

const App = {

    async loadDashboard() {
        const finnhubKey = getFinnhubKey();
        const twelveKey = getTwelveDataKey();
        if (!finnhubKey || !twelveKey) { UI.showSetupScreen(); return; }
        const cache = getCache();
        if (cache && cache.marketData && cache.chartData) {
            const ageHours = (Date.now() - new Date(cache.timestamp).getTime()) / 3600000;
            UI.renderDashboard(cache.marketData, cache.chartData, cache.timestamp, null, true, ageHours, null);
            return;
        }
        await App.refreshData();
    },

    async refreshData() {
        const tickers = getTickers();
        UI.showLoading("Connecting to data sources...");
        try {
            UI.updateLoadingProgress("Validating API keys...");
            const validation = await API.validateApiKey();
            if (!validation.valid) {
                const cache = getCache();
                if (cache && cache.marketData) {
                    const ageHours = (Date.now() - new Date(cache.timestamp).getTime()) / 3600000;
                    UI.renderDashboard(cache.marketData, cache.chartData, cache.timestamp, null, true, ageHours, null);
                    UI.showCacheBanner("API validation failed — showing cached data.");
                    return;
                }
                UI.showError(`API key validation failed:\n${validation.error}`, true);
                return;
            }
            UI.updateLoadingProgress("Fetching OHLCV data (Twelve Data)...");
            let ohlcvBatch = {};
            try {
                ohlcvBatch = await API.fetchAllOHLCV(tickers, (msg) => UI.updateLoadingProgress(msg));
            } catch (e) {
                const cache = getCache();
                if (cache && cache.marketData) {
                    const ageHours = (Date.now() - new Date(cache.timestamp).getTime()) / 3600000;
                    UI.renderDashboard(cache.marketData, cache.chartData, cache.timestamp, null, true, ageHours, null);
                    UI.showCacheBanner(`Twelve Data unavailable (${e.message}) — showing cached data.`);
                    return;
                }
                UI.showError(`Twelve Data error: ${e.message}`, true);
                return;
            }
            const fgData = null;
            const spyCloses = (ohlcvBatch[CONFIG.BENCHMARK] || []).map(d => d.close);
            const BATCH_SIZE = 6;
            const allResults = [];
            for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
                const chunk = tickers.slice(i, i + BATCH_SIZE);
                UI.updateLoadingProgress(`Fetching Finnhub data for tickers ${i + 1}–${Math.min(i + BATCH_SIZE, tickers.length)} of ${tickers.length}...`);
                const chunkResults = await Promise.allSettled(chunk.map(ticker => API.fetchTickerData(ticker, ohlcvBatch)));
                chunkResults.forEach((r, j) => allResults.push({ result: r, ticker: chunk[j] }));
                if (i + BATCH_SIZE < tickers.length) await new Promise(res => setTimeout(res, 1500));
            }
            UI.updateLoadingProgress("Calculating indicators...");
            const marketData = {}, chartData = {}, tickerErrors = [];
            for (const { result, ticker } of allResults) {
                if (result.status !== "fulfilled") { tickerErrors.push(`${ticker}: ${result.reason?.message || "Unknown error"}`); continue; }
                try {
                    const processed = this.processTicker(ticker, result.value, spyCloses);
                    marketData[ticker] = processed.data;
                    chartData[ticker] = processed.chart;
                } catch (e) { tickerErrors.push(`${ticker}: ${e.message}`); }
            }
            if (Object.keys(marketData).length === 0) {
                let errorMsg = "No data could be loaded for any ticker.";
                if (tickerErrors.length > 0) errorMsg += "\n\nErrors:\n• " + [...new Set(tickerErrors)].slice(0, 5).join("\n• ");
                UI.showError(errorMsg, true);
                return;
            }
            setCache({ marketData, chartData, fgData });
            UI.renderDashboard(marketData, chartData, new Date().toLocaleString(), null, false, 0, fgData);
        } catch (e) { UI.showError(e.message || "Unknown error occurred", true); }
    },

    processTicker(ticker, raw, spyCloses) {
        const ohlcv = raw.ohlcv, profile = raw.profile;
        const dates = ohlcv.map(d => d.date), opens = ohlcv.map(d => d.open), highs = ohlcv.map(d => d.high), lows = ohlcv.map(d => d.low), closes = ohlcv.map(d => d.close), volumes = ohlcv.map(d => d.volume);
        const price = profile.current_price || closes[closes.length - 1];
        let delta1d;
        if (profile.quote_dp != null) delta1d = Math.round(profile.quote_dp * 100) / 100;
        else { const prevClose = profile.prev_close || (closes.length > 1 ? closes[closes.length - 2] : price); delta1d = prevClose ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0; }
        const rsi = Technicals.calcRSI(closes);
        const atrData = Technicals.calcATR(highs, lows, closes);
        const ema50Series = Technicals.calcEMASeries(closes, CONFIG.EMA_SHORT);
        const ema200Series = Technicals.calcEMASeries(closes, CONFIG.EMA_LONG);
        const ema50 = ema50Series[ema50Series.length - 1] != null ? Math.round(ema50Series[ema50Series.length - 1] * 100) / 100 : null;
        const ema200 = ema200Series[ema200Series.length - 1] != null ? Math.round(ema200Series[ema200Series.length - 1] * 100) / 100 : null;
        const trend = Technicals.calcTrend(closes, ema50Series, ema200Series);
        const avwaps = {}; for (const [name, days] of Object.entries(CONFIG.AVWAP_WINDOWS)) avwaps[`avwap_${name}`] = Technicals.calcAVWAP(closes, volumes, days);
        const pocs = {}; for (const [name, days] of Object.entries(CONFIG.POC_WINDOWS)) pocs[`poc_${name}`] = Technicals.calcPOC(closes, volumes, days);
        const adx = Technicals.calcADX(highs, lows, closes);
        const bbBW = Technicals.calcBBBandwidth(closes);
        const fib = Technicals.calcFibonacci(highs, lows, closes);
        const structure = Structure.calcStructure(highs, lows);
        const sweep = Structure.calcSweep(highs, lows, closes);
        const fvg = Structure.calcFVG(highs, lows, closes);
        const rsSpy = Technicals.calcRSvsSPY(closes, spyCloses);
        const volRatio = Technicals.calcVolumeRatio(volumes);
        const macd = Technicals.calcMACD(closes);
        const obv = Technicals.calcOBV(closes, volumes);
        const pivots = Technicals.calcPivots(highs, lows, closes);
        const high52w = profile.high_52w, low52w = profile.low_52w;
        const pos52w = Technicals.calc52WPosition(price, high52w, low52w);
        const pctBelow = Technicals.calcPctBelowATH(price, high52w);
        const data = {
            price: Math.round(price * 100) / 100, delta_1d_pct: delta1d, rsi_daily: rsi,
            atr: atrData.atr, atr_pct: atrData.atr_pct, ema50, ema200, trend, ...avwaps, ...pocs,
            adx, bb_bandwidth: bbBW, structure, sweep,
            fvg_type: fvg ? fvg.type : null, fvg_fill_pct: fvg ? fvg.fill_pct : null,
            fvg_distance_pct: fvg ? fvg.distance_pct : null, fvg_level: fvg ? fvg.level : null,
            fib_position: fib.price_position, fib_swing_high: fib.swing_high, fib_swing_low: fib.swing_low, fib_levels: fib.levels,
            vol_avg_ratio: volRatio, high_52w, low_52w, position_52w_pct: pos52w, pct_below_ath: pctBelow, rs_spy_30d: rsSpy,
            macd_val: macd.macd, macd_signal: macd.signal, macd_hist: macd.hist, macd_crossover: macd.crossover,
            obv_trend: obv.obv_trend, pivot_r1: pivots.r1, pivot_s1: pivots.s1,
            pe_trailing: profile.pe_trailing, pe_forward: profile.pe_forward, dividend_yield: profile.dividend_yield,
            market_cap: profile.market_cap, beta: profile.beta,
            earnings_date: raw.earnings.earnings_date, days_to_earnings: raw.earnings.days_to_earnings,
            eps_growth_yoy: raw.eps_growth_yoy, short_ratio: raw.short_ratio,
            analyst_rating: raw.analyst_rating, price_target_upside: raw.price_target_upside, latest_analyst_action: raw.latest_analyst_action,
        };
        data.composite_score = Scoring.calcCompositeScore(data);
        data.score_breakdown = Scoring.calcScoreBreakdown(data);
        const setup = Scoring.getConfluenceSetup(data);
        data.setup_type = setup.setup_type; data.setup_criteria_met = setup.criteria_met;
        data.setup_total_criteria = setup.total_criteria; data.setup_sizing_pct = setup.sizing_pct;
        data.setup_reasons = setup.reasons; data.setup_long_met = setup.long_met || [];
        data.setup_long_miss = setup.long_miss || []; data.setup_short_met = setup.short_met || [];
        data.setup_short_miss = setup.short_miss || [];
        const chartDays = CONFIG.CHART_DAYS;
        const startIdx = Math.max(0, dates.length - chartDays);
        const rsiSeries = Technicals.calcRSISeries(closes);
        const chart = {
            dates: dates.slice(startIdx),
            open: opens.slice(startIdx).map(v => Math.round(v * 100) / 100),
            high: highs.slice(startIdx).map(v => Math.round(v * 100) / 100),
            low: lows.slice(startIdx).map(v => Math.round(v * 100) / 100),
            close: closes.slice(startIdx).map(v => Math.round(v * 100) / 100),
            volume: volumes.slice(startIdx),
            ema50: ema50Series.slice(startIdx).map(v => v != null ? Math.round(v * 100) / 100 : null),
            ema200: ema200Series.slice(startIdx).map(v => v != null ? Math.round(v * 100) / 100 : null),
            rsi: rsiSeries.slice(startIdx), avwap_30d: avwaps.avwap_30d, poc_14d: pocs.poc_14d,
        };
        return { data, chart };
    },
};

document.addEventListener("DOMContentLoaded", () => {
    if (getFinnhubKey() && getTwelveDataKey()) App.loadDashboard();
    else UI.showSetupScreen();
});
