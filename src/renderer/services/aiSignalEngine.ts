import { Candle, AiSignal, AiSignalReason, AiSignalStrength, AiSignalTimeframe, IndicatorSnapshot, ChartPattern } from '../store/types'
import { computeIndicators, getWinRateEstimate } from './indicators'

// ─── Binance OHLCV fetch ──────────────────────────────────────────────────

const KLINE_BASE = 'https://fapi.binance.com/fapi/v1/klines'

export async function fetchCandles(symbol: string, interval: AiSignalTimeframe, limit = 250): Promise<Candle[]> {
  const url = `${KLINE_BASE}?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`klines HTTP ${res.status}`)
  const raw: [number, string, string, string, string, string][] = await res.json()
  return raw.map(([t, o, h, l, c, v]) => ({
    time: t,
    open: parseFloat(o),
    high: parseFloat(h),
    low: parseFloat(l),
    close: parseFloat(c),
    volume: parseFloat(v)
  }))
}

// ─── Scoring Factor ───────────────────────────────────────────────────────

interface Factor {
  name: string
  detail: string
  score: number   // -100 to +100  (positive = bullish, negative = bearish)
  weight: number  // importance 0-1
}

// ─── Core Technical Indicator Factors ─────────────────────────────────────

function scoreIndicators(ind: IndicatorSnapshot, price: number, candles: Candle[]): Factor[] {
  const factors: Factor[] = []

  // ── 1. EMA Stack (trend alignment) ──
  const emaStack     = price > ind.ema9 && ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50
  const emaBearStack = price < ind.ema9 && ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50
  const ema200Bull   = price > ind.ema200
  factors.push({
    name: 'EMA Stack',
    detail: emaStack
      ? `Full bull stack: Price > EMA9(${ind.ema9.toFixed(2)}) > EMA21 > EMA50${ema200Bull ? ' > EMA200' : ''}`
      : emaBearStack
      ? `Full bear stack: Price < EMA9(${ind.ema9.toFixed(2)}) < EMA21 < EMA50`
      : `Mixed EMAs — EMA9 ${ind.ema9.toFixed(2)}, EMA21 ${ind.ema21.toFixed(2)}, EMA50 ${ind.ema50.toFixed(2)}`,
    score: emaStack ? (ema200Bull ? 85 : 75) : emaBearStack ? -75 : 0,
    weight: 0.14
  })

  // ── 2. EMA 9/21 Cross momentum ──
  const ema9Cross = ind.ema9 > ind.ema21
  factors.push({
    name: 'EMA 9/21',
    detail: ema9Cross
      ? `EMA9 (${ind.ema9.toFixed(2)}) above EMA21 (${ind.ema21.toFixed(2)}) — bullish momentum`
      : `EMA9 (${ind.ema9.toFixed(2)}) below EMA21 (${ind.ema21.toFixed(2)}) — bearish momentum`,
    score: ema9Cross ? 50 : -50,
    weight: 0.08
  })

  // ── 3. RSI (14) ──
  let rsiScore = 0; let rsiDetail = ''
  if      (ind.rsi14 < 25) { rsiScore = 95;  rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — extreme oversold, strong bounce expected` }
  else if (ind.rsi14 < 35) { rsiScore = 75;  rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — oversold, reversal likely` }
  else if (ind.rsi14 < 45) { rsiScore = 35;  rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — approaching oversold zone` }
  else if (ind.rsi14 > 80) { rsiScore = -95; rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — extreme overbought, reversal imminent` }
  else if (ind.rsi14 > 70) { rsiScore = -75; rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — overbought, watch for reversal` }
  else if (ind.rsi14 > 60) { rsiScore = -35; rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — elevated, caution` }
  else if (ind.rsi14 >= 45 && ind.rsi14 <= 55) { rsiScore = 20; rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — neutral, trend continuation` }
  else { rsiScore = 0; rsiDetail = `RSI ${ind.rsi14.toFixed(1)} — neutral` }
  factors.push({ name: 'RSI (14)', detail: rsiDetail, score: rsiScore, weight: 0.10 })

  // ── 4. Stochastic RSI ──
  let stochScore = 0; let stochDetail = ''
  const stochBull = ind.stochRsiK > ind.stochRsiD
  if (ind.stochRsiK < 20 && stochBull)       { stochScore = 85; stochDetail = `StochRSI K:${ind.stochRsiK.toFixed(1)} D:${ind.stochRsiD.toFixed(1)} — oversold + bullish cross` }
  else if (ind.stochRsiK < 20)               { stochScore = 55; stochDetail = `StochRSI K:${ind.stochRsiK.toFixed(1)} — oversold zone` }
  else if (ind.stochRsiK > 80 && !stochBull) { stochScore = -85; stochDetail = `StochRSI K:${ind.stochRsiK.toFixed(1)} D:${ind.stochRsiD.toFixed(1)} — overbought + bearish cross` }
  else if (ind.stochRsiK > 80)               { stochScore = -55; stochDetail = `StochRSI K:${ind.stochRsiK.toFixed(1)} — overbought zone` }
  else { stochScore = stochBull ? 25 : -25; stochDetail = `StochRSI K:${ind.stochRsiK.toFixed(1)} D:${ind.stochRsiD.toFixed(1)} — ${stochBull ? 'bullish' : 'bearish'} momentum` }
  factors.push({ name: 'Stoch RSI', detail: stochDetail, score: stochScore, weight: 0.08 })

  // ── 5. MACD ──
  const macdBull = ind.macdLine > ind.macdSignal && ind.macdHist > 0
  const macdBear = ind.macdLine < ind.macdSignal && ind.macdHist < 0
  // Histogram expanding?
  const prevHist = candles.length >= 3 ? candles[candles.length - 2].close - candles[candles.length - 3].close : 0
  const histExpanding = Math.abs(ind.macdHist) > Math.abs(prevHist)
  factors.push({
    name: 'MACD',
    detail: macdBull
      ? `MACD(${ind.macdLine.toFixed(4)}) > Signal(${ind.macdSignal.toFixed(4)}), hist ${histExpanding ? 'expanding' : 'contracting'} — ${histExpanding ? 'strong' : 'weakening'} bull`
      : macdBear
      ? `MACD(${ind.macdLine.toFixed(4)}) < Signal(${ind.macdSignal.toFixed(4)}) — bearish momentum${histExpanding ? ' expanding' : ''}`
      : `MACD histogram (${ind.macdHist.toFixed(4)}) — crossover zone, watch next candle`,
    score: macdBull ? (histExpanding ? 75 : 55) : macdBear ? (histExpanding ? -75 : -55) : 0,
    weight: 0.10
  })

  // ── 6. Bollinger Bands ──
  const bbPct = ind.bbLower < ind.bbUpper
    ? (price - ind.bbLower) / (ind.bbUpper - ind.bbLower)
    : 0.5
  let bbScore = 0; let bbDetail = ''
  if      (bbPct < 0.05) { bbScore = 90;  bbDetail = `At/below lower BB(${ind.bbLower.toFixed(2)}) — extreme compression, strong mean-reversion LONG` }
  else if (bbPct < 0.15) { bbScore = 65;  bbDetail = `Near lower BB(${ind.bbLower.toFixed(2)}) — mean reversion zone` }
  else if (bbPct > 0.95) { bbScore = -90; bbDetail = `At/above upper BB(${ind.bbUpper.toFixed(2)}) — extreme extension, reversion SHORT` }
  else if (bbPct > 0.85) { bbScore = -65; bbDetail = `Near upper BB(${ind.bbUpper.toFixed(2)}) — overbought extension` }
  else if (ind.bbWidth < 0.015) { bbScore = 15; bbDetail = `BB squeeze(${(ind.bbWidth*100).toFixed(2)}%) — Keltner compression, imminent breakout` }
  else { bbScore = (bbPct - 0.5) * -60; bbDetail = `BB position ${(bbPct*100).toFixed(0)}% — ${bbPct > 0.5 ? 'upper half' : 'lower half'} of band` }
  factors.push({ name: 'Bollinger Bands', detail: bbDetail, score: bbScore, weight: 0.08 })

  // ── 7. VWAP ──
  const pvwap = ind.priceVsVwap
  factors.push({
    name: 'VWAP',
    detail: pvwap > 1.5
      ? `Price ${pvwap.toFixed(2)}% above VWAP(${ind.vwap.toFixed(2)}) — strong institutional buy pressure`
      : pvwap > 0.3
      ? `Price ${pvwap.toFixed(2)}% above VWAP — buyers in control`
      : pvwap < -1.5
      ? `Price ${Math.abs(pvwap).toFixed(2)}% below VWAP(${ind.vwap.toFixed(2)}) — heavy sell pressure`
      : pvwap < -0.3
      ? `Price ${Math.abs(pvwap).toFixed(2)}% below VWAP — sellers dominant`
      : `Price within 0.3% of VWAP(${ind.vwap.toFixed(2)}) — equilibrium, watch for break`,
    score: Math.max(-100, Math.min(100, pvwap * 18)),
    weight: 0.10
  })

  // ── 8. Volume Analysis ──
  let volScore = 0; let volDetail = ''
  if (ind.volumeSurge > 3) {
    const bull = price > ind.ema21
    volScore = bull ? 90 : -90
    volDetail = `Extreme volume ${ind.volumeSurge.toFixed(1)}x avg — explosive ${bull ? 'buying' : 'selling'} pressure, likely continuation`
  } else if (ind.volumeSurge > 2) {
    const bull = price > ind.ema21
    volScore = bull ? 70 : -70
    volDetail = `Volume surge ${ind.volumeSurge.toFixed(1)}x avg — strong ${bull ? 'buy' : 'sell'} conviction`
  } else if (ind.volumeSurge > 1.4) {
    const bull = price > ind.ema21
    volScore = bull ? 40 : -40
    volDetail = `Elevated volume ${ind.volumeSurge.toFixed(1)}x — above-avg ${bull ? 'buying' : 'selling'}`
  } else if (ind.volumeSurge < 0.5) {
    volScore = 0; volDetail = `Thin volume (${ind.volumeSurge.toFixed(2)}x avg) — weak conviction, signals unreliable`
  } else {
    volScore = 5; volDetail = `Normal volume (${ind.volumeSurge.toFixed(2)}x avg)`
  }
  factors.push({ name: 'Volume', detail: volDetail, score: volScore, weight: 0.08 })

  // ── 9. OBV Trend ──
  factors.push({
    name: 'OBV Trend',
    detail: ind.obvSlope > 500
      ? `OBV strongly rising (slope +${ind.obvSlope.toFixed(0)}) — major accumulation`
      : ind.obvSlope > 0
      ? `OBV rising (slope +${ind.obvSlope.toFixed(0)}) — accumulation in progress`
      : ind.obvSlope < -500
      ? `OBV sharply falling (slope ${ind.obvSlope.toFixed(0)}) — heavy distribution`
      : ind.obvSlope < 0
      ? `OBV falling (slope ${ind.obvSlope.toFixed(0)}) — distribution detected`
      : 'OBV flat — no money flow direction',
    score: Math.max(-80, Math.min(80, ind.obvSlope > 0 ? 55 : ind.obvSlope < 0 ? -55 : 0)),
    weight: 0.06
  })

  // ── 10. ADX / DMI (trend strength & direction) ──
  const trendStrong = ind.adx > 25
  const diPlusBull = ind.diPlus > ind.diMinus
  let adxScore = 0; let adxDetail = ''
  if (ind.adx > 40) {
    adxScore = diPlusBull ? 80 : -80
    adxDetail = `ADX ${ind.adx.toFixed(1)} — STRONG trend, DI+ ${ind.diPlus.toFixed(1)} vs DI- ${ind.diMinus.toFixed(1)} — ${diPlusBull ? 'powerful uptrend' : 'powerful downtrend'}`
  } else if (ind.adx > 25) {
    adxScore = diPlusBull ? 55 : -55
    adxDetail = `ADX ${ind.adx.toFixed(1)} — trending, DI+ ${ind.diPlus.toFixed(1)} vs DI- ${ind.diMinus.toFixed(1)} — ${diPlusBull ? 'bullish' : 'bearish'}`
  } else {
    adxScore = 0
    adxDetail = `ADX ${ind.adx.toFixed(1)} — ranging/choppy, avoid trend-following`
  }
  factors.push({ name: 'ADX / DMI', detail: adxDetail, score: adxScore, weight: 0.08 })

  // ── 11. Williams %R ──
  let wrScore = 0; let wrDetail = ''
  if      (ind.williamsR < -90) { wrScore = 85;  wrDetail = `Williams %R ${ind.williamsR.toFixed(1)} — extreme oversold, sharp reversal likely` }
  else if (ind.williamsR < -80) { wrScore = 60;  wrDetail = `Williams %R ${ind.williamsR.toFixed(1)} — oversold territory` }
  else if (ind.williamsR > -10) { wrScore = -85; wrDetail = `Williams %R ${ind.williamsR.toFixed(1)} — extreme overbought` }
  else if (ind.williamsR > -20) { wrScore = -60; wrDetail = `Williams %R ${ind.williamsR.toFixed(1)} — overbought zone` }
  else { wrScore = 0; wrDetail = `Williams %R ${ind.williamsR.toFixed(1)} — neutral zone` }
  factors.push({ name: 'Williams %R', detail: wrDetail, score: wrScore, weight: 0.05 })

  // ── 12. CMF (Chaikin Money Flow) ──
  let cmfScore = 0; let cmfDetail = ''
  if      (ind.cmf > 0.2)  { cmfScore = 80;  cmfDetail = `CMF ${ind.cmf.toFixed(3)} — strong buying pressure, money flowing in` }
  else if (ind.cmf > 0.05) { cmfScore = 40;  cmfDetail = `CMF ${ind.cmf.toFixed(3)} — moderate buying pressure` }
  else if (ind.cmf < -0.2) { cmfScore = -80; cmfDetail = `CMF ${ind.cmf.toFixed(3)} — strong selling pressure, money outflow` }
  else if (ind.cmf < -0.05){ cmfScore = -40; cmfDetail = `CMF ${ind.cmf.toFixed(3)} — moderate selling pressure` }
  else { cmfScore = 0; cmfDetail = `CMF ${ind.cmf.toFixed(3)} — neutral money flow` }
  factors.push({ name: 'CMF', detail: cmfDetail, score: cmfScore, weight: 0.05 })

  // ── 13. Supertrend ──
  factors.push({
    name: 'Supertrend',
    detail: ind.supertrendBull
      ? `Supertrend BULLISH — support at ${ind.supertrend.toFixed(2)}, trend intact`
      : `Supertrend BEARISH — resistance at ${ind.supertrend.toFixed(2)}, trend down`,
    score: ind.supertrendBull ? 70 : -70,
    weight: 0.08
  })

  // ── 14. Ichimoku Cloud ──
  const tenkanAboveKijun = ind.ichimokuTenkan > ind.ichimokuKijun
  let ichScore = 0; let ichDetail = ''
  if (ind.ichimokuCloudBull && tenkanAboveKijun) {
    ichScore = 80
    ichDetail = `Price above Kumo (${ind.ichimokuSenkouA.toFixed(2)}/${ind.ichimokuSenkouB.toFixed(2)}), Tenkan>${ind.ichimokuTenkan.toFixed(2)}>Kijun — full bullish Ichimoku`
  } else if (ind.ichimokuCloudBull) {
    ichScore = 45
    ichDetail = `Price above cloud — bullish, but Tenkan/Kijun mixed`
  } else if (!ind.ichimokuCloudBull && !tenkanAboveKijun) {
    ichScore = -80
    ichDetail = `Price below cloud, Tenkan<Kijun — full bearish Ichimoku`
  } else {
    ichScore = -45
    ichDetail = `Price below Kumo — bearish structure`
  }
  factors.push({ name: 'Ichimoku', detail: ichDetail, score: ichScore, weight: 0.07 })

  // ── 15. Pivot Points (daily) ──
  const nearPivot = Math.abs(price - ind.pivotPoint) / price < 0.005
  const aboveR1 = price > ind.pivotR1
  const belowS1 = price < ind.pivotS1
  let pivScore = 0; let pivDetail = ''
  if (aboveR1) {
    pivScore = 55; pivDetail = `Price above R1(${ind.pivotR1.toFixed(2)}) — bullish breakout of daily pivot zone`
  } else if (belowS1) {
    pivScore = -55; pivDetail = `Price below S1(${ind.pivotS1.toFixed(2)}) — bearish breakdown of daily pivot zone`
  } else if (nearPivot) {
    pivScore = 0; pivDetail = `At Pivot Point(${ind.pivotPoint.toFixed(2)}) — decision zone, R1:${ind.pivotR1.toFixed(2)} S1:${ind.pivotS1.toFixed(2)}`
  } else {
    const pctToR1 = ((ind.pivotR1 - price) / price) * 100
    const pctToS1 = ((price - ind.pivotS1) / price) * 100
    pivScore = pctToS1 < pctToR1 ? 20 : -20
    pivDetail = `Between pivots — R1:${ind.pivotR1.toFixed(2)}(+${pctToR1.toFixed(2)}%) S1:${ind.pivotS1.toFixed(2)}(-${pctToS1.toFixed(2)}%)`
  }
  factors.push({ name: 'Pivot Points', detail: pivDetail, score: pivScore, weight: 0.05 })

  // ── 16. Support / Resistance ──
  const distToSupport    = ((price - ind.support) / price) * 100
  const distToResistance = ((ind.resistance - price) / price) * 100
  const nearSupport    = distToSupport < 1.0
  const nearResistance = distToResistance < 1.0
  factors.push({
    name: 'S/R Zones',
    detail: nearSupport
      ? `${distToSupport.toFixed(2)}% above key support(${ind.support.toFixed(2)}) — strong long base, bounce zone`
      : nearResistance
      ? `${distToResistance.toFixed(2)}% below resistance(${ind.resistance.toFixed(2)}) — short pressure at ceiling`
      : `Support ${ind.support.toFixed(2)} | Resistance ${ind.resistance.toFixed(2)} | Buffer ratio ${(distToResistance/Math.max(distToSupport,0.01)).toFixed(2)}`,
    score: nearSupport ? 70 : nearResistance ? -70 : 0,
    weight: 0.07
  })

  // ── 17. Funding Rate (perpetual futures contrarian signal) ──
  const fr = ind.fundingRate * 100
  let frScore = 0; let frDetail = ''
  if      (fr > 0.15) { frScore = -80; frDetail = `Funding ${fr.toFixed(4)}% — extreme positive, longs squeezed, bearish bias` }
  else if (fr > 0.08) { frScore = -45; frDetail = `Funding ${fr.toFixed(4)}% — elevated, longs paying heavily` }
  else if (fr < -0.08){ frScore = 80;  frDetail = `Funding ${fr.toFixed(4)}% — negative, shorts squeezed, bullish bias` }
  else if (fr < -0.03){ frScore = 40;  frDetail = `Funding ${fr.toFixed(4)}% — negative funding, squeeze potential` }
  else { frScore = 0; frDetail = `Funding ${fr.toFixed(4)}% — neutral` }
  factors.push({ name: 'Funding Rate', detail: frDetail, score: frScore, weight: 0.06 })

  // ── 18. ATR context (volatility regime — informational) ──
  const atrPct = (ind.atr14 / price) * 100
  const volRegime = ind.quantScore.volatilityRegime
  factors.push({
    name: 'ATR Volatility',
    detail: `ATR ${ind.atr14.toFixed(4)} (${atrPct.toFixed(2)}%) | Regime: ${volRegime.toUpperCase()} | Stops should be ${atrPct > 3 ? 'wide (>2× ATR)' : atrPct < 0.5 ? 'tight (0.5-1× ATR)' : '1.5–2× ATR'}`,
    score: 0,
    weight: 0  // informational only
  })

  return factors
}

