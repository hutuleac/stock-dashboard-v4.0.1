// ============================================================
// UI — DOM rendering (tables, tooltips, summaries, settings)
// @version 3.2.8
// @updated 2026-03-18
// ============================================================

const UI = {
    // Store references for chart toggling
    _marketData: {},
    _chartData: {},

    // --- Formatting helpers ---
    fmt(v, dec = 2) {
        if (v === null || v === undefined || v === "N/A") return "-";
        const n = Number(v);
        return isNaN(n) ? v : n.toFixed(dec);
    },

    fmtPct(v) { return v != null ? this.fmt(v, 2) + "%" : "-"; },

    fmtVol(v) {
        if (!v) return "-";
        if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
        if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
        if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
        return v.toString();
    },

    // --- Color helpers ---
    rsiColor(v) {
        if (v == null) return "";
        if (v < 30) return "text-accent-green";
        if (v > 70) return "text-accent-red";
        if (v > 60) return "text-accent-orange";
        return "text-gray-300";
    },
    trendColor(v) {
        if (v === "Bullish") return "text-accent-green";
        if (v === "Bearish") return "text-accent-red";
        return "text-accent-yellow";
    },
    deltaColor(v) {
        if (v > 0) return "text-accent-green";
        if (v < 0) return "text-accent-red";
        return "text-gray-400";
    },
    earningsColor(v) {
        if (v == null) return "text-gray-500";
        if (v < 7) return "text-accent-red font-bold";
        if (v <= 21) return "text-accent-yellow";
        return "text-gray-400";
    },
    // shortColor now uses days-to-cover (shortRatio), not float %
    shortColor(v) {
        if (v == null) return "";
        if (v > 10) return "text-accent-red font-bold";
        if (v > 5) return "text-accent-orange";
        return "text-gray-300";
    },
    rsSpyColor(v) {
        if (v == null) return "";
        if (v > 1.05) return "text-accent-green";
        if (v < 0.95) return "text-accent-red";
        return "text-gray-300";
    },
    fibPosColor(v) {
        if (v === "ABOVE_786") return "text-accent-red";
        if (v === "BELOW_236") return "text-accent-green";
        if (v === "BETWEEN_382_618") return "text-accent-blue";
        return "text-gray-400";
    },
    scoreBg(s) {
        if (s >= 70) return "bg-green-600/20 text-green-400 border border-green-600/30";
        if (s >= 40) return "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30";
        return "bg-red-600/20 text-red-400 border border-red-600/30";
    },
    setupBg(t) {
        if (t === "LONG") return "bg-green-600/20 text-green-400 border border-green-600/30";
        if (t === "SHORT") return "bg-red-600/20 text-red-400 border border-red-600/30";
        return "bg-gray-600/20 text-gray-400 border border-gray-600/30";
    },
    sweepColor(v) {
        if (v === "BUY_SWP") return "text-accent-red";
        if (v === "SELL_SWP") return "text-accent-green";
        return "text-gray-500";
    },
    macdColor(v) {
        if (v == null) return "text-gray-400";
        return v > 0 ? "text-accent-green" : "text-accent-red";
    },
    obvColor(v) {
        if (v === "UP") return "text-accent-green";
        if (v === "DOWN") return "text-accent-red";
        return "text-gray-400";
    },
    targetUpsideColor(v) {
        if (v == null) return "text-gray-400";
        if (v > 15) return "text-accent-green";
        if (v < -5) return "text-accent-red";
        return "text-gray-300";
    },
    vixColor(v) {
        if (v == null) return "text-gray-400";
        if (v < 15) return "text-accent-green";
        if (v < 20) return "text-accent-yellow";
        if (v < 30) return "text-accent-orange";
        return "text-accent-red font-bold";
    },

    // EPS growth: integer only, no decimals. Values >±999% indicate near-zero baseline EPS.
    fmtEpsGrowth(v) {
        if (v == null) return "-";
        const n = Math.round(v);
        const sign = n > 0 ? "+" : "";
        return sign + n + "%";
    },

    fvgDisplay(d) {
        if (!d.fvg_type) return "-";
        const col = d.fvg_type === "BULL" ? "text-accent-green" : "text-accent-red";
        return `<span class="${col}">${d.fvg_type} ${d.fvg_fill_pct}%</span>`;
    },

    fibPosShort(v) {
        if (!v) return "-";
        return v.replace("BETWEEN_", "").replace("ABOVE_", ">").replace("BELOW_", "<").replace("_", "-");
    },

    rsiTooltip(v) {
        if (v == null) return "";
        if (v < 30) return `RSI ${this.fmt(v, 1)} - Oversold, potential entry zone`;
        if (v < 45) return `RSI ${this.fmt(v, 1)} - Entry zone (30-45)`;
        if (v <= 55) return `RSI ${this.fmt(v, 1)} - Neutral zone`;
        if (v <= 70) return `RSI ${this.fmt(v, 1)} - Getting warm, watch for reversal`;
        return `RSI ${this.fmt(v, 1)} - Overbought, exit/avoid`;
    },

    buildScoreTooltip(d) {
        const bd = d.score_breakdown;
        if (!bd) return `Score: ${d.composite_score}/100`;
        let html = `<div style="text-align:left;">`;
        html += `<div style="font-weight:700; margin-bottom:4px; color:#e2e8f0;">Score: ${d.composite_score}/100</div>`;
        bd.criteria.forEach(c => {
            const cls = c.met ? "met" : "not-met";
            const icon = c.met ? "+" : "-";
            const pts = c.met ? `(+${c.pts})` : "";
            html += `<div class="tip-row ${cls}">${icon} ${c.name}: ${c.value} ${pts}</div>`;
        });
        if (bd.penalties && bd.penalties.length > 0) {
            html += `<div style="margin-top:4px; border-top:1px solid #3b4260; padding-top:4px;">`;
            bd.penalties.forEach(p => {
                html += `<div class="tip-row penalty">! ${p.name} (${p.pts})</div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    },

    buildSetupTooltip(d) {
        if (!d.setup_reasons || d.setup_reasons.length === 0) return `Setup: ${d.setup_type}`;
        let html = `<div style="text-align:left;">`;
        html += `<div style="font-weight:700; margin-bottom:4px; color:#e2e8f0;">${d.setup_type} ${d.setup_criteria_met}/${d.setup_total_criteria}</div>`;
        if (d.setup_sizing_pct > 0) html += `<div style="color:#22c55e; margin-bottom:4px;">Sizing: ${d.setup_sizing_pct}%</div>`;
        d.setup_reasons.forEach(r => {
            html += `<div class="tip-row" style="color:#94a3b8;">- ${r}</div>`;
        });
        html += `</div>`;
        return html;
    },

    // --- Fear & Greed badge ---
    updateFGBadge(fgData) {
        const el = document.getElementById("fg-badge");
        if (!el) return;
        if (!fgData || fgData.score == null) {
            el.innerHTML = "F&amp;G: —";
            el.className = "px-3 py-1 rounded text-sm font-semibold bg-surface-700 text-gray-400";
            return;
        }
        const s = fgData.score;
        const cls = s <= 25
            ? "bg-red-900/40 text-red-400 border border-red-700/40"
            : s <= 45
            ? "bg-orange-900/40 text-orange-400 border border-orange-700/40"
            : s <= 55
            ? "bg-yellow-900/40 text-yellow-300 border border-yellow-700/40"
            : s <= 75
            ? "bg-green-900/40 text-green-400 border border-green-700/40"
            : "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40";
        const prev = fgData.prev_close != null
            ? ` <span style="font-size:10px; opacity:0.65;">prev ${fgData.prev_close}</span>`
            : "";
        el.innerHTML = `<span title="CNN Fear &amp; Greed Index — 0 = Extreme Fear · 100 = Extreme Greed">F&amp;G: ${s} <span style="font-size:11px; opacity:0.8;">${fgData.rating}</span>${prev}</span>`;
        el.className = `px-3 py-1 rounded text-sm ${cls}`;
    },

    // --- VIX header badge ---
    updateVixBadge(vixValue) {
        const el = document.getElementById("vix-badge");
        if (!el) return;
        if (vixValue == null) {
            el.textContent = "VIX: —";
            el.className = "px-3 py-1 rounded text-sm font-semibold bg-surface-700 text-gray-400";
            return;
        }
        const cls = vixValue < 15
            ? "bg-green-900/40 text-green-400 border border-green-700/40"
            : vixValue < 20
            ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700/40"
            : vixValue < 30
            ? "bg-orange-900/40 text-orange-400 border border-orange-700/40"
            : "bg-red-900/40 text-red-400 border border-red-700/40 font-bold";
        el.textContent = `VIX: ${this.fmt(vixValue, 2)}`;
        el.className = `px-3 py-1 rounded text-sm ${cls}`;
    },

    // --- Cache banner ---
    showCacheBanner(message) {
        let banner = document.getElementById("cache-banner");
        if (!banner) return;
        banner.textContent = message;
        banner.classList.remove("hidden");
    },

    hideCacheBanner() {
        const banner = document.getElementById("cache-banner");
        if (banner) banner.classList.add("hidden");
    },

    // --- Main render ---
    renderDashboard(marketData, chartData, timestamp, vixValue, fromCache, ageHours, fgData) {
        this._marketData = marketData;
        this._chartData = chartData;

        const tickers = Object.keys(marketData);

        // Header
        document.getElementById("header-timestamp").textContent = fromCache
            ? `Cached snapshot: ${timestamp}`
            : `Live snapshot: ${timestamp}`;
        document.getElementById("ticker-count").textContent = `${tickers.length} tickers`;

        // Cache banner
        if (fromCache && ageHours != null) {
            const h = Math.floor(ageHours);
            const m = Math.round((ageHours - h) * 60);
            const age = h > 0 ? `${h}h ${m}m` : `${m}m`;
            const warn = ageHours > CONFIG.CACHE_TTL_HOURS ? " ⚠ Stale!" : "";
            this.showCacheBanner(`Date din cache (${age} în urmă)${warn} · Apasă Refresh pentru actualizare`);
        } else {
            this.hideCacheBanner();
        }

        // Tables
        const tbody = document.getElementById("table-body");
        const detailBody = document.getElementById("detail-table-body");
        tbody.innerHTML = "";
        detailBody.innerHTML = "";

        tickers.forEach((ticker, idx) => {
            const d = marketData[ticker];
            const bgClass = idx % 2 === 0 ? "bg-surface-800" : "bg-surface-900/50";

            const setupLabel = d.setup_type === "WAIT" ? "WAIT" : `${d.setup_type} ${d.setup_criteria_met}/${d.setup_total_criteria}`;
            const sizingNote = d.setup_sizing_pct > 0 ? ` ${d.setup_sizing_pct}%` : "";

            // Primary row
            const row = document.createElement("tr");
            row.className = `ticker-row ${bgClass} border-b border-gray-800/50`;
            row.onclick = () => Charts.toggleChart(ticker, d, chartData[ticker]);
            row.innerHTML = `
                <td class="px-3 py-3 font-bold text-white">${ticker}</td>
                <td class="px-3 py-3 text-right cell-val text-white font-medium">${this.fmt(d.price)}</td>
                <td class="px-3 py-3 text-right cell-val ${this.deltaColor(d.delta_1d_pct)}">${d.delta_1d_pct > 0 ? "+" : ""}${this.fmtPct(d.delta_1d_pct)}</td>
                <td class="px-3 py-3 text-center">
                    <span class="tip"><span class="score-badge ${this.scoreBg(d.composite_score)}">${d.composite_score}</span><span class="tiptext">${this.buildScoreTooltip(d)}</span></span>
                </td>
                <td class="px-3 py-3 text-center">
                    <span class="tip"><span class="setup-badge ${this.setupBg(d.setup_type)}">${setupLabel}${sizingNote}</span><span class="tiptext">${this.buildSetupTooltip(d)}</span></span>
                </td>
                <td class="px-3 py-3 text-right cell-val tip ${this.rsiColor(d.rsi_daily)}">${this.fmt(d.rsi_daily, 1)}<span class="tiptext">${this.rsiTooltip(d.rsi_daily)}</span></td>
                <td class="px-3 py-3 text-center ${this.trendColor(d.trend)}">${d.trend}</td>
                <td class="px-3 py-3 text-center ${this.trendColor(d.structure)}">${d.structure}</td>
                <td class="px-3 py-3 text-center ${this.earningsColor(d.days_to_earnings)}">${d.days_to_earnings != null ? d.days_to_earnings + "d" : "-"}</td>
                <td class="px-3 py-3 text-center">${d.analyst_rating || "-"}</td>
            `;
            tbody.appendChild(row);

            if (idx < 2) row.querySelectorAll(".tip").forEach(el => el.classList.add("tip-down"));

            // Chart panel row (colspan 10 — primary table)
            const chartRow = document.createElement("tr");
            chartRow.className = bgClass;
            chartRow.innerHTML = `<td colspan="10" class="p-0"><div id="chart-panel-${ticker}" class="chart-panel"></div></td>`;
            tbody.appendChild(chartRow);

            // MACD display
            const macdDisp = d.macd_val != null
                ? `<span class="${this.macdColor(d.macd_hist)}">${this.fmt(d.macd_val, 3)}${d.macd_crossover === "BULL" ? " ↑" : d.macd_crossover === "BEAR" ? " ↓" : ""}</span>`
                : "-";

            // OBV display
            const obvDisp = d.obv_trend
                ? `<span class="${this.obvColor(d.obv_trend)}">${d.obv_trend}</span>`
                : "-";

            // Pivot display
            const pivotDisp = (d.pivot_r1 != null && d.pivot_s1 != null)
                ? `<span class="text-accent-red">${this.fmt(d.pivot_r1)}</span><span class="text-gray-500"> / </span><span class="text-accent-green">${this.fmt(d.pivot_s1)}</span>`
                : "-";

            // Price target upside display
            const targetDisp = d.price_target_upside != null
                ? `<span class="${this.targetUpsideColor(d.price_target_upside)}">${d.price_target_upside > 0 ? "+" : ""}${this.fmt(d.price_target_upside, 1)}%</span>`
                : "-";

            // Analyst action display (truncate)
            const actionDisp = d.latest_analyst_action
                ? `<span class="text-gray-300" title="${d.latest_analyst_action}">${d.latest_analyst_action.slice(0, 22)}</span>`
                : "-";

            // Detail row
            const detRow = document.createElement("tr");
            detRow.className = `${bgClass} border-b border-gray-800/50`;
            detRow.innerHTML = `
                <td class="px-2 py-2.5 font-bold text-white">${ticker}</td>
                <td class="px-2 py-2.5 text-right cell-val tip">${this.fmtPct(d.atr_pct)}<span class="tiptext">ATR% ${this.fmt(d.atr_pct, 2)}% - ${d.atr_pct > 5 ? "Extreme volatility!" : d.atr_pct > 3 ? "High vol" : "Normal"}</span></td>
                <td class="px-2 py-2.5 text-right cell-val text-gray-300">${this.fmt(d.ema50)}</td>
                <td class="px-2 py-2.5 text-right cell-val text-gray-300">${this.fmt(d.ema200)}</td>
                <td class="px-2 py-2.5 text-right cell-val text-gray-300">${this.fmt(d.avwap_30d)}</td>
                <td class="px-2 py-2.5 text-right cell-val text-gray-300">${this.fmt(d.poc_14d)}</td>
                <td class="px-2 py-2.5 text-right cell-val tip">${this.fmt(d.adx, 1)}<span class="tiptext">ADX ${this.fmt(d.adx, 1)} - ${d.adx > 30 ? "Strong trend" : d.adx > 20 ? "Developing trend" : "Ranging / No direction"}</span></td>
                <td class="px-2 py-2.5 text-right cell-val tip">${this.fmtPct(d.bb_bandwidth)}<span class="tiptext">BB Bandwidth ${this.fmt(d.bb_bandwidth, 2)}% - ${d.bb_bandwidth < 1.5 ? "Squeeze!" : d.bb_bandwidth > 5 ? "Expanded" : "Normal"}</span></td>
                <td class="px-2 py-2.5 text-center ${this.sweepColor(d.sweep)}">${d.sweep === "Neutral" ? "-" : d.sweep}</td>
                <td class="px-2 py-2.5 text-center">${this.fvgDisplay(d)}</td>
                <td class="px-2 py-2.5 text-center ${this.fibPosColor(d.fib_position)}">${this.fibPosShort(d.fib_position)}</td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmt(d.vol_avg_ratio, 1)}x</td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmtPct(d.position_52w_pct)}</td>
                <td class="px-2 py-2.5 text-right cell-val ${this.rsSpyColor(d.rs_spy_30d)}">${this.fmt(d.rs_spy_30d, 3)}</td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmt(d.pe_trailing, 1)}</td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmt(d.pe_forward, 1)}</td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmtEpsGrowth(d.eps_growth_yoy)}</td>
                <td class="px-2 py-2.5 text-right cell-val tip ${this.shortColor(d.short_ratio)}">${d.short_ratio != null ? this.fmt(d.short_ratio, 1) + "d" : "-"}<span class="tiptext">Days to cover. &gt;5 = elevated, &gt;10 = squeeze territory</span></td>
                <td class="px-2 py-2.5 text-right cell-val">${this.fmt(d.beta, 2)}</td>
                <td class="px-2 py-2.5 text-center">${macdDisp}</td>
                <td class="px-2 py-2.5 text-center">${obvDisp}</td>
                <td class="px-2 py-2.5 text-center text-[12px]">${pivotDisp}</td>
                <td class="px-2 py-2.5 text-right cell-val">${targetDisp}</td>
                <td class="px-2 py-2.5 text-left text-[12px]">${actionDisp}</td>
            `;
            detailBody.appendChild(detRow);
        });

        // Summaries
        this.buildSummaries(tickers, marketData);

        // Show dashboard, hide loading
        document.getElementById("loading-section").classList.add("hidden");
        document.getElementById("dashboard-content").classList.remove("hidden");
    },

    buildSummaries(tickers, marketData) {
        const container = document.getElementById("summary-container");
        container.innerHTML = "";

        tickers.forEach(ticker => {
            const d = marketData[ticker];
            const card = document.createElement("div");
            card.className = "analysis-card";

            // ── Header values ─────────────────────────────────────────────
            const priceDelta = d.delta_1d_pct > 0 ? `+${this.fmtPct(d.delta_1d_pct)}` : this.fmtPct(d.delta_1d_pct);
            const deltaC = d.delta_1d_pct > 0 ? "text-accent-green" : d.delta_1d_pct < 0 ? "text-accent-red" : "text-gray-400";
            const scoreC = d.composite_score >= 70 ? "#22c55e" : d.composite_score >= 40 ? "#eab308" : "#ef4444";
            const setupC = d.setup_type === "LONG" ? "#22c55e" : d.setup_type === "SHORT" ? "#ef4444" : "#eab308";

            // ── Key metric labels ─────────────────────────────────────────
            const rsiLabel = d.rsi_daily == null ? "-" :
                d.rsi_daily < 30 ? `<span class="text-accent-green">${this.fmt(d.rsi_daily,1)} (Oversold)</span>` :
                d.rsi_daily < 45 ? `<span class="text-accent-green">${this.fmt(d.rsi_daily,1)} (Entry zone)</span>` :
                d.rsi_daily <= 55 ? `<span class="text-gray-300">${this.fmt(d.rsi_daily,1)} (Neutral)</span>` :
                d.rsi_daily <= 70 ? `<span class="text-accent-orange">${this.fmt(d.rsi_daily,1)} (Warm)</span>` :
                `<span class="text-accent-red">${this.fmt(d.rsi_daily,1)} (Overbought)</span>`;

            const trendLabel = `<span class="${this.trendColor(d.trend)}">${d.trend || "-"}</span>`;
            const structLabel = `<span class="${this.trendColor(d.structure)}">${d.structure || "-"}</span>`;

            const earnLabel = d.days_to_earnings != null
                ? `<span class="${this.earningsColor(d.days_to_earnings)}">${d.days_to_earnings}d ${d.days_to_earnings < 7 ? "⚠ Danger" : d.days_to_earnings <= 21 ? "Caution" : "Safe"}</span>`
                : `<span class="text-gray-500">-</span>`;

            const atrLabel = d.atr_pct != null
                ? `${this.fmt(d.atr_pct,2)}% <span class="text-gray-500">${d.atr_pct > 5 ? "(extreme)" : d.atr_pct > 3 ? "(high)" : "(normal)"}</span>`
                : "-";

            const adxLabel = d.adx != null
                ? `${this.fmt(d.adx,1)} <span class="text-gray-500">${d.adx > 30 ? "(strong)" : d.adx > 20 ? "(developing)" : "(ranging)"}</span>`
                : "-";

            const bbBWLabel = d.bb_bandwidth != null
                ? `${this.fmt(d.bb_bandwidth,2)}% <span class="text-gray-500">${d.bb_bandwidth < 1.5 ? "🔥 Squeeze!" : d.bb_bandwidth > 5 ? "(expanded)" : "(normal)"}</span>`
                : "-";

            const macdLabel = d.macd_val != null
                ? `<span class="${this.macdColor(d.macd_hist)}">${this.fmt(d.macd_val,3)}${d.macd_crossover === "BULL" ? " ↑ Bull X" : d.macd_crossover === "BEAR" ? " ↓ Bear X" : ""}</span>`
                : "-";

            const obvLabel = d.obv_trend
                ? `<span class="${this.obvColor(d.obv_trend)}">${d.obv_trend}</span>`
                : "-";

            const fibLabel = d.fib_position
                ? `<span class="${this.fibPosColor(d.fib_position)}">${this.fibPosShort(d.fib_position)}</span>`
                : "-";

            const avwapCtx = (d.price && d.avwap_30d)
                ? `$${this.fmt(d.avwap_30d)} <span class="${d.price > d.avwap_30d ? "text-accent-green" : "text-accent-red"}">${d.price > d.avwap_30d ? "↑ above" : "↓ below"}</span>`
                : "-";

            const rsSpyLabel = d.rs_spy_30d != null
                ? `<span class="${this.rsSpyColor(d.rs_spy_30d)}">${this.fmt(d.rs_spy_30d,3)} ${d.rs_spy_30d > 1.0 ? "(beats SPY)" : "(lags SPY)"}</span>`
                : "-";

            const volAvgLabel = d.vol_avg_ratio != null
                ? `${this.fmt(d.vol_avg_ratio,1)}x <span class="text-gray-500">${d.vol_avg_ratio > 1.5 ? "(high)" : d.vol_avg_ratio < 0.7 ? "(low)" : "(normal)"}</span>`
                : "-";

            const shortLabel = d.short_ratio != null
                ? `<span class="${this.shortColor(d.short_ratio)}">${this.fmt(d.short_ratio,1)}d ${d.short_ratio > 10 ? "🔥 Squeeze" : d.short_ratio > 5 ? "elevated" : ""}</span>`
                : "-";

            const epsLabel = d.eps_growth_yoy != null
                ? `<span class="${d.eps_growth_yoy > 0 ? "text-accent-green" : "text-accent-red"}">${this.fmtEpsGrowth(d.eps_growth_yoy)}</span>`
                : "-";

            const targetLabel = d.price_target_upside != null
                ? `<span class="${this.targetUpsideColor(d.price_target_upside)}">${d.price_target_upside > 0 ? "+" : ""}${this.fmt(d.price_target_upside,1)}%</span>`
                : "-";

            const ratingLabel = d.analyst_rating
                ? `<span class="${d.analyst_rating === "Buy" ? "text-accent-green" : d.analyst_rating === "Sell" ? "text-accent-red" : "text-accent-yellow"}">${d.analyst_rating}</span>`
                : "-";

            // ── Setup + sizing line ───────────────────────────────────────
            const setupLine = d.setup_type === "WAIT"
                ? `<span style="color:#eab308;">WAIT</span>`
                : `<span style="color:${setupC};">${d.setup_type}</span> <span class="text-gray-500">${d.setup_criteria_met}/${d.setup_total_criteria} · ${d.setup_sizing_pct}% size</span>`;

            // ── Action line ───────────────────────────────────────────────
            let actionHtml;
            if (d.setup_type === "LONG" || d.setup_type === "SHORT") {
                const slPrice = d.atr != null
                    ? ` · SL $${this.fmt(d.price + (d.setup_type === "SHORT" ? 1 : -1) * 1.5 * d.atr)}`
                    : "";
                actionHtml = `<div class="analysis-action" style="color:${setupC};">▶ ${d.setup_type} — ${d.setup_sizing_pct}% sizing${slPrice}</div>`;
            } else if (d.setup_total_criteria === 0) {
                // Hard WAIT — blocked by specific condition
                actionHtml = `<div class="analysis-action" style="color:#f59e0b;">⚠ WAIT — ${(d.setup_reasons || ["condition blocked"])[0]}</div>`;
            } else {
                // Soft WAIT — insufficient confluence
                const lc = (d.setup_long_met || []).length;
                const sc = (d.setup_short_met || []).length;
                actionHtml = `<div class="analysis-action" style="color:#eab308;">⏸ WAIT — LONG ${lc}/6 · SHORT ${sc}/6</div>`;
            }

            // ── Criteria breakdown (rich met/miss) ────────────────────────
            let criteriaHtml = "";

            if (d.setup_type === "LONG" || d.setup_type === "SHORT") {
                const isLong  = d.setup_type === "LONG";
                const dirMet  = isLong ? (d.setup_long_met  || []) : (d.setup_short_met  || []);
                const dirMiss = isLong ? (d.setup_long_miss || []) : (d.setup_short_miss || []);
                const dirCol  = isLong ? "#22c55e" : "#ef4444";

                // Build action checklist
                const acts = [];

                // 1. Stop loss (always, if ATR available)
                if (d.atr != null && d.price != null) {
                    const slPrice = isLong
                        ? Math.round((d.price - 1.5 * d.atr) * 100) / 100
                        : Math.round((d.price + 1.5 * d.atr) * 100) / 100;
                    acts.push(`Set stop loss at <strong>$${this.fmt(slPrice)}</strong> — 1.5× ATR (${this.fmt(d.atr)}) ${isLong ? "below" : "above"} entry`);
                }

                // 2. First target (pivot)
                if (isLong && d.pivot_r1 != null)
                    acts.push(`First target: <strong>R1 $${this.fmt(d.pivot_r1)}</strong> — consider partial exit (50%) there`);
                else if (!isLong && d.pivot_s1 != null)
                    acts.push(`First target: <strong>S1 $${this.fmt(d.pivot_s1)}</strong> — consider partial exit (50%) there`);

                // 3. Position sizing reminder
                if (d.setup_sizing_pct != null && d.setup_sizing_pct < 100)
                    acts.push(`Position sizing: <strong>${d.setup_sizing_pct}%</strong> of normal size (${d.setup_criteria_met}/6 criteria — scale up when 5+ met)`);

                // 4. Earnings warning
                if (d.days_to_earnings != null && d.days_to_earnings <= 21)
                    acts.push(`⚠ Earnings in <strong>${d.days_to_earnings}d</strong> — reduce size or close before report to avoid gap risk`);

                // 5. ATR elevated
                if (d.atr_pct != null && d.atr_pct > 3)
                    acts.push(`ATR ${this.fmt(d.atr_pct, 2)}% elevated — widen stops accordingly or reduce size`);

                // 6. OBV divergence warning
                if (isLong && d.obv_trend === "DOWN")
                    acts.push(`⚠ OBV trending down — volume not confirming price rise, watch for reversal`);
                else if (!isLong && d.obv_trend === "UP")
                    acts.push(`⚠ OBV trending up — volume not confirming price drop, watch for reversal`);

                // 7. RS vs SPY
                if (isLong && d.rs_spy_30d != null && d.rs_spy_30d < 0.95)
                    acts.push(`RS vs SPY ${this.fmt(d.rs_spy_30d, 2)} — underperforming market, prefer tickers above 1.00`);
                else if (!isLong && d.rs_spy_30d != null && d.rs_spy_30d > 1.05)
                    acts.push(`RS vs SPY ${this.fmt(d.rs_spy_30d, 2)} — outperforming market, short may face headwinds`);

                // 8. RSI context
                if (isLong && d.rsi_daily != null) {
                    if (d.rsi_daily > 70)
                        acts.push(`RSI ${this.fmt(d.rsi_daily, 1)} overbought — consider waiting for pullback to 50–60 range for better entry`);
                    else if (d.rsi_daily < 40)
                        acts.push(`RSI ${this.fmt(d.rsi_daily, 1)} weak — momentum not yet bullish, confirm with volume`);
                } else if (!isLong && d.rsi_daily != null) {
                    if (d.rsi_daily < 30)
                        acts.push(`RSI ${this.fmt(d.rsi_daily, 1)} oversold — short may be late, risk of snap-back rally`);
                    else if (d.rsi_daily > 60)
                        acts.push(`RSI ${this.fmt(d.rsi_daily, 1)} elevated — good short momentum, watch for 40 as first target zone`);
                }

                // 9. MACD divergence
                if (isLong && d.macd_crossover === "BEAR")
                    acts.push(`MACD bearish cross — momentum diverging, reduce size until MACD realigns bullish`);
                else if (!isLong && d.macd_crossover === "BULL")
                    acts.push(`MACD bullish cross — momentum turning up, use tighter stops on short`);

                // 10. Price target analyst upside
                if (isLong && d.price_target_upside != null && d.price_target_upside > 10)
                    acts.push(`Analyst target upside: <strong>+${this.fmt(d.price_target_upside, 1)}%</strong> — confirms bullish thesis`);
                else if (!isLong && d.price_target_upside != null && d.price_target_upside < 0)
                    acts.push(`Analyst target downside: <strong>${this.fmt(d.price_target_upside, 1)}%</strong> — analysts also bearish`);

                const actsHtml = acts.length > 0
                    ? `<div class="crit-label" style="margin-top:8px; color:#475569;">📋 Action checklist</div>
                       ${acts.map(a => `<div style="color:#64748b; margin:2px 0; font-size:12px;">→ ${a}</div>`).join("")}`
                    : "";

                criteriaHtml = `<div class="analysis-criteria">
                    <div class="crit-label" style="color:${dirCol};">${d.setup_type} criteria — ${d.setup_criteria_met}/6 met · ${d.setup_sizing_pct}% position size</div>
                    ${dirMet.map(r  => `<div class="crit-met">✓ ${r}</div>`).join("")}
                    ${dirMiss.map(r => `<div class="crit-miss">✗ ${r}</div>`).join("")}
                    ${actsHtml}
                </div>`;

            } else if (d.setup_total_criteria === 0) {
                // Hard WAIT — show blockers + contextual recommendations + directional state
                const lc2   = (d.setup_long_met  || []).length;
                const sc2   = (d.setup_short_met || []).length;
                const cd2   = lc2 > sc2 ? "LONG" : lc2 < sc2 ? "SHORT" : null;
                const cm2   = cd2 === "LONG" ? (d.setup_long_met  || []) : cd2 === "SHORT" ? (d.setup_short_met  || []) : [];
                const cx2   = cd2 === "LONG" ? (d.setup_long_miss || []) : cd2 === "SHORT" ? (d.setup_short_miss || []) : [];
                const cc2   = cd2 === "LONG" ? "#22c55e" : cd2 === "SHORT" ? "#ef4444" : "#94a3b8";
                const reasons = d.setup_reasons || [];

                // Build contextual recommendations based on blocker type
                const recs = [];
                if (reasons.some(r => r.includes("No directional") || r.includes("Neutral structure"))) {
                    recs.push(`Watch for market structure to develop: HH+HL pattern <span style="color:#22c55e;">→ LONG</span> / LH+LL pattern <span style="color:#ef4444;">→ SHORT</span>`);
                    if (d.adx != null)
                        recs.push(`ADX ${this.fmt(d.adx,1)} — needs to rise above 20 to signal a trending market`);
                    if (d.bb_bandwidth != null && d.bb_bandwidth < 3)
                        recs.push(`BB-BW ${this.fmt(d.bb_bandwidth,2)}% squeeze — volatility expansion likely soon, prepare for a directional move`);
                    if (d.price && d.ema200)
                        recs.push(`Price $${this.fmt(d.price)} is ${d.price > d.ema200 ? `<span style="color:#22c55e;">above</span> EMA200 ($${this.fmt(d.ema200)}) — long-term bullish backdrop` : `<span style="color:#ef4444;">below</span> EMA200 ($${this.fmt(d.ema200)}) — long-term bearish backdrop`}`);
                }
                if (reasons.some(r => r.includes("Earnings in"))) {
                    if (d.days_to_earnings != null)
                        recs.push(`Wait ${d.days_to_earnings}d — enter only after the earnings report is released`);
                    recs.push(`Post-earnings: look for gap fill + volume &gt;2× average for entry confirmation`);
                }
                if (reasons.some(r => r.includes("ATR") && r.includes("exceeds"))) {
                    recs.push(`ATR ${this.fmt(d.atr_pct,2)}% too high — wait for daily range to normalize below 5%`);
                    recs.push(`If trading now: use smaller position size and wider stops`);
                }
                if (reasons.some(r => r.includes("trapped between EMA"))) {
                    recs.push(`Break above EMA200 ($${this.fmt(d.ema200)}) = potential <span style="color:#22c55e;">LONG</span> trigger`);
                    recs.push(`Break below EMA50 ($${this.fmt(d.ema50)}) = potential <span style="color:#ef4444;">SHORT</span> trigger`);
                }
                if (reasons.some(r => r.includes("Bollinger Band squeeze"))) {
                    recs.push(`BB squeeze — wait for breakout direction with volume confirmation before entry`);
                }
                if (reasons.some(r => r.includes("RSI overbought"))) {
                    recs.push(`RSI ${this.fmt(d.rsi_daily,1)} overbought — wait for pullback to normalize RSI below 70`);
                }
                if (reasons.some(r => r.includes("Fundamental deterioration"))) {
                    recs.push(`Avoid LONG until EPS growth turns positive`);
                    recs.push(`SHORT may be valid if EMA200 and market structure also align bearish`);
                }

                const recsHtml = recs.length > 0
                    ? `<div class="crit-label" style="margin-top:8px; color:#475569;">📋 What to watch for</div>
                       ${recs.map(r => `<div style="color:#64748b; margin:2px 0; font-size:12px;">→ ${r}</div>`).join("")}`
                    : "";

                // Only show directional state if some criteria are already met
                const dirHtml = (lc2 > 0 || sc2 > 0)
                    ? `<div class="crit-label" style="margin-top:8px; color:#475569;">Current direction — <span style="color:${cc2};">${cd2 ? `leaning ${cd2} ${Math.max(lc2,sc2)}/6` : `LONG ${lc2}/6 · SHORT ${sc2}/6`}</span></div>
                       ${cm2.map(r => `<div class="crit-met">✓ ${r}</div>`).join("")}
                       ${cx2.map(r => `<div class="crit-miss">✗ ${r}</div>`).join("")}`
                    : `<div style="color:#475569; font-size:11px; margin-top:8px; padding-top:6px; border-top:1px solid #1e2231;">No directional signals yet — waiting for conditions above to resolve</div>`;

                criteriaHtml = `<div class="analysis-criteria">
                    <div class="crit-label" style="color:#f59e0b;">⚠ Market condition blockers</div>
                    ${reasons.map(r => `<div class="crit-wait">· ${r}</div>`).join("")}
                    ${recsHtml}
                    ${dirHtml}
                </div>`;

            } else {
                // Soft WAIT — show both directions with met/miss for closest
                const lc = (d.setup_long_met  || []).length;
                const sc = (d.setup_short_met || []).length;
                const closerDir  = lc > sc ? "LONG" : lc < sc ? "SHORT" : null;
                const closerMet  = closerDir === "LONG" ? (d.setup_long_met  || []) : closerDir === "SHORT" ? (d.setup_short_met  || []) : [];
                const closerMiss = closerDir === "LONG" ? (d.setup_long_miss || []) : closerDir === "SHORT" ? (d.setup_short_miss || []) : [];
                const closerCol  = closerDir === "LONG" ? "#22c55e" : closerDir === "SHORT" ? "#ef4444" : "#94a3b8";
                const headerText = closerDir
                    ? `<span style="color:${closerCol};">Leaning ${closerDir}</span> — need 4+ criteria`
                    : `Tied — no clear direction`;

                criteriaHtml = `<div class="analysis-criteria">
                    <div class="crit-label">⏸ Insufficient confluence · ${headerText}</div>
                    <div style="color:#475569; font-size:11px; margin-bottom:4px;">LONG ${lc}/6 · SHORT ${sc}/6</div>
                    ${closerMet.map(r  => `<div class="crit-met">✓ ${r}</div>`).join("")}
                    ${closerMiss.map(r => `<div class="crit-miss">✗ ${r}</div>`).join("")}
                </div>`;
            }

            card.innerHTML = `
                <div class="analysis-card-hdr">
                    <span class="analysis-card-title text-white">${ticker}</span>
                    <span class="text-gray-400 text-xs">$${this.fmt(d.price)} <span class="${deltaC}">${priceDelta}</span></span>
                </div>
                <div class="flex gap-2 items-center mb-2">
                    <span style="font-size:14px; font-weight:700; color:${scoreC};">${d.composite_score}</span>
                    <span class="text-gray-600 text-xs">score</span>
                    <span class="text-gray-600">·</span>
                    <span style="font-size:13px;">${setupLine}</span>
                </div>
                <div class="analysis-kv">
                    <span class="k">RSI</span>       <span class="v">${rsiLabel}</span>
                    <span class="k">Trend</span>     <span class="v">${trendLabel}</span>
                    <span class="k">Structure</span> <span class="v">${structLabel}</span>
                    <span class="k">ADX</span>       <span class="v">${adxLabel}</span>
                    <span class="k">Earnings</span>  <span class="v">${earnLabel}</span>
                    <span class="k">ATR%</span>      <span class="v">${atrLabel}</span>
                    <span class="k">BB-BW</span>     <span class="v">${bbBWLabel}</span>
                    <span class="k">MACD</span>      <span class="v">${macdLabel}</span>
                    <span class="k">OBV</span>       <span class="v">${obvLabel}</span>
                    <span class="k">Fib</span>       <span class="v">${fibLabel}</span>
                    <span class="k">AVWAP30d</span>  <span class="v">${avwapCtx}</span>
                    <span class="k">RS-SPY</span>    <span class="v">${rsSpyLabel}</span>
                    <span class="k">Vol/Avg</span>   <span class="v">${volAvgLabel}</span>
                    <span class="k">Short</span>     <span class="v">${shortLabel}</span>
                    <span class="k">EPS YoY</span>   <span class="v">${epsLabel}</span>
                    <span class="k">Target↑</span>   <span class="v">${targetLabel}</span>
                    <span class="k">Rating</span>    <span class="v">${ratingLabel}</span>
                    ${d.latest_analyst_action ? `<span class="k">Analyst</span><span class="v text-gray-400" style="font-size:11px;">${d.latest_analyst_action}</span>` : ""}
                </div>
                ${actionHtml}
                ${criteriaHtml}
            `;
            container.appendChild(card);
        });
    },

    // --- Macro Indicators Panel ---
    toggleMacroPanel() {
        const body = document.getElementById("macro-body");
        const ci   = document.getElementById("macro-ci");
        if (!body) return;
        body.classList.toggle("hidden");
        if (ci) ci.classList.toggle("rotated");
    },

    buildMacroPanel(fgData, vixValue) {
        const body = document.getElementById("macro-body");
        if (!body) return;

        if (!fgData) {
            body.innerHTML = `<div style="font-size:11px; color:#475569; padding:6px 0 10px;">Fear &amp; Greed data unavailable — CNN API may be blocked or down.</div>`;
            return;
        }

        // ── Shared helpers ───────────────────────────────────────────────
        const scoreColor = s => {
            if (s <= 25) return "#ef4444";
            if (s <= 45) return "#f97316";
            if (s <= 55) return "#eab308";
            if (s <= 75) return "#22c55e";
            return "#10b981";
        };
        const ratingLabel = s => {
            if (s <= 25) return "Extreme Fear";
            if (s <= 45) return "Fear";
            if (s <= 55) return "Neutral";
            if (s <= 75) return "Greed";
            return "Extreme Greed";
        };

        // ── Indicator metadata (display name + tooltip content) ──────────
        const IND_META = {
            momentum: {
                name: "S&P 500 Momentum",
                desc: "Tracks S&amp;P 500 vs its 125-day moving average.",
                fear: "Price falling below the 125d MA — selling pressure dominant.",
                greed: "Price well above the 125d MA — sustained bullish momentum.",
            },
            strength: {
                name: "Stock Price Strength",
                desc: "Ratio of NYSE stocks at 52-week highs vs lows.",
                fear: "More stocks hitting yearly lows — broad market weakness.",
                greed: "More stocks hitting yearly highs — broad market strength.",
            },
            breadth: {
                name: "Stock Price Breadth",
                desc: "McClellan Volume Summation Index — advancing vs declining volume.",
                fear: "Falling breadth: fewer stocks participating, rally is narrow.",
                greed: "Rising breadth: rally is wide and confirmed by volume.",
            },
            pcr: {
                name: "Put/Call Options",
                desc: "Ratio of put (bearish) to call (bullish) options traded.",
                fear: "High put volume (&gt;1.0) — investors hedging against declines.",
                greed: "High call volume (&lt;0.7) — speculative bullish bets dominant.",
            },
            vix_fg: {
                name: "Market Volatility (VIX)",
                desc: "VIX (fear index) vs its 50-day moving average.",
                fear: "VIX rising sharply above 50d MA — panic buying of protection.",
                greed: "VIX well below its 50d MA — calm, low-volatility environment.",
            },
            haven: {
                name: "Safe Haven Demand",
                desc: "20-day returns: US Treasuries vs Stocks.",
                fear: "Bonds outperforming stocks — flight to safety underway.",
                greed: "Stocks strongly outperforming bonds — risk-on appetite.",
            },
            junk: {
                name: "Junk Bond Demand",
                desc: "Spread between high-yield and investment-grade bonds.",
                fear: "Wide spread — investors demand premium to hold risky debt.",
                greed: "Tight spread — investors comfortable taking credit risk.",
            },
        };

        const IND_ORDER = ["momentum", "strength", "breadth", "pcr", "vix_fg", "haven", "junk"];
        const inds = fgData.indicators || {};

        // ── Build 7 indicator cards ──────────────────────────────────────
        let cardsHtml = "";
        IND_ORDER.forEach(key => {
            let ind = inds[key];
            const meta = IND_META[key];

            // VIX fallback: estimate from raw VIX when CNN vix_fg is absent
            if (!ind && key === "vix_fg" && vixValue != null) {
                const est = Math.max(0, Math.min(100, Math.round(110 - vixValue * 2.5)));
                ind = { score: est, rating: ratingLabel(est), data: `Estimated from VIX ${vixValue.toFixed(2)}` };
            }

            if (!ind) {
                cardsHtml += `<div class="macro-card"><div class="mc-name">${meta.name}</div><div class="mc-score" style="color:#475569;">N/A</div></div>`;
                return;
            }

            const col = scoreColor(ind.score);
            // tooltip HTML stored in a hidden child — read by the floater on hover
            const tipHtml = [
                `<strong style="color:#e2e8f0;">${meta.name}</strong>`,
                `Score: <strong style="color:${col};">${ind.score}</strong> — <span style="color:${col};">${ind.rating}</span>`,
                `<span style="color:#64748b;">${meta.desc}</span>`,
                ``,
                `<span style="color:#ef4444;">🔴 Fear:&nbsp;</span>${meta.fear}`,
                `<span style="color:#22c55e;">🟢 Greed:</span> ${meta.greed}`,
                ind.data ? `<span style="color:#475569; font-size:11px;">${ind.data}</span>` : null,
                ``,
                `<span style="font-size:10px; color:#475569;">0–25 🔴 Extreme Fear &nbsp;·&nbsp; 26–45 🟠 Fear &nbsp;·&nbsp; 46–55 🟡 Neutral</span>`,
                `<span style="font-size:10px; color:#475569;">56–75 🟢 Greed &nbsp;·&nbsp; 76–100 💚 Extreme Greed</span>`,
            ].filter(l => l != null).join("<br>");

            cardsHtml += `
                <div class="macro-card macro-card-tip">
                    <div class="mc-name">${meta.name}</div>
                    <div class="mc-bar-track"><div class="mc-bar-fill" style="width:${ind.score}%; background:${col};"></div></div>
                    <div class="mc-score" style="color:${col};">${ind.score}<span class="mc-rating">${ind.rating}</span></div>
                    <div class="macro-tip-content" style="display:none;">${tipHtml}</div>
                </div>`;
        });

        // ── Historical comparison strip ──────────────────────────────────
        const histParts = [];
        if (fgData.prev_close != null) histParts.push(`Yesterday: ${fgData.prev_close}`);
        if (fgData.prev_week  != null) histParts.push(`1W ago: ${fgData.prev_week}`);
        if (fgData.prev_month != null) histParts.push(`1M ago: ${fgData.prev_month}`);
        if (fgData.prev_year  != null) histParts.push(`1Y ago: ${fgData.prev_year}`);
        const histHtml = histParts.length > 0
            ? `<div class="macro-hist">${histParts.join(" &nbsp;·&nbsp; ")}</div>`
            : "";

        const mainCol = scoreColor(fgData.score);

        body.innerHTML = `
            <div class="macro-overview">
                <div class="macro-overall">
                    <div class="macro-overall-score" style="color:${mainCol};">${fgData.score}</div>
                    <div class="macro-overall-label" style="color:${mainCol};">${fgData.rating || ratingLabel(fgData.score)}</div>
                    ${histHtml}
                </div>
                <div class="macro-grid">${cardsHtml}</div>
            </div>`;

        // ── Attach floater tooltip events ────────────────────────────────
        const floater = document.getElementById("th-tip-floater");
        if (!floater) return;

        body.querySelectorAll(".macro-card-tip").forEach(card => {
            const tipEl = card.querySelector(".macro-tip-content");
            if (!tipEl) return;

            card.addEventListener("mouseenter", () => {
                floater.innerHTML = tipEl.innerHTML;
                floater.style.display = "block";
            });
            card.addEventListener("mousemove", e => {
                const fw = floater.offsetWidth;
                const fh = floater.offsetHeight;
                let x = e.clientX + 14;
                let y = e.clientY - fh - 10;
                if (x + fw > window.innerWidth  - 8) x = e.clientX - fw - 14;
                if (y < 8)                           y = e.clientY + 14;
                floater.style.left = x + "px";
                floater.style.top  = y + "px";
            });
            card.addEventListener("mouseleave", () => {
                floater.style.display = "none";
            });
        });
    },

    // --- Settings UI ---
    showSettings() {
        document.getElementById("settings-overlay").classList.remove("hidden");
        document.getElementById("finnhub-key-input").value = getFinnhubKey();
        document.getElementById("twelve-key-input").value = getTwelveDataKey();
        document.getElementById("tickers-input").value = getTickers().join(", ");
    },

    hideSettings() {
        document.getElementById("settings-overlay").classList.add("hidden");
    },

    saveSettings() {
        const finnhubKey = document.getElementById("finnhub-key-input").value.trim();
        const twelveKey = document.getElementById("twelve-key-input").value.trim();
        const tickersRaw = document.getElementById("tickers-input").value;
        const tickers = tickersRaw.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);

        if (!finnhubKey) { alert("Please enter your Finnhub API key"); return; }
        if (!twelveKey) { alert("Please enter your Twelve Data API key"); return; }
        if (tickers.length === 0) { alert("Please enter at least one ticker"); return; }

        setFinnhubKey(finnhubKey);
        setTwelveDataKey(twelveKey);
        setTickers(tickers);
        clearCache();
        this.hideSettings();
        App.refreshData();
    },

    showLoading(message) {
        document.getElementById("setup-overlay").classList.add("hidden");
        document.getElementById("settings-overlay").classList.add("hidden");
        document.getElementById("dashboard-content").classList.add("hidden");
        document.getElementById("loading-section").classList.remove("hidden");
        document.getElementById("loading-message").textContent = message || "Loading data...";
        const progressEl = document.getElementById("loading-progress");
        progressEl.textContent = "";
        progressEl.classList.remove("text-red-400");
        const oldBtn = document.getElementById("error-actions");
        if (oldBtn) oldBtn.remove();
    },

    updateLoadingProgress(text) {
        document.getElementById("loading-progress").textContent = text;
    },

    showError(message, showChangeKey = false) {
        document.getElementById("setup-overlay").classList.add("hidden");
        document.getElementById("settings-overlay").classList.add("hidden");
        document.getElementById("dashboard-content").classList.add("hidden");
        document.getElementById("loading-section").classList.remove("hidden");
        document.getElementById("loading-message").textContent = "⚠ Error";
        const progressEl = document.getElementById("loading-progress");
        progressEl.style.whiteSpace = "pre-line";
        progressEl.textContent = message;
        progressEl.classList.add("text-red-400");

        const oldBtn = document.getElementById("error-actions");
        if (oldBtn) oldBtn.remove();

        if (showChangeKey) {
            const actionsDiv = document.createElement("div");
            actionsDiv.id = "error-actions";
            actionsDiv.className = "mt-4 flex gap-3 justify-center";
            actionsDiv.innerHTML = `
                <button class="btn-primary" onclick="UI.showSettings()" style="padding:8px 20px; font-size:14px;">🔑 Change API Keys</button>
                <button class="btn-secondary" onclick="App.refreshData()" style="padding:8px 20px; font-size:14px;">↻ Retry</button>
            `;
            document.getElementById("loading-section").appendChild(actionsDiv);
        }
    },

    // --- Initial setup screen ---
    showSetupScreen() {
        document.getElementById("setup-overlay").classList.remove("hidden");
    },

    hideSetupScreen() {
        document.getElementById("setup-overlay").classList.add("hidden");
    },

    saveInitialSetup() {
        const finnhubKey = document.getElementById("setup-finnhub-key").value.trim();
        const twelveKey = document.getElementById("setup-twelve-key").value.trim();
        if (!finnhubKey) { alert("Please enter your Finnhub API key to continue"); return; }
        if (!twelveKey) { alert("Please enter your Twelve Data API key to continue"); return; }

        setFinnhubKey(finnhubKey);
        setTwelveDataKey(twelveKey);

        const tickersRaw = document.getElementById("setup-tickers").value;
        if (tickersRaw.trim()) {
            const tickers = tickersRaw.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
            if (tickers.length > 0) setTickers(tickers);
        }
        this.hideSetupScreen();
        App.refreshData();
    },
};
