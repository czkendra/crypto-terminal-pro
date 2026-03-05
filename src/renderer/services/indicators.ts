import { Candle, IndicatorSnapshot, ChartPattern, QuantScore } from '../store/types'

// ─── Basic Math Helpers ─────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = 0
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
      result.push(prev)
      continue
    }
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function sma(values: number[], period: number): number[] {
  return values.map((_, i) => {
    if (i < period - 1) return NaN
    return values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}

function stdDev(values: number[], period: number): number[] {
  const means = sma(values, period)
  return values.map((_, i) => {
    if (isNaN(means[i])) return NaN
    const slice = values.slice(i - period + 1, i + 1)
    const mean = means[i]
    return Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period)
  })
}

function rsiCalc(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return result
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain += diff > 0 ? diff : 0
    avgLoss += diff < 0 ? -diff : 0
  }
  avgGain /= period
  avgLoss /= period
  result[period] = 100 - 100 / (1 + avgGain / (avgLoss || 0.0001))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
    result[i] = 100 - 100 / (1 + avgGain / (avgLoss || 0.0001))
  }
  return result
}

function macdCalc(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = closes.map((_, i) => {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) return NaN
    return emaFast[i] - emaSlow[i]
  })
  const validMacd = macdLine.filter((v) => !isNaN(v))
  const rawSignal = ema(validMacd, signal)
  const offset = macdLine.findIndex((v) => !isNaN(v))
  const signalLine = macdLine.map((_, i) => {
    const si = i - offset
    return si >= 0 && si < rawSignal.length ? rawSignal[si] : NaN
  })
  const hist = macdLine.map((v, i) => (isNaN(v) || isNaN(signalLine[i])) ? NaN : v - signalLine[i])
  return { macdLine, signalLine, hist }
}

function bollingerBands(closes: number[], period = 20, multiplier = 2) {
  const mid = sma(closes, period)
  return closes.map((_, i) => {
    if (isNaN(mid[i])) return { upper: NaN, mid: NaN, lower: NaN }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = mid[i]
    const std = Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period)
    return { upper: mean + multiplier * std, mid: mean, lower: mean - multiplier * std }
  })
}

function atrCalc(candles: Candle[], period = 14): number[] {
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const prev = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev))
  })
  return sma(trs, period)
}

function vwapCalc(candles: Candle[]): number[] {
  const SESSION = 96
  let cumPV = 0, cumVol = 0
  return candles.map((c, i) => {
    if (i % SESSION === 0) { cumPV = 0; cumVol = 0 }
    const typical = (c.high + c.low + c.close) / 3
    cumPV += typical * c.volume
    cumVol += c.volume
    return cumVol > 0 ? cumPV / cumVol : typical
  })
}

function obvCalc(candles: Candle[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close
    result.push(result[i - 1] + (diff > 0 ? candles[i].volume : diff < 0 ? -candles[i].volume : 0))
  }
  return result
}

function slope(values: number[], n: number): number {
  if (values.length < n) return 0
  const slice = values.slice(-n)
  return (slice[slice.length - 1] - slice[0]) / n
}

function pivotHighsLows(candles: Candle[], price: number, lookback = 60) {
  const highs = candles.slice(-lookback).map((c) => c.high)
  const lows = candles.slice(-lookback).map((c) => c.low)
  const pivotHighs: number[] = []
  const pivotLows: number[] = []
  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
      pivotHighs.push(highs[i])
    }
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
      pivotLows.push(lows[i])
    }
  }
  const support = pivotLows.filter((v) => v < price).sort((a, b) => b - a)[0] || price * 0.97
  const resistance = pivotHighs.filter((v) => v > price).sort((a, b) => a - b)[0] || price * 1.03
  return { support, resistance, pivotHighs, pivotLows }
}

// ─── Advanced Indicators ────────────────────────────────────────────────────