// ─── Chart Pattern Scoring ────────────────────────────────────────────────

function scorePatterns(patterns: ChartPattern[]): Factor[] {
  if (patterns.length === 0) return []
  const factors: Factor[] = []

  const topPattern = patterns[0]
  const confBonus = ((topPattern.confidence - 60) / 40) * 20  // 0-20 bonus for high confidence

  factors.push({
    name: `Pattern: ${formatPatternName(topPattern.type)}`,
    detail: topPattern.description + ` | Confidence: ${topPattern.confidence}% | Expected move: ${topPattern.targetMove > 0 ? '+' : ''}${topPattern.targetMove.toFixed(1)}%`,
    score: (topPattern.direction === 'LONG' ? 75 : -75) + (topPattern.direction === 'LONG' ? confBonus : -confBonus),
    weight: 0.12
  })

  // If 2 or more patterns agree, add confluence bonus
  if (patterns.length >= 2 && patterns[1].direction === topPattern.direction) {
    factors.push({
      name: 'Pattern Confluence',
      detail: `${patterns.length} patterns confirm ${topPattern.direction}: ${patterns.slice(0,3).map(p => formatPatternName(p.type)).join(', ')}`,
      score: topPattern.direction === 'LONG' ? 40 : -40,
      weight: 0.06
    })
  }

  return factors
}

