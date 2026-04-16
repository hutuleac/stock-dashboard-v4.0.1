// ============================================================
// SCORING — Composite score & confluence setup detection
// @version 3.2.1
// @updated 2026-03-18
// ============================================================

const Scoring = {
    /**
     * Calculate composite score (0-100).
     */
    calcCompositeScore(d) {
        let score = 0;

        // Technical (max 50)
        const rsi = d.rsi_daily;
        if (rsi != null && rsi > 30 && rsi < 45) score += 10;

        if (d.structure === "Bullish") score += 10;

        if (d.price && d.ema200 && d.price > d.ema200) score += 10;

        if (d.price && d.avwap_30d && d.price > d.avwap_30d) score += 10;

        const fib = d.fib_position;
        if (fib === "BETWEEN_382_618" || fib === "BETWEEN_236_382") score += 10;

        // Fundamental (max 30)
        if (d.days_to_earnings != null && d.days_to_earnings > 21) score += 10;

        if (d.eps_growth_yoy != null && d.eps_growth_yoy > 0) score += 10;

        if (d.pe_forward != null && d.pe_trailing != null && d.pe_forward < d.pe_trailing) score += 10;

        // Sentiment (max 20) — PCR omitted, only RS
        if (d.rs_spy_30d != null && d.rs_spy_30d > 1.0) score += 10;

        // Penalties
        if (d.days_to_earnings != null && d.days_to_earnings < 7) score -= 20;

        if (d.atr_pct != null && d.atr_pct > 5) score -= 15;

        if (d.structure === "Bearish" && d.price && d.ema200 && d.price < d.ema200) score -= 15;

        return Math.max(0, Math.min(100, score));
    },

    /**
     * Return detailed breakdown of score for tooltips.
     */
    calcScoreBreakdown(d) {
        const items = [];
        const rsi = d.rsi_daily;
        items.push({
            name: "RSI entry zone (30-45)",
            met: rsi != null && rsi > 30 && rsi < 45,
            value: rsi != null ? String(rsi) : "N/A",
            pts: 10,
        });

        items.push({
            name: "Structure Bullish",
            met: d.structure === "Bullish",
            value: d.structure || "N/A",
            pts: 10,
        });

        const price = d.price;
        const ema200 = d.ema200;
        items.push({
            name: "Price > EMA200",
            met: !!(price && ema200 && price > ema200),
            value: price && ema200 ? `${price} vs ${ema200}` : "N/A",
            pts: 10,
        });

        const avwap30 = d.avwap_30d;
        items.push({
            name: "Price > AVWAP30d",
            met: !!(price && avwap30 && price > avwap30),
            value: price && avwap30 ? `${price} vs ${avwap30}` : "N/A",
            pts: 10,
        });

        items.push({
            name: "Fib value zone",
            met: d.fib_position === "BETWEEN_382_618" || d.fib_position === "BETWEEN_236_382",
            value: d.fib_position || "N/A",
            pts: 10,
        });

        items.push({
            name: "Earnings > 21d",
            met: d.days_to_earnings != null && d.days_to_earnings > 21,
            value: d.days_to_earnings != null ? `${d.days_to_earnings}d` : "N/A",
            pts: 10,
        });

        items.push({
            name: "EPS growth > 0",
            met: d.eps_growth_yoy != null && d.eps_growth_yoy > 0,
            value: d.eps_growth_yoy != null ? `${d.eps_growth_yoy}%` : "N/A",
            pts: 10,
        });

        items.push({
            name: "Fwd P/E < Trail P/E",
            met: d.pe_forward != null && d.pe_trailing != null && d.pe_forward < d.pe_trailing,
            value: d.pe_forward && d.pe_trailing ? `${d.pe_forward} vs ${d.pe_trailing}` : "N/A",
            pts: 10,
        });

        items.push({
            name: "RS > SPY",
            met: d.rs_spy_30d != null && d.rs_spy_30d > 1.0,
            value: d.rs_spy_30d != null ? String(d.rs_spy_30d) : "N/A",
            pts: 10,
        });

        // Penalties
        const penalties = [];
        if (d.days_to_earnings != null && d.days_to_earnings < 7) {
            penalties.push({ name: "Earnings < 7d", pts: -20 });
        }
        if (d.atr_pct != null && d.atr_pct > 5) {
            penalties.push({ name: `ATR% extreme (${d.atr_pct}%)`, pts: -15 });
        }
        if (d.structure === "Bearish" && d.price && d.ema200 && d.price < d.ema200) {
            penalties.push({ name: "Bearish + below EMA200", pts: -15 });
        }

        return { criteria: items, penalties };
    },

    /**
     * Determine trading setup based on confluence.
     * Returns full met/miss breakdown for all directions.
     */
    getConfluenceSetup(d) {
        const price = d.price;
        const rsi = d.rsi_daily;
        const structure = d.structure;
        const adx = d.adx;
        const ema200 = d.ema200;
        const avwap30 = d.avwap_30d;
        const fibPos = d.fib_position;
        const daysEarn = d.days_to_earnings;
        const atrPct = d.atr_pct;
        const ema50 = d.ema50;
        const bbBW = d.bb_bandwidth;

        // Formatting helpers (local, no UI dependency)
        const fp = v => (v != null ? Number(v).toFixed(2) : "?");
        const fr = v => (v != null ? Number(v).toFixed(1) : "?");
        const fibShort = v => v
            ? v.replace("BETWEEN_", "").replace("ABOVE_", ">").replace("BELOW_", "<").replace("_", "-")
            : "N/A";

        // ── Always build full LONG criteria (met + miss) ─────────────────
        const longMet = [], longMiss = [];

        if (price && ema200 && price > ema200) {
            longMet.push("Price > EMA200");
        } else {
            longMiss.push(`Price > EMA200 ($${fp(price)} vs $${fp(ema200)})`);
        }

        if (rsi != null && rsi >= 35 && rsi <= 55) {
            longMet.push(`RSI ${fr(rsi)} in 35-55`);
        } else {
            longMiss.push(`RSI 35-55 zone (now ${fr(rsi)})`);
        }

        if (structure === "Bullish") {
            longMet.push("Structure Bullish");
        } else {
            longMiss.push(`Structure Bullish (now ${structure || "N/A"})`);
        }

        if (price && avwap30 && price > avwap30) {
            longMet.push(`Price > AVWAP30d ($${fp(avwap30)})`);
        } else {
            longMiss.push(`Price > AVWAP30d ($${fp(price)} vs $${fp(avwap30)})`);
        }

        if (fibPos === "BETWEEN_382_618" || fibPos === "BETWEEN_236_382") {
            longMet.push(`Fib value zone (${fibShort(fibPos)})`);
        } else {
            longMiss.push(`Fib value zone (now ${fibShort(fibPos)})`);
        }

        if (adx != null && (adx < 25 || (adx > 30 && structure === "Bullish"))) {
            longMet.push(`ADX ${fr(adx)} favorable`);
        } else {
            longMiss.push(`ADX favorable (now ${fr(adx)})`);
        }

        // ── Always build full SHORT criteria (met + miss) ─────────────────
        const shortMet = [], shortMiss = [];

        if (price && ema200 && price < ema200) {
            shortMet.push("Price < EMA200");
        } else {
            shortMiss.push(`Price < EMA200 ($${fp(price)} vs $${fp(ema200)})`);
        }

        if (rsi != null && rsi >= 45 && rsi <= 65) {
            shortMet.push(`RSI ${fr(rsi)} in 45-65`);
        } else {
            shortMiss.push(`RSI 45-65 zone (now ${fr(rsi)})`);
        }

        if (structure === "Bearish") {
            shortMet.push("Structure Bearish");
        } else {
            shortMiss.push(`Structure Bearish (now ${structure || "N/A"})`);
        }

        if (price && avwap30 && price < avwap30) {
            shortMet.push(`Price < AVWAP30d ($${fp(avwap30)})`);
        } else {
            shortMiss.push(`Price < AVWAP30d ($${fp(price)} vs $${fp(avwap30)})`);
        }

        if (fibPos === "BETWEEN_618_786" || fibPos === "ABOVE_786") {
            shortMet.push(`Fib rejection zone (${fibShort(fibPos)})`);
        } else {
            shortMiss.push(`Fib rejection zone (now ${fibShort(fibPos)})`);
        }

        if (adx != null && adx > 20) {
            shortMet.push(`ADX ${fr(adx)} > 20 trending`);
        } else {
            shortMiss.push(`ADX > 20 trending (now ${fr(adx)})`);
        }

        const longCount = longMet.length;
        const shortCount = shortMet.length;

        // ── Hard WAIT checks (market condition blockers) ──────────────────
        const waitReasons = [];
        if (daysEarn != null && daysEarn < 10) {
            waitReasons.push(`Earnings in ${daysEarn}d — avoid trading until after`);
        }
        if (atrPct != null && atrPct > 5) {
            waitReasons.push(`Extreme volatility — ATR ${Number(atrPct).toFixed(2)}% exceeds 5% threshold`);
        }
        if (structure === "Neutral" && adx != null && adx < 20) {
            waitReasons.push(`No directional trend — Neutral structure + ADX ${fr(adx)} < 20`);
        }
        if (price && ema50 && ema200 && Math.min(ema50, ema200) < price && price < Math.max(ema50, ema200)) {
            waitReasons.push(`Price trapped between EMA50 ($${fp(ema50)}) and EMA200 ($${fp(ema200)})`);
        }
        if (bbBW != null && bbBW < 1.5) {
            waitReasons.push(`Bollinger Band squeeze — BW ${Number(bbBW).toFixed(2)}% (threshold: 1.5%)`);
        }
        if (rsi != null && rsi > 75 && fibPos === "ABOVE_786") {
            waitReasons.push("RSI overbought + price extended above Fib 78.6%");
        }
        const epsG = d.eps_growth_yoy;
        const peFwd = d.pe_forward;
        const peTrail = d.pe_trailing;
        if (epsG != null && epsG < 0 && peFwd != null && peTrail != null && peFwd > peTrail) {
            waitReasons.push(`Fundamental deterioration — EPS ${Number(epsG).toFixed(1)}% + Fwd P/E (${fp(peFwd)}) > Trail P/E (${fp(peTrail)})`);
        }

        if (waitReasons.length > 0) {
            return {
                setup_type: "WAIT",
                criteria_met: 0,
                total_criteria: 0,
                sizing_pct: 0,
                reasons: waitReasons,
                long_met: longMet,
                long_miss: longMiss,
                short_met: shortMet,
                short_miss: shortMiss,
            };
        }

        // ── LONG signal ───────────────────────────────────────────────────
        if (longCount >= 4 && longCount >= shortCount) {
            return {
                setup_type: "LONG",
                criteria_met: longCount,
                total_criteria: 6,
                sizing_pct: longCount >= 5 ? 100 : 60,
                reasons: longMet,
                long_met: longMet,
                long_miss: longMiss,
                short_met: shortMet,
                short_miss: shortMiss,
            };
        }

        // ── SHORT signal ──────────────────────────────────────────────────
        if (shortCount >= 4) {
            return {
                setup_type: "SHORT",
                criteria_met: shortCount,
                total_criteria: 6,
                sizing_pct: shortCount >= 5 ? 100 : 60,
                reasons: shortMet,
                long_met: longMet,
                long_miss: longMiss,
                short_met: shortMet,
                short_miss: shortMiss,
            };
        }

        // ── WAIT — insufficient confluence ────────────────────────────────
        const closer = longCount > shortCount ? "LONG" : longCount < shortCount ? "SHORT" : "neither";
        return {
            setup_type: "WAIT",
            criteria_met: Math.max(longCount, shortCount),
            total_criteria: 6,
            sizing_pct: 0,
            reasons: [`Insufficient confluence — LONG ${longCount}/6, SHORT ${shortCount}/6`],
            long_met: longMet,
            long_miss: longMiss,
            short_met: shortMet,
            short_miss: shortMiss,
        };
    },
};