/** Stochastic RSI: K and D lines (both 0-100) */
function stochasticRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3): { k: number; d: number } {
  const rsiArr = rsiCalc(closes, rsiPeriod)
  const validRsi = rsiArr.filter((v) => !isNaN(v))
  if (validRsi.length < stochPeriod + kPeriod + dPeriod) return { k: 50, d: 50 }

  const stochK: number[] = []
  for (let i = stochPeriod - 1; i < validRsi.length; i++) {
    const slice = validRsi.slice(i - stochPeriod + 1, i + 1)
    const minR = Math.min(...slice)
    const maxR = Math.max(...slice)
    stochK.push(maxR === minR ? 50 : ((validRsi[i] - minR) / (maxR - minR)) * 100)
  }

  // Smooth K
  const smoothK = sma(stochK, kPeriod)
  const smoothD = sma(smoothK.filter((v) => !isNaN(v)), dPeriod)

  const lastK = smoothK.filter((v) => !isNaN(v)).pop() ?? 50
  const lastD = smoothD.filter((v) => !isNaN(v)).pop() ?? 50
  return { k: lastK, d: lastD }
}

/** ADX / DMI */
function adxDmi(candles: Candle[], period = 14): { adx: number; diPlus: number; diMinus: number } {
  if (candles.length < period * 2) return { adx: 0, diPlus: 0, diMinus: 0 }

  const trs: number[] = []
  const plusDMs: number[] = []
  const minusDMs: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]
    const tr = Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close))
    trs.push(tr)

    const upMove = curr.high - prev.high
    const downMove = prev.low - curr.low
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  // Wilder smoothing
  function wilderSmooth(arr: number[], p: number): number[] {
    const result: number[] = new Array(arr.length).fill(NaN)
    let sum = arr.slice(0, p).reduce((a, b) => a + b, 0)
    result[p - 1] = sum
    for (let i = p; i < arr.length; i++) {
      sum = sum - sum / p + arr[i]
      result[i] = sum
    }
    return result
  }

  const atrW = wilderSmooth(trs, period)
  const plusDMW = wilderSmooth(plusDMs, period)
  const minusDMW = wilderSmooth(minusDMs, period)

  const diPlusArr: number[] = atrW.map((atrv, i) => (atrv > 0 ? (plusDMW[i] / atrv) * 100 : 0))
  const diMinusArr: number[] = atrW.map((atrv, i) => (atrv > 0 ? (minusDMW[i] / atrv) * 100 : 0))
  const dxArr: number[] = diPlusArr.map((dp, i) => {
    const dm = diMinusArr[i]
    const sum = dp + dm
    return sum > 0 ? (Math.abs(dp - dm) / sum) * 100 : 0
  })

  const adxArr = wilderSmooth(dxArr.filter((v) => !isNaN(v)), period)
  const n = candles.length - 1
  const idx = n - 1  // offset by 1 since trs has one fewer element

  return {
    adx: adxArr[adxArr.length - 1] ?? 0,
    diPlus: diPlusArr[idx] ?? 0,
    diMinus: diMinusArr[idx] ?? 0
  }
}

/** Williams %R */
function williamsRCalc(candles: Candle[], period = 14): number {
  if (candles.length < period) return -50
  const slice = candles.slice(-period)
  const highestHigh = Math.max(...slice.map((c) => c.high))
  const lowestLow = Math.min(...slice.map((c) => c.low))
  const close = slice[slice.length - 1].close
  if (highestHigh === lowestLow) return -50
  return ((highestHigh - close) / (highestHigh - lowestLow)) * -100
}

/** Chaikin Money Flow */
function cmfCalc(candles: Candle[], period = 20): number {
  if (candles.length < period) return 0
  const slice = candles.slice(-period)
  let sumMFV = 0, sumVol = 0
  for (const c of slice) {
    const range = c.high - c.low
    if (range === 0) continue
    const mfm = ((c.close - c.low) - (c.high - c.close)) / range
    sumMFV += mfm * c.volume
    sumVol += c.volume
  }
  return sumVol > 0 ? sumMFV / sumVol : 0
}