function formatPatternName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Quantitative Analytics Scoring ──────────────────────────────────────

function scoreQuant(ind: IndicatorSnapshot): Factor[] {
  const factors: Factor[] = []
  const qs = ind.quantScore

  // Z-Score mean reversion
  const absZ = Math.abs(qs.zScore)
  if (absZ > 1.5) {
    factors.push({
      name: 'Z-Score (Mean Rev)',
      detail: `Z-Score ${qs.zScore.toFixed(2)}σ — price is ${absZ > 2 ? 'significantly' : 'moderately'} ${qs.zScore > 0 ? 'overbought' : 'oversold'} vs 50-bar mean | Reversion prob: ${qs.meanReversionProb}%`,
      score: qs.zScore > 0 ? -(Math.min(90, absZ * 30)) : (Math.min(90, absZ * 30)),
      weight: 0.07
    })
  }

  // Momentum factor
  if (Math.abs(qs.momentumFactor) > 0.2) {
    factors.push({
      name: 'Momentum Factor',
      detail: `Momentum: ${(qs.momentumFactor * 100).toFixed(1)}% (1/5/20-bar composite) — ${Math.abs(qs.momentumFactor) > 0.6 ? 'strong' : 'moderate'} ${qs.momentumFactor > 0 ? 'bullish' : 'bearish'} momentum`,
      score: Math.max(-80, Math.min(80, qs.momentumFactor * 100)),
      weight: 0.06
    })
  }

  // Volatility regime — only add if notable
  if (qs.volatilityRegime === 'extreme') {
    factors.push({
      name: 'Volatility Regime',
      detail: `EXTREME volatility — ${qs.volatilityRegime.toUpperCase()} regime. Reduce position size, widen stops. Breakout probability: ${qs.breakoutProb}%`,
      score: 0,
      weight: 0
    })
  } else if (qs.volatilityRegime === 'low' && qs.breakoutProb > 50) {
    factors.push({
      name: 'Volatility Squeeze',
      detail: `Low volatility + BB squeeze — breakout probability ${qs.breakoutProb}%, watch for explosive move`,
      score: 15,
      weight: 0.03
    })
  }

  // Trend strength via R²
  if (qs.trendStrength > 70) {
    const dir = ind.ema9 > ind.ema21 ? 'BULLISH' : 'BEARISH'
    factors.push({
      name: 'Trend Quality (R²)',
      detail: `Linear regression R²: ${qs.trendStrength}% — high-quality ${dir} trend over last 20 bars`,
      score: dir === 'BULLISH' ? 60 : -60,
      weight: 0.05
    })
  }

  return factors
}

