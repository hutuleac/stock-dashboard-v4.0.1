// ============================================================
// TECHNICALS — All technical indicator calculations (pure JS)
// @version 3.1.0
// @updated 2026-03-16
// ============================================================

const Technicals = {
    calcRSI(closes, period) {
        period = period || CONFIG.RSI_PERIOD;
        if (closes.length < period + 1) return null;
        const deltas = [];
        for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1]);
        let gainSum = 0, lossSum = 0;
        for (let i = 0; i < period; i++) { if (deltas[i] > 0) gainSum += deltas[i]; else lossSum -= deltas[i]; }
        let avgGain = gainSum / period, avgLoss = lossSum / period;
        for (let i = period; i < deltas.length; i++) { const d = deltas[i]; avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period; avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period; }
        if (avgLoss === 0) return 100;
        return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
    },
    calcRSISeries(closes, period) {
        period = period || CONFIG.RSI_PERIOD;
        const result = new Array(closes.length).fill(null);
        if (closes.length < period + 1) return result;
        const deltas = [];
        for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1]);
        let gainSum = 0, lossSum = 0;
        for (let i = 0; i < period; i++) { if (deltas[i] > 0) gainSum += deltas[i]; else lossSum -= deltas[i]; }
        let avgGain = gainSum / period, avgLoss = lossSum / period;
        result[period] = avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
        for (let i = period; i < deltas.length; i++) { const d = deltas[i]; avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period; avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period; result[i + 1] = avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100; }
        return result;
    },
    calcATR(highs, lows, closes, period) {
        period = period || CONFIG.ATR_PERIOD;
        if (closes.length < period + 1) return { atr: null, atr_pct: null };
        const trs = [];
        for (let i = 1; i < closes.length; i++) { const hl = highs[i] - lows[i], hc = Math.abs(highs[i] - closes[i - 1]), lc = Math.abs(lows[i] - closes[i - 1]); trs.push(Math.max(hl, hc, lc)); }
        let sum = 0; for (let i = trs.length - period; i < trs.length; i++) sum += trs[i];
        const atr = sum / period, price = closes[closes.length - 1], atr_pct = price > 0 ? (atr / price) * 100 : 0;
        return { atr: Math.round(atr * 10000) / 10000, atr_pct: Math.round(atr_pct * 100) / 100 };
    },
    calcEMASeries(values, period) {
        const result = new Array(values.length).fill(null);
        if (values.length < period) return result;
        const k = 2 / (period + 1);
        let sum = 0; for (let i = 0; i < period; i++) sum += values[i];
        result[period - 1] = sum / period;
        for (let i = period; i < values.length; i++) result[i] = values[i] * k + result[i - 1] * (1 - k);
        return result;
    },
    calcEMA(values, period) {
        const series = this.calcEMASeries(values, period);
        for (let i = series.length - 1; i >= 0; i--) if (series[i] !== null) return Math.round(series[i] * 100) / 100;
        return null;
    },
    calcTrend(closes, ema50Series, ema200Series) {
        const price = closes[closes.length - 1], e50 = ema50Series[ema50Series.length - 1], e200 = ema200Series[ema200Series.length - 1];
        if (e50 === null || e200 === null) return "Neutral";
        if (price > e200 && e50 > e200) return "Bullish";
        if (price < e200 && e50 < e200) return "Bearish";
        return "Neutral";
    },
    calcAVWAP(closes, volumes, window) {
        const len = closes.length, w = Math.min(window, len);
        let totalVol = 0, totalPV = 0;
        for (let i = len - w; i < len; i++) { totalVol += volumes[i]; totalPV += closes[i] * volumes[i]; }
        if (totalVol === 0) return closes[len - 1];
        return Math.round((totalPV / totalVol) * 10000) / 10000;
    },
    calcPOC(closes, volumes, window, nBins) {
        nBins = nBins || CONFIG.POC_BINS;
        const len = closes.length, w = Math.min(window, len), startIdx = len - w;
        const sliceC = closes.slice(startIdx), sliceV = volumes.slice(startIdx);
        let minP = Infinity, maxP = -Infinity;
        for (const p of sliceC) { if (p < minP) minP = p; if (p > maxP) maxP = p; }
        if (minP === maxP) return Math.round(minP * 10000) / 10000;
        const binSize = (maxP - minP) / nBins, binVolumes = new Array(nBins).fill(0);
        for (let i = 0; i < sliceC.length; i++) { let bin = Math.floor((sliceC[i] - minP) / binSize); if (bin >= nBins) bin = nBins - 1; binVolumes[bin] += sliceV[i]; }
        let maxBin = 0; for (let i = 1; i < nBins; i++) if (binVolumes[i] > binVolumes[maxBin]) maxBin = i;
        return Math.round((minP + (maxBin + 0.5) * binSize) * 10000) / 10000;
    },
    calcADX(highs, lows, closes, period) {
        period = period || CONFIG.ADX_PERIOD;
        if (closes.length < period * 2) return null;
        const k = 2 / (period + 1), len = closes.length;
        const plusDM = [0], minusDM = [0], tr = [0];
        for (let i = 1; i < len; i++) {
            const upMove = highs[i] - highs[i-1], downMove = lows[i-1] - lows[i];
            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
            const hl = highs[i]-lows[i], hc = Math.abs(highs[i]-closes[i-1]), lc = Math.abs(lows[i]-closes[i-1]);
            tr.push(Math.max(hl,hc,lc));
        }
        const smoothEMA = arr => { const out = [arr[0]]; for (let i=1;i<arr.length;i++) out.push(arr[i]*k+out[i-1]*(1-k)); return out; };
        const atrSmooth=smoothEMA(tr), plusDISmooth=smoothEMA(plusDM), minusDISmooth=smoothEMA(minusDM);
        const dx=[];
        for (let i=0;i<len;i++) { if(atrSmooth[i]===0){dx.push(0);continue;} const pdi=100*plusDISmooth[i]/atrSmooth[i],mdi=100*minusDISmooth[i]/atrSmooth[i],sum=pdi+mdi; dx.push(sum===0?0:(Math.abs(pdi-mdi)/sum)*100); }
        const adxSmooth=smoothEMA(dx);
        return Math.round(adxSmooth[adxSmooth.length-1]*100)/100;
    },
    calcBBBandwidth(closes, period, std) {
        period=period||CONFIG.BB_PERIOD; std=std||CONFIG.BB_STD;
        if(closes.length<period) return null;
        const slice=closes.slice(-period); let sum=0; for(const v of slice) sum+=v;
        const sma=sum/period; let sqSum=0; for(const v of slice) sqSum+=(v-sma)**2;
        const stdDev=Math.sqrt(sqSum/period), upper=sma+std*stdDev, lower=sma-std*stdDev;
        if(sma===0) return 0;
        return Math.round(((upper-lower)/sma)*10000)/100;
    },
    calcFibonacci(highs, lows, closes, window) {
        window=window||CONFIG.FIB_WINDOW;
        const len=highs.length, w=Math.min(window,len), startIdx=len-w;
        let swingHigh=-Infinity, swingLow=Infinity;
        for(let i=startIdx;i<len;i++){if(highs[i]>swingHigh)swingHigh=highs[i];if(lows[i]<swingLow)swingLow=lows[i];}
        const rng=swingHigh-swingLow, price=closes[len-1], levels={};
        for(const lvl of CONFIG.FIB_LEVELS){const key="fib_"+String(lvl).replace(".","");levels[key]=Math.round((swingHigh-lvl*rng)*10000)/10000;}
        let position;
        if(rng===0){position="NEUTRAL";}else{const ratio=(price-swingLow)/rng;if(ratio>0.786)position="ABOVE_786";else if(ratio>0.618)position="BETWEEN_618_786";else if(ratio>0.382)position="BETWEEN_382_618";else if(ratio>0.236)position="BETWEEN_236_382";else position="BELOW_236";}
        return{swing_high:Math.round(swingHigh*10000)/10000,swing_low:Math.round(swingLow*10000)/10000,levels,price_position:position};
    },
    calcRSvsSPY(stockCloses, spyCloses, window) {
        window=window||CONFIG.RS_WINDOW;
        if(stockCloses.length<window||spyCloses.length<window) return null;
        const sLen=stockCloses.length, bLen=spyCloses.length;
        const stockRet=stockCloses[sLen-1]/stockCloses[sLen-window], spyRet=spyCloses[bLen-1]/spyCloses[bLen-window];
        if(spyRet===0) return null;
        return Math.round((stockRet/spyRet)*10000)/10000;
    },
    calcVolumeRatio(volumes, avgWindow) {
        avgWindow=avgWindow||20; const len=volumes.length;
        if(len<avgWindow) return null;
        let sum=0; for(let i=len-avgWindow;i<len;i++) sum+=volumes[i];
        const avg=sum/avgWindow;
        if(avg===0) return 0;
        return Math.round((volumes[len-1]/avg)*100)/100;
    },
    calc52WPosition(price, high52w, low52w) {
        if(high52w==null||low52w==null||high52w===low52w) return null;
        return Math.round(((price-low52w)/(high52w-low52w))*10000)/100;
    },
    calcPctBelowATH(price, high52w) {
        if(high52w==null||high52w===0) return null;
        return Math.round((1-price/high52w)*10000)/100;
    },
    calcMACD(closes, fast, slow, signalPeriod) {
        fast=fast||CONFIG.MACD_FAST; slow=slow||CONFIG.MACD_SLOW; signalPeriod=signalPeriod||CONFIG.MACD_SIGNAL;
        if(closes.length<slow+signalPeriod) return{macd:null,signal:null,hist:null,crossover:null};
        const ema12=this.calcEMASeries(closes,fast), ema26=this.calcEMASeries(closes,slow);
        const macdLine=closes.map((_,i)=>(ema12[i]!==null&&ema26[i]!==null)?ema12[i]-ema26[i]:null);
        const firstValid=macdLine.findIndex(v=>v!==null), signalLine=new Array(closes.length).fill(null);
        if(firstValid>=0){const macdValues=macdLine.slice(firstValid),sigSeries=this.calcEMASeries(macdValues,signalPeriod);for(let i=0;i<sigSeries.length;i++)signalLine[firstValid+i]=sigSeries[i];}
        const len=closes.length, lastMacd=macdLine[len-1], lastSig=signalLine[len-1], prevMacd=macdLine[len-2], prevSig=signalLine[len-2];
        let crossover=null;
        if(lastMacd!==null&&lastSig!==null&&prevMacd!==null&&prevSig!==null){if(prevMacd<=prevSig&&lastMacd>lastSig)crossover="BULL";else if(prevMacd>=prevSig&&lastMacd<lastSig)crossover="BEAR";}
        const hist=(lastMacd!==null&&lastSig!==null)?lastMacd-lastSig:null;
        return{macd:lastMacd!==null?Math.round(lastMacd*1000)/1000:null,signal:lastSig!==null?Math.round(lastSig*1000)/1000:null,hist:hist!==null?Math.round(hist*1000)/1000:null,crossover};
    },
    calcOBV(closes, volumes) {
        if(closes.length<2) return{obv_current:null,obv_trend:null};
        let obv=0; const obvSeries=[0];
        for(let i=1;i<closes.length;i++){if(closes[i]>closes[i-1])obv+=volumes[i];else if(closes[i]<closes[i-1])obv-=volumes[i];obvSeries.push(obv);}
        const len=obvSeries.length, w5=Math.min(5,len), w20=Math.min(20,len);
        let sum5=0, sum20=0;
        for(let i=len-w5;i<len;i++) sum5+=obvSeries[i];
        for(let i=len-w20;i<len;i++) sum20+=obvSeries[i];
        const avg5=sum5/w5, avg20=sum20/w20;
        const trend=avg5>avg20*1.01?"UP":avg5<avg20*0.99?"DOWN":"FLAT";
        return{obv_current:Math.round(obv),obv_trend:trend};
    },
    calcPivots(highs, lows, closes) {
        const len=closes.length;
        if(len<2) return{pivot:null,r1:null,s1:null};
        const H=highs[len-2], L=lows[len-2], C=closes[len-2];
        const pivot=(H+L+C)/3, r1=2*pivot-L, s1=2*pivot-H;
        return{pivot:Math.round(pivot*100)/100,r1:Math.round(r1*100)/100,s1:Math.round(s1*100)/100};
    },
};