/** Supertrend */
function supertrendCalc(candles: Candle[], period = 10, multiplier = 3): { value: number; bullish: boolean } {
  if (candles.length < period + 1) return { value: candles[candles.length - 1].close, bullish: true }

  const atrArr = atrCalc(candles, period)
  let upperBand = 0, lowerBand = 0
  let trend = 1  // 1 = bullish, -1 = bearish
  let prevSupertrend = candles[0].close

  for (let i = period; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2
    const atrv = atrArr[i] || candles[i].high - candles[i].low
    const basicUpper = hl2 + multiplier * atrv
    const basicLower = hl2 - multiplier * atrv

    upperBand = basicUpper < upperBand || candles[i - 1].close > upperBand ? basicUpper : upperBand
    lowerBand = basicLower > lowerBand || candles[i - 1].close < lowerBand ? basicLower : lowerBand

    if (trend === -1 && candles[i].close > upperBand) trend = 1
    else if (trend === 1 && candles[i].close < lowerBand) trend = -1

    prevSupertrend = trend === 1 ? lowerBand : upperBand
  }

  return { value: prevSupertrend, bullish: trend === 1 }
}

/** Ichimoku Cloud */
function ichimokuCalc(candles: Candle[]) {
  function midpoint(arr: Candle[], start: number, end: number): number {
    const slice = arr.slice(start, end)
    if (slice.length === 0) return 0
    return (Math.max(...slice.map((c) => c.high)) + Math.min(...slice.map((c) => c.low))) / 2
  }

  const n = candles.length
  const tenkan = midpoint(candles, Math.max(0, n - 9), n)
  const kijun = midpoint(candles, Math.max(0, n - 26), n)
  const senkouA = (tenkan + kijun) / 2
  const senkouB = midpoint(candles, Math.max(0, n - 52), n)
  const price = candles[n - 1].close
  const cloudBull = price > Math.max(senkouA, senkouB)

  return { tenkan, kijun, senkouA, senkouB, cloudBull }
}

/** Daily Pivot Points (standard formula) */
function pivotPoints(candles: Candle[]) {
  // Use last completed daily candle (last 24h of data)
  const last = candles[candles.length - 1]
  const H = candles.slice(-24).reduce((max, c) => Math.max(max, c.high), 0)
  const L = candles.slice(-24).reduce((min, c) => Math.min(min, c.low), Infinity)
  const C = last.close

  const PP = (H + L + C) / 3
  const R1 = 2 * PP - L
  const S1 = 2 * PP - H
  const R2 = PP + (H - L)
  const S2 = PP - (H - L)
  const R3 = H + 2 * (PP - L)
  const S3 = L - 2 * (H - PP)

  return { PP, R1, R2, R3, S1, S2, S3 }
}

// ─── Quantitative Analytics ─────────────────────────────────────────────────