// ─── Signal Builder ───────────────────────────────────────────────────────

function buildSignal(
  symbol: string,
  timeframe: AiSignalTimeframe,
  candles: Candle[],
  ind: IndicatorSnapshot,
  factors: Factor[]
): AiSignal | null {
  const price = candles[candles.length - 1].close

  // Weighted composite score  −100..+100
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const rawScore = totalWeight > 0
    ? factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight
    : 0

  // Minimum conviction threshold (lowered to generate more signals)
  if (Math.abs(rawScore) < 16) return null

  const direction: 'LONG' | 'SHORT' = rawScore > 0 ? 'LONG' : 'SHORT'

  // Normalize 0-100
  const scoreNorm = Math.round(Math.min(100, Math.abs(rawScore)))
  const strength: AiSignalStrength = scoreNorm >= 68 ? 'STRONG' : scoreNorm >= 45 ? 'MODERATE' : 'WEAK'

  // Risk levels
  const atr = ind.atr14
  const isBull = direction === 'LONG'

  const entryPrice = price
  const entryZoneLow  = isBull ? price - atr * 0.3 : price - atr * 0.1
  const entryZoneHigh = isBull ? price + atr * 0.1 : price + atr * 0.3

  // Smart stop using S/R + ATR
  const stopLoss = isBull
    ? Math.max(ind.support, price - atr * 2.0, entryZoneLow - atr * 0.5)
    : Math.min(ind.resistance, price + atr * 2.0, entryZoneHigh + atr * 0.5)

  const risk = Math.abs(price - stopLoss)
  const tp1 = isBull ? price + risk * 1.5 : price - risk * 1.5
  const tp2 = isBull ? price + risk * 2.5 : price - risk * 2.5
  const tp3 = isBull ? price + risk * 4.0 : price - risk * 4.0

  const riskRewardRatio = parseFloat((risk > 0 ? risk * 2.5 / risk : 0).toFixed(2))

  // Dynamic leverage
  const baseLev = strength === 'STRONG' ? 5 : strength === 'MODERATE' ? 3 : 2
  // Reduce leverage in extreme volatility
  const suggestedLeverage = ind.quantScore.volatilityRegime === 'extreme' ? Math.max(1, baseLev - 2)
    : ind.quantScore.volatilityRegime === 'high' ? Math.max(1, baseLev - 1) : baseLev

  // Reasons list
  const reasons: AiSignalReason[] = factors
    .filter((f) => f.weight > 0)
    .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
    .map((f) => ({
      indicator: f.name,
      detail: f.detail,
      bullish: f.score > 0,
      weight: f.weight
    }))

  // Top chart pattern
  const topPattern = ind.patterns[0]
  const patternName = topPattern ? formatPatternName(topPattern.type) : undefined
  const patternConfidence = topPattern?.confidence

  // Win rate estimate
  const winRateEstimate = getWinRateEstimate(ind.patterns, scoreNorm)

  // Expected move (ATR-based, boosted by pattern targetMove)
  const atrPct = (atr / price) * 100
  const expectedMove = topPattern
    ? Math.abs(topPattern.targetMove)
    : atrPct * (timeframe === '4h' ? 3 : timeframe === '1h' ? 2 : 1.5)

  // AI summary
  const topBull = factors.filter((f) => f.score > 50 && f.weight > 0).map((f) => f.name).slice(0, 3)
  const topBear = factors.filter((f) => f.score < -50 && f.weight > 0).map((f) => f.name).slice(0, 3)
  const confluenceCount = factors.filter((f) => (isBull ? f.score > 30 : f.score < -30) && f.weight > 0).length

  const summary = direction === 'LONG'
    ? `${strength} LONG on ${symbol} (${timeframe}) — Score ${scoreNorm}/100. ` +
      `${confluenceCount} bullish confluences: ${topBull.join(', ') || 'mixed'}. ` +
      (patternName ? `Pattern: ${patternName} (${patternConfidence}% conf). ` : '') +
      `ATR ${atrPct.toFixed(2)}% | R:R 1:${(risk*2.5/risk).toFixed(1)} | Est.Win ${winRateEstimate}% | Expected move: +${expectedMove.toFixed(1)}%. ` +
      (topBear.length ? `Counter: ${topBear.join(', ')}.` : 'No major bearish divergence.')
    : `${strength} SHORT on ${symbol} (${timeframe}) — Score ${scoreNorm}/100. ` +
      `${confluenceCount} bearish confluences: ${topBear.join(', ') || 'mixed'}. ` +
      (patternName ? `Pattern: ${patternName} (${patternConfidence}% conf). ` : '') +
      `ATR ${atrPct.toFixed(2)}% | R:R 1:${(risk*2.5/risk).toFixed(1)} | Est.Win ${winRateEstimate}% | Expected move: -${expectedMove.toFixed(1)}%. ` +
      (topBull.length ? `Counter: ${topBull.join(', ')}.` : 'No major bullish divergence.')

  const TTL_MAP: Record<AiSignalTimeframe, number> = {
    '15m': 2  * 60 * 60 * 1000,
    '1h':  8  * 60 * 60 * 1000,
    '4h':  32 * 60 * 60 * 1000
  }

  return {
    id: `${symbol}-${timeframe}-${Date.now()}`,
    symbol,
    direction,
    strength,
    score: scoreNorm,
    timeframe,
    entryPrice,
    entryZoneLow,
    entryZoneHigh,
    tp1, tp2, tp3,
    stopLoss,
    riskRewardRatio,
    suggestedLeverage,
    positionSizeRisk: strength === 'STRONG' ? 2 : 1,
    indicators: ind,
    reasons,
    summary,
    timestamp: Date.now(),
    expiresAt: Date.now() + TTL_MAP[timeframe],
    invalidated: false,
    status: 'active',
    patternName,
    patternConfidence,
    quantScore: ind.quantScore,
    expectedMove,
    winRateEstimate
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function analyzeSymbol(
  symbol: string,
  timeframe: AiSignalTimeframe,
  fundingRate: number,
  openInterest: number
): Promise<AiSignal | null> {
  const candles = await fetchCandles(symbol, timeframe, 250)
  if (candles.length < 60) return null

  const ind = computeIndicators(candles, fundingRate, openInterest)
  if (!ind) return null

  const price = candles[candles.length - 1].close

  // Gather all factors: technical + pattern + quant
  const techFactors = scoreIndicators(ind, price, candles)
  const patternFactors = scorePatterns(ind.patterns)
  const quantFactors = scoreQuant(ind)
  const allFactors = [...techFactors, ...patternFactors, ...quantFactors]

  return buildSignal(symbol, timeframe, candles, ind, allFactors)
}

export async function runAiScan(
  symbols: string[],
  fundingRates: Record<string, number>,
  openInterests: Record<string, number>,
  timeframes: AiSignalTimeframe[] = ['15m', '1h', '4h']
): Promise<AiSignal[]> {
  const results: AiSignal[] = []

  // Expanded: up to 15 symbols × 3 timeframes, batches of 6
  const tasks: Array<() => Promise<AiSignal | null>> = []
  for (const sym of symbols.slice(0, 15)) {
    for (const tf of timeframes) {
      tasks.push(() => analyzeSymbol(sym, tf, fundingRates[sym] ?? 0, openInterests[sym] ?? 0).catch(() => null))
    }
  }

  const BATCH = 6
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH)
    const batchResults = await Promise.all(batch.map((t) => t()))
    for (const r of batchResults) {
      if (r) results.push(r)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
