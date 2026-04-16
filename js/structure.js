// ============================================================
// STRUCTURE — Market structure, sweeps, FVG detection (pure JS)
// @version 3.1.0
// @updated 2026-03-16
// ============================================================

const Structure = {
    calcStructure(highs, lows, window) {
        window = window || CONFIG.STRUCTURE_WINDOW;
        const len = highs.length;
        if (len < window) return "Neutral";
        const startIdx = len - window, h = highs.slice(startIdx), l = lows.slice(startIdx), n = h.length;
        const idx = [n - 1, Math.max(n - 4, 0), Math.max(n - 7, 0)];
        if (idx[2] === idx[1]) return "Neutral";
        const hs = [h[idx[0]], h[idx[1]], h[idx[2]]], ls = [l[idx[0]], l[idx[1]], l[idx[2]]];
        const hh = hs[0] > hs[1] && hs[1] > hs[2], hl = ls[0] > ls[1] && ls[1] > ls[2];
        const lh = hs[0] < hs[1] && hs[1] < hs[2], ll = ls[0] < ls[1] && ls[1] < ls[2];
        if (hh && hl) return "Bullish";
        if (lh && ll) return "Bearish";
        return "Neutral";
    },
    calcSweep(highs, lows, closes) {
        const len = highs.length;
        if (len < 6) return "Neutral";
        let prevHigh = -Infinity, prevLow = Infinity;
        for (let i = len - 6; i < len - 1; i++) { if (highs[i] > prevHigh) prevHigh = highs[i]; if (lows[i] < prevLow) prevLow = lows[i]; }
        const currHigh = highs[len-1], currLow = lows[len-1], currClose = closes[len-1];
        if (currHigh > prevHigh && currClose < prevHigh) return "BUY_SWP";
        if (currLow < prevLow && currClose > prevLow) return "SELL_SWP";
        return "Neutral";
    },
    calcFVG(highs, lows, closes) {
        const len = highs.length;
        if (len < 10) return null;
        const price = closes[len-1];
        let nearest = null, minDist = Infinity;
        const lookback = Math.min(20, len - 2);
        for (let i = len - lookback; i < len - 1; i++) {
            if (i < 2) continue;
            const c1High = highs[i-2], c3Low = lows[i], c1Low = lows[i-2], c3High = highs[i];
            let fvg = null;
            if (c1High < c3Low) {
                const gapSize = c3Low - c1High; if (gapSize <= 0) continue;
                let fillPct = price <= c1High ? 0 : price >= c3Low ? 100 : ((price - c1High) / gapSize) * 100;
                const mid = (c3Low + c1High) / 2, dist = Math.abs(price - mid) / price * 100;
                fvg = { type: "BULL", fill_pct: Math.round(fillPct * 10) / 10, distance_pct: Math.round(dist * 100) / 100, level: Math.round(mid * 10000) / 10000 };
            } else if (c1Low > c3High) {
                const gapSize = c1Low - c3High; if (gapSize <= 0) continue;
                let fillPct = price >= c1Low ? 0 : price <= c3High ? 100 : ((c1Low - price) / gapSize) * 100;
                const mid = (c1Low + c3High) / 2, dist = Math.abs(price - mid) / price * 100;
                fvg = { type: "BEAR", fill_pct: Math.round(fillPct * 10) / 10, distance_pct: Math.round(dist * 100) / 100, level: Math.round(mid * 10000) / 10000 };
            }
            if (fvg && fvg.distance_pct < minDist) { minDist = fvg.distance_pct; nearest = fvg; }
        }
        return nearest;
    },
};