function computeQuantScore(candles: Candle[], closes: number[], atrArr: number[]): QuantScore {
  const n = candles.length - 1
  const price = closes[n]

  // Z-Score: how many std devs from 50-bar SMA
  const sma50 = sma(closes, 50)
  const std50 = stdDev(closes, 50)
  const zScore = (sma50[n] > 0 && std50[n] > 0)
    ? (price - sma50[n]) / std50[n]
    : 0

  // Momentum Factor: price change over 1, 5, 20 bars normalized
  const mom1  = n >= 1  ? (closes[n] - closes[n - 1])  / closes[n - 1]  : 0
  const mom5  = n >= 5  ? (closes[n] - closes[n - 5])  / closes[n - 5]  : 0
  const mom20 = n >= 20 ? (closes[n] - closes[n - 20]) / closes[n - 20] : 0
  const momentumFactor = Math.max(-1, Math.min(1, (mom1 * 0.5 + mom5 * 0.3 + mom20 * 0.2) * 10))

  // Volatility Regime: compare current ATR% vs 50-bar avg ATR%
  const atrPct = atrArr[n] > 0 ? (atrArr[n] / price) * 100 : 1
  const atrSma50 = sma(atrArr.map((a, i) => (a > 0 && closes[i] > 0) ? (a / closes[i]) * 100 : NaN).filter((v) => !isNaN(v)), 20)
  const avgAtrPct = atrSma50[atrSma50.length - 1] ?? 1
  const volRatio = atrPct / avgAtrPct
  const volatilityRegime: QuantScore['volatilityRegime'] =
    volRatio > 2.5 ? 'extreme' : volRatio > 1.5 ? 'high' : volRatio < 0.5 ? 'low' : 'normal'

  // Trend Strength via linear regression R² over last 20 bars
  const recentCloses = closes.slice(-20)
  const xMean = 9.5
  const yMean = recentCloses.reduce((a, b) => a + b, 0) / 20
  let ssxy = 0, ssx = 0, ssy = 0
  for (let i = 0; i < 20; i++) {
    ssxy += (i - xMean) * (recentCloses[i] - yMean)
    ssx += (i - xMean) ** 2
    ssy += (recentCloses[i] - yMean) ** 2
  }
  const r2 = ssx > 0 && ssy > 0 ? (ssxy / Math.sqrt(ssx * ssy)) ** 2 : 0
  const trendStrength = Math.round(r2 * 100)

  // Mean Reversion Probability: higher if price is extreme (z-score far from 0)
  const absZ = Math.abs(zScore)
  const meanReversionProb = Math.min(95, Math.round(
    absZ > 3 ? 85 : absZ > 2 ? 70 : absZ > 1.5 ? 55 : absZ > 1 ? 40 : 25
  ))

  // Breakout Probability: based on BB squeeze + volume surge
  const bb = bollingerBands(closes, 20)
  const lastBB = bb[n]
  const bbWidthNow = lastBB.mid > 0 ? (lastBB.upper - lastBB.lower) / lastBB.mid : 0
  const bbWidths = bb.slice(Math.max(0, n - 20), n).map((b) => (b.mid > 0 ? (b.upper - b.lower) / b.mid : 0)).filter((v) => v > 0)
  const avgBBWidth = bbWidths.length > 0 ? bbWidths.reduce((a, b) => a + b, 0) / bbWidths.length : 0.02
  const isSqueeze = bbWidthNow < avgBBWidth * 0.7
  const vols = candles.map((c) => c.volume)
  const avgVol20 = vols.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volSurge = candles[n].volume / (avgVol20 || 1)
  const breakoutProb = Math.min(90, Math.round(
    (isSqueeze ? 40 : 20) + (volSurge > 2 ? 30 : volSurge > 1.5 ? 15 : 0) + (trendStrength > 70 ? 20 : 0)
  ))

  return { zScore, momentumFactor, volatilityRegime, trendStrength, meanReversionProb, breakoutProb }
}

// ─── Chart Pattern Detection ────────────────────────────────────────────────

