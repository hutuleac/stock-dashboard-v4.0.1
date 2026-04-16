// ============================================================
// API — Finnhub + Twelve Data fetching (browser-side)
// @version 3.2.3
// @updated 2026-03-18
// ============================================================

const API = {

    async fetchWithTimeout(url, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return resp;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url.split("?")[0]}`);
            throw e;
        }
    },

    async finnhubGet(path, params = {}) {
        const key = getFinnhubKey();
        if (!key) throw new Error("No Finnhub API key configured");
        params.token = key;
        const qs = new URLSearchParams(params).toString();
        const url = `${CONFIG.FINNHUB_URL}${path}?${qs}`;
        const resp = await this.fetchWithTimeout(url);
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) throw new Error("Invalid Finnhub key (HTTP " + resp.status + ")");
            if (resp.status === 429) throw new Error("Finnhub rate limit exceeded (HTTP 429)");
            throw new Error(`Finnhub error: HTTP ${resp.status} for ${path}`);
        }
        return resp.json();
    },

    async twelveDataGet(path, params = {}) {
        const key = getTwelveDataKey();
        if (!key) throw new Error("No Twelve Data API key configured");
        params.apikey = key;
        const qs = new URLSearchParams(params).toString().replace(/%2C/gi, ",");
        const url = `${CONFIG.TWELVE_DATA_URL}${path}?${qs}`;
        const resp = await this.fetchWithTimeout(url, 30000);
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) throw new Error("Invalid Twelve Data key (HTTP " + resp.status + ")");
            if (resp.status === 429) throw new Error("Twelve Data rate limit exceeded (HTTP 429)");
            throw new Error(`Twelve Data error: HTTP ${resp.status} for ${path}`);
        }
        return resp.json();
    },

    async validateApiKey() {
        try {
            const data = await this.finnhubGet("/quote", { symbol: "AAPL" });
            if (!data || data.c === undefined) return { valid: false, error: "Finnhub: Unexpected response" };
            return { valid: true };
        } catch (e) {
            return { valid: false, error: "Finnhub: " + e.message };
        }
    },

    parseTwelveDataOHLCV(entry, sym) {
        if (!entry) { console.warn(`TD: no entry for ${sym}`); return []; }
        if (entry.status === "error") { console.warn(`TD: symbol ${sym} error — ${entry.message || "unknown"}`); return []; }
        if (!Array.isArray(entry.values)) { console.warn(`TD: symbol ${sym} — unexpected shape`); return []; }
        return entry.values.slice().reverse().map(d => ({
            date: d.datetime, open: parseFloat(d.open), high: parseFloat(d.high),
            low: parseFloat(d.low), close: parseFloat(d.close), volume: parseFloat(d.volume),
        })).filter(d => !isNaN(d.close));
    },

    _parseTwelveDataResponse(data, symbols) {
        if (!data) throw new Error("Twelve Data returned empty response");
        if (data.status === "error") throw new Error(`Twelve Data: ${data.message || "API error"}`);
        if (data.code && data.message) throw new Error(`Twelve Data (${data.code}): ${data.message}`);
        const result = {};
        if (symbols.length === 1 && data.values && Array.isArray(data.values)) {
            result[symbols[0]] = this.parseTwelveDataOHLCV(data, symbols[0]);
        } else {
            for (const sym of symbols) result[sym] = this.parseTwelveDataOHLCV(data[sym], sym);
        }
        return result;
    },

    async fetchAllOHLCV(tickers, onProgress) {
        const CREDITS_PER_MIN = 8;
        const coreSymbols = [...new Set([...tickers, CONFIG.BENCHMARK])];
        const result = {};
        for (let i = 0; i < coreSymbols.length; i += CREDITS_PER_MIN) {
            const chunk = coreSymbols.slice(i, i + CREDITS_PER_MIN);
            if (i > 0) {
                const waitSec = 65;
                if (onProgress) {
                    for (let s = waitSec; s > 0; s--) {
                        onProgress(`Rate limit cooldown: ${s}s — fetching ${coreSymbols.length - i} more symbols...`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } else {
                    await new Promise(r => setTimeout(r, waitSec * 1000));
                }
            }
            if (onProgress) onProgress(`Fetching OHLCV batch ${Math.floor(i / CREDITS_PER_MIN) + 1}: ${chunk.join(", ")}...`);
            const data = await this.twelveDataGet("/time_series", { symbol: chunk.join(","), interval: "1day", outputsize: String(CONFIG.OHLCV_DAYS) });
            const chunkResult = this._parseTwelveDataResponse(data, chunk);
            Object.assign(result, chunkResult);
        }
        return result;
    },

    async fetchBenchmark(ohlcvBatch) {
        return (ohlcvBatch && ohlcvBatch[CONFIG.BENCHMARK]) || [];
    },

    async fetchVIX() {
        try {
            const resp = await this.fetchWithTimeout("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d", 10000);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
            if (Array.isArray(closes) && closes.length > 0) {
                const lastClose = [...closes].reverse().find(v => v != null);
                if (lastClose != null) return lastClose;
            }
        } catch (e) { console.info("[VIX] Yahoo Finance unavailable:", e.message); }
        return null;
    },

    async fetchFearGreed() {
        try {
            const resp = await this.fetchWithTimeout("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", 8000);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const fg = data?.fear_and_greed;
            if (!fg || fg.score == null) return null;
            const parseInd = obj => { if (!obj) return null; const score = obj.score ?? obj.value; if (score == null) return null; return { score: Math.round(Number(score)), rating: obj.rating ?? obj.description ?? "", data: obj.data ?? "" }; };
            const gi = data.greed_indicators || {};
            return { score: Math.round(fg.score), rating: fg.rating || "", prev_close: fg.previous_close != null ? Math.round(fg.previous_close) : null, prev_week: fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null, prev_month: fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null, prev_year: fg.previous_1_year != null ? Math.round(fg.previous_1_year) : null, indicators: { momentum: parseInd(gi.market_momentum_sp500), strength: parseInd(gi.stock_price_strength), breadth: parseInd(gi.stock_price_breadth), pcr: parseInd(gi.put_call_options), vix_fg: parseInd(gi.market_volatility_vix), haven: parseInd(gi.safe_haven_demand), junk: parseInd(gi.junk_bond_demand) } };
        } catch (e) { console.info("[F&G] CNN Fear & Greed unavailable:", e.message); }
        return null;
    },

    async fetchEarningsDate(ticker) {
        try {
            const today = new Date();
            const from = today.toISOString().slice(0, 10);
            const future = new Date(today); future.setFullYear(future.getFullYear() + 1);
            const to = future.toISOString().slice(0, 10);
            const data = await this.finnhubGet("/calendar/earnings", { symbol: ticker, from, to });
            const cal = data && Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
            if (cal.length === 0) return { earnings_date: null, days_to_earnings: null };
            const todayDate = new Date(from);
            let nearest = null, minDays = Infinity;
            for (const item of cal) {
                if (item.symbol && item.symbol !== ticker) continue;
                const d = new Date(item.date);
                if (d >= todayDate) { const days = Math.round((d - todayDate) / 86400000); if (days < minDays) { minDays = days; nearest = item.date; } }
            }
            return { earnings_date: nearest, days_to_earnings: nearest ? minDays : null };
        } catch (e) { console.warn(`Earnings fetch failed for ${ticker}:`, e.message); return { earnings_date: null, days_to_earnings: null }; }
    },

    mapConsensus(rec) {
        if (!rec) return null;
        const bull = (rec.strongBuy || 0) + (rec.buy || 0);
        const bear = (rec.strongSell || 0) + (rec.sell || 0);
        const neutral = rec.hold || 0;
        const total = bull + bear + neutral;
        if (total === 0) return null;
        if (bull / total > 0.5) return "Buy";
        if (bear / total > 0.5) return "Sell";
        return "Hold";
    },

    async fetchFinnhubTicker(ticker) {
        const [quoteR, profileR, metricsR, earningsR, recommendationR] = await Promise.allSettled([
            this.finnhubGet("/quote", { symbol: ticker }),
            this.finnhubGet("/stock/profile2", { symbol: ticker }),
            this.finnhubGet("/stock/metric", { symbol: ticker, metric: "all" }),
            this.fetchEarningsDate(ticker),
            this.finnhubGet("/stock/recommendation", { symbol: ticker }),
        ]);
        const q = quoteR.status === "fulfilled" ? quoteR.value : {};
        const p = profileR.status === "fulfilled" ? profileR.value : {};
        const m = (metricsR.status === "fulfilled" && metricsR.value && metricsR.value.metric) ? metricsR.value.metric : {};
        const earn = earningsR.status === "fulfilled" ? earningsR.value : { earnings_date: null, days_to_earnings: null };
        const recArr = recommendationR.status === "fulfilled" && Array.isArray(recommendationR.value) ? recommendationR.value : [];
        const rec = recArr.length > 0 ? recArr[0] : null;
        const price = q.c || null;
        let priceTargetUpside = null, latestAction = null;
        const [ptR, actionR] = await Promise.allSettled([
            price ? this.finnhubGet("/stock/price-target", { symbol: ticker }) : Promise.resolve(null),
            this.finnhubGet("/stock/upgrade-downgrade", { symbol: ticker }),
        ]);
        if (ptR.status === "fulfilled" && ptR.value && ptR.value.targetMean && price) priceTargetUpside = Math.round(((ptR.value.targetMean - price) / price) * 10000) / 100;
        if (actionR.status === "fulfilled" && Array.isArray(actionR.value) && actionR.value.length > 0) { const a = actionR.value[0]; latestAction = [a.company, a.action || "", a.toGrade].filter(Boolean).join(" ").slice(0, 30) || null; }
        return {
            profile: { pe_trailing: m.peBasicExclExtraTTM || null, pe_forward: m.peNormalizedAnnual || null, dividend_yield: 0, market_cap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null, beta: m.beta || null, high_52w: m["52WeekHigh"] || null, low_52w: m["52WeekLow"] || null, prev_close: q.pc || null, current_price: price, quote_dp: q.dp || null, company_name: p.name || ticker, sector: p.finnhubIndustry || null },
            earnings: earn,
            eps_growth_yoy: m.epsGrowthTTMYoy != null ? Math.round(m.epsGrowthTTMYoy * 100) / 100 : null,
            short_ratio: m.shortRatio != null ? m.shortRatio : null,
            analyst_rating: this.mapConsensus(rec),
            price_target_upside: priceTargetUpside,
            latest_analyst_action: latestAction,
        };
    },

    async fetchTickerData(ticker, ohlcvBatch) {
        const ohlcv = (ohlcvBatch && ohlcvBatch[ticker]) || [];
        if (ohlcv.length === 0) {
            const anyData = ohlcvBatch && Object.values(ohlcvBatch).some(v => v && v.length > 0);
            if (!anyData) throw new Error(`Twelve Data returned no OHLCV data for any symbol`);
            throw new Error(`No OHLCV data for ${ticker}`);
        }
        const finnhub = await this.fetchFinnhubTicker(ticker);
        return { ohlcv, profile: finnhub.profile, earnings: finnhub.earnings, eps_growth_yoy: finnhub.eps_growth_yoy, short_ratio: finnhub.short_ratio, analyst_rating: finnhub.analyst_rating, price_target_upside: finnhub.price_target_upside, latest_analyst_action: finnhub.latest_analyst_action };
    },
};
