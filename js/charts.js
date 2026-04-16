// ============================================================
// CHARTS — Lightweight Charts rendering
// @version 3.1.0
// @updated 2026-03-16
// ============================================================

const Charts = {
    activeCharts: {},

    toggleChart(ticker, marketData, chartData) {
        const panel = document.getElementById(`chart-panel-${ticker}`);
        if (!panel) return;

        if (panel.classList.contains("open")) {
            panel.classList.remove("open");
            if (this.activeCharts[ticker]) {
                this.activeCharts[ticker].forEach(c => c.remove());
                delete this.activeCharts[ticker];
            }
            panel.innerHTML = "";
            return;
        }
        panel.classList.add("open");
        this.createCharts(ticker, panel, marketData, chartData);
    },

    createCharts(ticker, container, md, cd) {
        if (!cd || !cd.dates || cd.dates.length === 0) {
            container.innerHTML = '<p class="p-4 text-gray-500">No chart data available</p>';
            return;
        }

        container.innerHTML = `
            <div class="p-4">
                <div class="flex items-center gap-4 mb-3">
                    <span class="text-white font-bold text-base">${ticker}</span>
                    <span class="text-gray-400 text-sm">Last ${cd.dates.length} days</span>
                    <div class="ml-auto">
                        <button class="screenshot-btn" id="screenshot-btn-${ticker}" title="Download chart as PNG">Save PNG</button>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <div class="chart-wrap">
                        <div id="price-chart-${ticker}" style="height: 450px;"></div>
                        <div class="ohlcv-legend" id="ohlcv-legend-${ticker}"></div>
                    </div>
                    <div id="volrsi-chart-${ticker}" style="height: 130px;"></div>
                </div>
            </div>
        `;

        const charts = [];

        // --- Price Chart ---
        const priceChart = LightweightCharts.createChart(
            document.getElementById(`price-chart-${ticker}`), {
                layout: { background: { color: "#161922" }, textColor: "#9ca3af" },
                grid: { vertLines: { color: "#1e2231" }, horzLines: { color: "#1e2231" } },
                crosshair: { mode: 0 },
                rightPriceScale: { borderColor: "#2d3348" },
                timeScale: { borderColor: "#2d3348", timeVisible: false, rightOffset: 5 },
                watermark: { visible: true, text: ticker, color: "rgba(255,255,255,0.06)", fontSize: 48, horzAlign: "center", vertAlign: "center" },
            }
        );

        const candleSeries = priceChart.addCandlestickSeries({
            upColor: "#22c55e", downColor: "#ef4444",
            borderUpColor: "#22c55e", borderDownColor: "#ef4444",
            wickUpColor: "#22c55e", wickDownColor: "#ef4444",
        });
        const candleData = cd.dates.map((d, i) => ({
            time: d, open: cd.open[i], high: cd.high[i], low: cd.low[i], close: cd.close[i],
        }));
        candleSeries.setData(candleData);

        // Markers — Sweep & FVG
        const markers = [];
        const lastDate = cd.dates[cd.dates.length - 1];
        if (md.sweep === "BUY_SWP") {
            markers.push({ time: lastDate, position: "aboveBar", shape: "arrowDown", color: "#ef4444", text: "BSW" });
        } else if (md.sweep === "SELL_SWP") {
            markers.push({ time: lastDate, position: "belowBar", shape: "arrowUp", color: "#22c55e", text: "SSW" });
        }
        if (md.fvg_type === "BULL") {
            markers.push({ time: lastDate, position: "belowBar", shape: "circle", color: "#22c55e", text: "FVG" });
        } else if (md.fvg_type === "BEAR") {
            markers.push({ time: lastDate, position: "aboveBar", shape: "circle", color: "#ef4444", text: "FVG" });
        }
        if (markers.length > 0) candleSeries.setMarkers(markers);

        // EMA50
        if (cd.ema50) {
            const ema50S = priceChart.addLineSeries({ color: "#3b82f6", lineWidth: 1.5, title: "EMA50" });
            ema50S.setData(cd.dates.map((d, i) => cd.ema50[i] != null ? { time: d, value: cd.ema50[i] } : null).filter(Boolean));
        }

        // EMA200
        if (cd.ema200) {
            const ema200S = priceChart.addLineSeries({ color: "#f97316", lineWidth: 1.5, title: "EMA200" });
            ema200S.setData(cd.dates.map((d, i) => cd.ema200[i] != null ? { time: d, value: cd.ema200[i] } : null).filter(Boolean));
        }

        // AVWAP 30d
        if (cd.avwap_30d) {
            const avwapS = priceChart.addLineSeries({ color: "#a855f7", lineWidth: 1, lineStyle: 2, title: "AVWAP30d" });
            avwapS.setData(candleData.map(c => ({ time: c.time, value: cd.avwap_30d })));
        }

        // POC 14d
        if (cd.poc_14d) {
            const pocS = priceChart.addLineSeries({ color: "#6b7280", lineWidth: 1, lineStyle: 1, title: "POC14d" });
            pocS.setData(candleData.map(c => ({ time: c.time, value: cd.poc_14d })));
        }

        // Fibonacci levels
        if (md.fib_levels) {
            const fibColors = { fib_0236: "#6366f1", fib_0382: "#3b82f6", fib_0500: "#eab308", fib_0618: "#f97316", fib_0786: "#ef4444" };
            for (const [key, val] of Object.entries(md.fib_levels)) {
                if (val) {
                    const fibS = priceChart.addLineSeries({
                        color: fibColors[key] || "#6b7280", lineWidth: 1, lineStyle: 2,
                        title: key.replace("fib_0", "."),
                    });
                    fibS.setData(candleData.map(c => ({ time: c.time, value: val })));
                }
            }
        }

        // OHLCV crosshair legend
        const legendEl = document.getElementById(`ohlcv-legend-${ticker}`);
        const fmtL = (v) => v != null ? v.toFixed(2) : "-";
        const fmtVol = (v) => {
            if (!v) return "-";
            if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
            if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
            return String(v);
        };

        const showLegend = (o, h, l, c, vol) => {
            legendEl.innerHTML = `<span>O: ${fmtL(o)}</span><span>H: ${fmtL(h)}</span><span>L: ${fmtL(l)}</span><span>C: ${fmtL(c)}</span><span>Vol: ${fmtVol(vol)}</span>`;
        };

        priceChart.subscribeCrosshairMove(param => {
            if (!param.time || !param.seriesData) {
                const last = candleData[candleData.length - 1];
                showLegend(last.open, last.high, last.low, last.close, cd.volume[cd.volume.length - 1]);
                return;
            }
            const ohlc = param.seriesData.get(candleSeries);
            if (ohlc) {
                const dateIdx = cd.dates.indexOf(param.time);
                showLegend(ohlc.open, ohlc.high, ohlc.low, ohlc.close, dateIdx >= 0 ? cd.volume[dateIdx] : null);
            }
        });

        // Init legend
        const lastC = candleData[candleData.length - 1];
        showLegend(lastC.open, lastC.high, lastC.low, lastC.close, cd.volume[cd.volume.length - 1]);

        priceChart.timeScale().fitContent();
        charts.push(priceChart);

        // --- Volume + RSI Chart ---
        const volRsiChart = LightweightCharts.createChart(
            document.getElementById(`volrsi-chart-${ticker}`), {
                layout: { background: { color: "#161922" }, textColor: "#9ca3af" },
                grid: { vertLines: { color: "#1e2231" }, horzLines: { color: "#1e2231" } },
                rightPriceScale: { borderColor: "#2d3348", scaleMargins: { top: 0.05, bottom: 0.05 } },
                leftPriceScale: { visible: true, borderColor: "#2d3348", scaleMargins: { top: 0.3, bottom: 0 } },
                timeScale: { borderColor: "#2d3348", timeVisible: false, rightOffset: 5 },
            }
        );

        // Volume
        const volSeries = volRsiChart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "left" });
        volSeries.setData(cd.dates.map((d, i) => ({
            time: d, value: cd.volume[i],
            color: cd.close[i] >= cd.open[i] ? "#22c55e33" : "#ef444433",
        })));

        // RSI
        const rsiPoints = cd.dates.map((d, i) => cd.rsi && cd.rsi[i] != null ? { time: d, value: cd.rsi[i] } : null).filter(Boolean);
        const rsiSeries = volRsiChart.addLineSeries({ color: "#a855f7", lineWidth: 2, title: "RSI", priceScaleId: "right" });
        if (rsiPoints.length > 0) rsiSeries.setData(rsiPoints);

        // RSI reference lines
        const refDates = rsiPoints.length > 0 ? rsiPoints : candleData;
        const ob = volRsiChart.addLineSeries({ color: "#ef444466", lineWidth: 1, lineStyle: 2, priceScaleId: "right" });
        ob.setData(refDates.map(p => ({ time: p.time, value: 70 })));
        const os2 = volRsiChart.addLineSeries({ color: "#22c55e66", lineWidth: 1, lineStyle: 2, priceScaleId: "right" });
        os2.setData(refDates.map(p => ({ time: p.time, value: 30 })));

        // Anchor RSI 0-100
        const anchor = volRsiChart.addLineSeries({ color: "transparent", lineWidth: 0, visible: false, priceScaleId: "right" });
        if (refDates.length >= 2) {
            anchor.setData([
                { time: refDates[0].time, value: 0 },
                { time: refDates[refDates.length - 1].time, value: 100 },
            ]);
        }

        volRsiChart.timeScale().fitContent();
        charts.push(volRsiChart);

        // Sync time scales
        priceChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range) volRsiChart.timeScale().setVisibleLogicalRange(range);
        });

        // Screenshot
        document.getElementById(`screenshot-btn-${ticker}`).addEventListener("click", (e) => {
            e.stopPropagation();
            const canvas = priceChart.takeScreenshot();
            const link = document.createElement("a");
            link.download = `${ticker}_chart_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });

        this.activeCharts[ticker] = charts;
    },
};