function detectChartPatterns(candles: Candle[], price: number): ChartPattern[] {
  const patterns: ChartPattern[] = []
  if (candles.length < 40) return patterns

  const highs = candles.map((c) => c.high)
  const lows  = candles.map((c) => c.low)
  const closes = candles.map((c) => c.close)
  const n = candles.length - 1

  // Find local peaks and troughs (window of 5)
  const peaks: Array<{ idx: number; price: number }> = []
  const troughs: Array<{ idx: number; price: number }> = []
  for (let i = 5; i < candles.length - 5; i++) {
    const h = highs[i]
    if (h > highs[i-1] && h > highs[i-2] && h > highs[i+1] && h > highs[i+2]) {
      peaks.push({ idx: i, price: h })
    }
    const l = lows[i]
    if (l < lows[i-1] && l < lows[i-2] && l < lows[i+1] && l < lows[i+2]) {
      troughs.push({ idx: i, price: l })
    }
  }

  // --- Double Top ---
  if (peaks.length >= 2) {
    const lastTwo = peaks.slice(-2)
    const [p1, p2] = lastTwo
    const priceMatch = Math.abs(p1.price - p2.price) / p1.price < 0.015
    const gapOk = p2.idx - p1.idx >= 5
    const recent = n - p2.idx < 20
    if (priceMatch && gapOk && recent && price < p2.price * 0.998) {
      const confidence = Math.round(70 + (1 - Math.abs(p1.price - p2.price) / p1.price / 0.015) * 20)
      patterns.push({
        type: 'double_top',
        direction: 'SHORT',
        confidence: Math.min(95, confidence),
        description: `Double Top at ${p1.price.toFixed(2)} / ${p2.price.toFixed(2)} — bearish reversal`,
        targetMove: -((p1.price - (Math.min(...lows.slice(p1.idx, p2.idx)))) / p1.price) * 100,
        neckline: Math.min(...lows.slice(p1.idx, p2.idx))
      })
    }
  }

  // --- Double Bottom ---
  if (troughs.length >= 2) {
    const lastTwo = troughs.slice(-2)
    const [t1, t2] = lastTwo
    const priceMatch = Math.abs(t1.price - t2.price) / t1.price < 0.015
    const gapOk = t2.idx - t1.idx >= 5
    const recent = n - t2.idx < 20
    if (priceMatch && gapOk && recent && price > t2.price * 1.002) {
      const confidence = Math.round(70 + (1 - Math.abs(t1.price - t2.price) / t1.price / 0.015) * 20)
      patterns.push({
        type: 'double_bottom',
        direction: 'LONG',
        confidence: Math.min(95, confidence),
        description: `Double Bottom at ${t1.price.toFixed(2)} / ${t2.price.toFixed(2)} — bullish reversal`,
        targetMove: ((Math.max(...highs.slice(t1.idx, t2.idx)) - t1.price) / t1.price) * 100,
        neckline: Math.max(...highs.slice(t1.idx, t2.idx))
      })
    }
  }

  // --- Head & Shoulders ---
  if (peaks.length >= 3) {
    const [left, head, right] = peaks.slice(-3)
    const headHighest = head.price > left.price && head.price > right.price
    const shouldersMatch = Math.abs(left.price - right.price) / left.price < 0.03
    const recent = n - right.idx < 15
    if (headHighest && shouldersMatch && recent && price < right.price) {
      const neckline = Math.min(
        Math.min(...lows.slice(left.idx, head.idx)),
        Math.min(...lows.slice(head.idx, right.idx))
      )
      patterns.push({
        type: 'head_shoulders',
        direction: 'SHORT',
        confidence: 78,
        description: `Head & Shoulders — Head ${head.price.toFixed(2)}, Shoulders ~${((left.price + right.price) / 2).toFixed(2)}, Neckline ${neckline.toFixed(2)}`,
        targetMove: -((head.price - neckline) / head.price) * 100,
        neckline
      })
    }
  }

  // --- Inverse H&S ---
  if (troughs.length >= 3) {
    const [left, head, right] = troughs.slice(-3)
    const headLowest = head.price < left.price && head.price < right.price
    const shouldersMatch = Math.abs(left.price - right.price) / left.price < 0.03
    const recent = n - right.idx < 15
    if (headLowest && shouldersMatch && recent && price > right.price) {
      const neckline = Math.max(
        Math.max(...highs.slice(left.idx, head.idx)),
        Math.max(...highs.slice(head.idx, right.idx))
      )
      patterns.push({
        type: 'inv_head_shoulders',
        direction: 'LONG',
        confidence: 78,
        description: `Inv Head & Shoulders — Head ${head.price.toFixed(2)}, Neckline ${neckline.toFixed(2)}`,
        targetMove: ((neckline - head.price) / head.price) * 100,
        neckline
      })
    }
  }

  // --- Bull Flag ---
  const recentClose30 = closes.slice(-30)
  const flagPole = closes.slice(-30, -15)
  if (flagPole.length > 0) {
    const poleGain = (flagPole[flagPole.length - 1] - flagPole[0]) / flagPole[0]
    const recentLow = Math.min(...closes.slice(-15))
    const recentHigh = Math.max(...closes.slice(-15))
    const consolidation = (recentHigh - recentLow) / recentHigh
    if (poleGain > 0.04 && consolidation < 0.025) {
      patterns.push({
        type: 'bull_flag',
        direction: 'LONG',
        confidence: 72,
        description: `Bull Flag — Pole +${(poleGain*100).toFixed(1)}%, consolidating ${(consolidation*100).toFixed(1)}%`,
        targetMove: poleGain * 100 * 0.8
      })
    }
  }

  // --- Bear Flag ---
  const poleDown = closes.slice(-30, -15)
  if (poleDown.length > 0) {
    const poleDrop = (poleDown[0] - poleDown[poleDown.length - 1]) / poleDown[0]
    const recentLowB = Math.min(...closes.slice(-15))
    const recentHighB = Math.max(...closes.slice(-15))
    const consolidationB = (recentHighB - recentLowB) / recentHighB
    if (poleDrop > 0.04 && consolidationB < 0.025) {
      patterns.push({
        type: 'bear_flag',
        direction: 'SHORT',
        confidence: 72,
        description: `Bear Flag — Pole -${(poleDrop*100).toFixed(1)}%, consolidating ${(consolidationB*100).toFixed(1)}%`,
        targetMove: -poleDrop * 100 * 0.8
      })
    }
  }

  // --- Ascending Triangle ---
  if (peaks.length >= 2 && troughs.length >= 2) {
    const peakSlope = peaks.length >= 3
      ? (peaks[peaks.length-1].price - peaks[peaks.length-3].price) / (peaks[peaks.length-1].idx - peaks[peaks.length-3].idx)
      : Infinity
    const troughSlope = troughs.length >= 3
      ? (troughs[troughs.length-1].price - troughs[troughs.length-3].price) / (troughs[troughs.length-1].idx - troughs[troughs.length-3].idx)
      : -Infinity

    if (Math.abs(peakSlope) < 0.01 && troughSlope > 0.01) {
      patterns.push({
        type: 'ascending_triangle',
        direction: 'LONG',
        confidence: 68,
        description: `Ascending Triangle — flat resistance at ~${peaks[peaks.length-1].price.toFixed(2)}, rising support`,
        targetMove: 5
      })
    }
    if (Math.abs(troughSlope) < 0.01 && peakSlope < -0.01) {
      patterns.push({
        type: 'descending_triangle',
        direction: 'SHORT',
        confidence: 68,
        description: `Descending Triangle — flat support, declining resistance`,
        targetMove: -5
      })
    }
  }

  // --- Rising Wedge (bearish) ---
  if (peaks.length >= 2 && troughs.length >= 2) {
    const p1 = peaks.slice(-2)[0], p2 = peaks.slice(-1)[0]
    const t1 = troughs.slice(-2)[0], t2 = troughs.slice(-1)[0]
    const peakGain  = (p2.price - p1.price) / p1.price
    const troughGain = (t2.price - t1.price) / t1.price
    // Both rising but peaks rising slower than troughs = converging upward
    if (peakGain > 0 && troughGain > 0 && troughGain > peakGain * 1.3) {
      patterns.push({
        type: 'rising_wedge',
        direction: 'SHORT',
        confidence: 65,
        description: `Rising Wedge — converging upward, bearish breakout likely`,
        targetMove: -4
      })
    }
    // Falling wedge (bullish)
    if (peakGain < 0 && troughGain < 0 && peakGain < troughGain * 1.3) {
      patterns.push({
        type: 'falling_wedge',
        direction: 'LONG',
        confidence: 65,
        description: `Falling Wedge — converging downward, bullish breakout likely`,
        targetMove: 4
      })
    }
  }

  // Sort by confidence descending
  return patterns.sort((a, b) => b.confidence - a.confidence)
}

