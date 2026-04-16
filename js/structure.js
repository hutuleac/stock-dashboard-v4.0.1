// ============================================================
// STRUCTURE — Market structure, sweeps, FVG detection (pure JS)
// @version 3.1.0
// @updated 2026-03-16
// ============================================================

const Structure = {
    /**
     * Determine market structure: Bullish (HH/HL), Bearish (LH/LL), Neutral.
     */
    calcStructure(highs, lows, window) {
        window = window || CONFIG.STRUCTURE_WINDOW;
        const len = highs.length;
        if (len < window) return "Neutral";

        const startIdx = len - window;
        const h = highs.slice(startIdx);
        const l = lows.slice(startIdx);
        const n = h.length;

        const idx = [n - 1, Math.max(n - 4, 0), Math.max(n - 7, 0)];
        if (idx[2] === idx[1]) return "Neutral";

        const hs = [h[idx[0]], h[idx[1]], h[idx[2]]];
        const ls = [l[idx[0]], l[idx[1]], l[idx[2]]];

        const hh = hs[0] > hs[1] && hs[1] > hs[2];
        const hl = ls[0] > ls[1] && ls[1] > ls[2];
        const lh = hs[0] < hs[1] && hs[1] < hs[2];
        const ll = ls[0] < ls[1] && ls[1] < ls[2];

        if (hh && hl) return "Bullish";
        if (lh && ll) return "Bearish";
        return "Neutral";
    },

    /**
     * Detect sweep on most recent candle.
     * BUY_SWP: wick above prior high but close below (bull trap)
     * SELL_SWP: wick below prior low but close above (bear trap / accumulation)
     */
    calcSweep(highs, lows, closes) {
        const len = highs.length;
        if (len < 6) return "Neutral";

        // Prior highs/lows (lookback 5 candles, excluding current)
        let prevHigh = -Infinity, prevLow = Infinity;
        for (let i = len - 6; i < len - 1; i++) {
            if (highs[i] > prevHigh) prevHigh = highs[i];
            if (lows[i] < prevLow) prevLow = lows[i];
        }

        const currHigh = highs[len - 1];
        const currLow = lows[len - 1];
        const currClose = closes[len - 1];

        if (currHigh > prevHigh && currClose < prevHigh) return "BUY_SWP";
        if (currLow < prevLow && currClose > prevLow) return "SELL_SWP";
        return "Neutral";
    },

    /**
     * Find nearest Fair Value Gap.
     * BULL FVG: candle[i-2].high < candle[i].low (gap up)
     * BEAR FVG: candle[i-2].low > candle[i].high (gap down)
     */
    calcFVG(highs, lows, closes) {
        const len = highs.length;
        if (len < 10) return null;

        const price = closes[len - 1];
        let nearest = null;
        let minDist = Infinity;

        const lookback = Math.min(20, len - 2);
        for (let i = len - lookback; i < len - 1; i++) {
            if (i < 2) continue;
            const c1High = highs[i - 2];
            const c3Low = lows[i];
            const c1Low = lows[i - 2];
            const c3High = highs[i];

            let fvg = null;

            if (c1High < c3Low) {
                // Bull FVG (gap up)
                const gapTop = c3Low;
                const gapBottom = c1High;
                const gapSize = gapTop - gapBottom;
                if (gapSize <= 0) continue;
                let fillPct;
                if (price <= gapBottom) fillPct = 0;
                else if (price >= gapTop) fillPct = 100;
                else fillPct = ((price - gapBottom) / gapSize) * 100;
                const mid = (gapTop + gapBottom) / 2;
                const dist = Math.abs(price - mid) / price * 100;
                fvg = {
                    type: "BULL",
                    fill_pct: Math.round(fillPct * 10) / 10,
                    distance_pct: Math.round(dist * 100) / 100,
                    level: Math.round(mid * 10000) / 10000,
                };
            } else if (c1Low > c3High) {
                // Bear FVG (gap down)
                const gapTop = c1Low;
                const gapBottom = c3High;
                const gapSize = gapTop - gapBottom;
                if (gapSize <= 0) continue;
                let fillPct;
                if (price >= gapTop) fillPct = 0;
                else if (price <= gapBottom) fillPct = 100;
                else fillPct = ((gapTop - price) / gapSize) * 100;
                const mid = (gapTop + gapBottom) / 2;
                const dist = Math.abs(price - mid) / price * 100;
                fvg = {
                    type: "BEAR",
                    fill_pct: Math.round(fillPct * 10) / 10,
                    distance_pct: Math.round(dist * 100) / 100,
                    level: Math.round(mid * 10000) / 10000,
                };
            }

            if (fvg && fvg.distance_pct < minDist) {
                minDist = fvg.distance_pct;
                nearest = fvg;
            }
        }

        return nearest;
    },
};