// ─── Win Rate Estimates (historical back-tested averages for common setups) ──

const WIN_RATES: Record<string, number> = {
  double_bottom: 71,
  inv_head_shoulders: 74,
  bull_flag: 68,
  ascending_triangle: 66,
  falling_wedge: 65,
  double_top: 69,
  head_shoulders: 73,
  bear_flag: 68,
  descending_triangle: 65,
  rising_wedge: 63,
  symmetrical_triangle: 60,
  cup_handle: 72,
  bull_pennant: 66,
  bear_pennant: 65
}

function getWinRateEstimate(patterns: ChartPattern[], score: number): number {
  if (patterns.length > 0) {
    return WIN_RATES[patterns[0].type] ?? 55
  }
  // Fallback based on score
  return score >= 70 ? 62 : score >= 50 ? 55 : 48
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function computeIndicators(
  candles: Candle[],
  fundingRate: number,
  openInterest: number
): IndicatorSnapshot | null {
  if (candles.length < 60) return null

  const closes = candles.map((c) => c.close)
  const n = candles.length - 1

  // Core indicators
  const ema9v  = ema(closes, 9)
  const ema21v = ema(closes, 21)
  const ema50v = ema(closes, 50)
  const ema200v = ema(closes, 200)

  const rsiArr = rsiCalc(closes, 14)
  const { macdLine, signalLine, hist } = macdCalc(closes)
  const bbands = bollingerBands(closes, 20)
  const atrArr = atrCalc(candles, 14)
  const vwapArr = vwapCalc(candles)
  const obvArr = obvCalc(candles)

  const price = closes[n]
  const { support, resistance } = pivotHighsLows(candles, price)

  // Volume surge
  const vols = candles.map((c) => c.volume)
  const avgVol = vols.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volSurge = avgVol > 0 ? candles[n].volume / avgVol : 1

  const currentVwap = vwapArr[n]
  const lastBB = bbands[n]
  const bbWidth = lastBB.mid > 0 ? (lastBB.upper - lastBB.lower) / lastBB.mid : 0
  const obvSlp = slope(obvArr, 5)

  // Advanced indicators
  const { k: stochK, d: stochD } = stochasticRsi(closes)
  const { adx, diPlus, diMinus } = adxDmi(candles)
  const wr = williamsRCalc(candles)
  const cmf = cmfCalc(candles)
  const { value: stValue, bullish: stBull } = supertrendCalc(candles)
  const { tenkan, kijun, senkouA, senkouB, cloudBull } = ichimokuCalc(candles)
  const { PP, R1, R2, R3, S1, S2, S3 } = pivotPoints(candles)

  // Quantitative
  const quantScore = computeQuantScore(candles, closes, atrArr)

  // Chart patterns
  const patterns = detectChartPatterns(candles, price)

  return {
    ema9:   ema9v[n]  || price,
    ema21:  ema21v[n] || price,
    ema50:  ema50v[n] || price,
    ema200: candles.length >= 200 ? (ema200v[n] || price) : price,
    rsi14:  rsiArr[n] || 50,
    stochRsiK: stochK,
    stochRsiD: stochD,
    macdLine:   macdLine[n]   || 0,
    macdSignal: signalLine[n] || 0,
    macdHist:   hist[n]       || 0,
    bbUpper: lastBB.upper || price * 1.02,
    bbMid:   lastBB.mid   || price,
    bbLower: lastBB.lower || price * 0.98,
    bbWidth,
    atr14: atrArr[n] || price * 0.01,
    vwap: currentVwap,
    volumeSurge: volSurge,
    obv: obvArr[n],
    obvSlope: obvSlp,
    support,
    resistance,
    priceVsVwap: currentVwap > 0 ? ((price - currentVwap) / currentVwap) * 100 : 0,
    fundingRate,
    openInterest,
    adx,
    diPlus,
    diMinus,
    williamsR: wr,
    cmf,
    supertrend: stValue,
    supertrendBull: stBull,
    ichimokuTenkan: tenkan,
    ichimokuKijun: kijun,
    ichimokuSenkouA: senkouA,
    ichimokuSenkouB: senkouB,
    ichimokuCloudBull: cloudBull,
    pivotPoint: PP,
    pivotR1: R1, pivotR2: R2, pivotR3: R3,
    pivotS1: S1, pivotS2: S2, pivotS3: S3,
    quantScore,
    patterns
  }
}

// Export helpers for signal engine
export { getWinRateEstimate }
