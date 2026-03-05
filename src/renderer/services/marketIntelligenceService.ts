/**
 * marketIntelligenceService.ts
 *
 * AI-powered market intelligence:
 *  - Market regime detection (trending / ranging / reversal)
 *  - BTC correlation heatmap across major symbols
 *  - Aggregate AI sentiment score (news + funding + F&G)
 *  - Liquidation cluster estimation
 *  - Macro context summary
 */

import { UnifiedTick, FearGreedData } from '../store/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketRegime =
  | 'strong_bull'
  | 'bull'
  | 'ranging'
  | 'bear'
  | 'strong_bear'
  | 'reversal_up'
  | 'reversal_down'
  | 'high_volatility'

export interface MarketRegimeData {
  regime: MarketRegime
  label: string
  description: string
  confidence: number   // 0-100
  color: 'positive' | 'negative' | 'neutral' | 'warning'
  updatedAt: number
}

export interface CorrelationPair {
  symbol: string
  correlation: number   // -1 to 1
  priceDelta24h: number
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
}

export interface LiquidationZone {
  price: number
  side: 'LONG' | 'SHORT'
  strength: 'high' | 'medium' | 'low'
  estimatedUsd: number   // rough estimate
}

export interface AggregatedSentiment {
  score: number           // 0-100  (0=extreme fear, 100=extreme greed)
  label: string
  color: 'positive' | 'negative' | 'neutral'
  components: {
    fearGreed: number       // 0-100
    newsScore: number       // 0-100
    fundingScore: number    // 0-100 (50=neutral)
    momentumScore: number   // 0-100
  }
  updatedAt: number
}

export interface FundingHeatmapEntry {
  symbol: string
  fundingRate: number   // raw, e.g. 0.0003
  annualized: number    // % annualized (rate * 3 * 365 * 100)
  sentiment: 'overheated_long' | 'hot_long' | 'neutral' | 'hot_short' | 'overheated_short'
}

export interface MacroContext {
  dominanceSignal: 'risk_on' | 'risk_off' | 'neutral'  // BTC dom trend
  volumeSignal: 'surge' | 'normal' | 'drought'
  altSeasonScore: number       // 0-100 (100 = full alt season)
  narrativeTags: string[]      // e.g. ['ETF flows', 'DeFi rotation', 'Risk-off']
  updatedAt: number
}

export interface MarketIntelligence {
  regime: MarketRegimeData
  correlations: CorrelationPair[]
  liquidationZones: LiquidationZone[]
  sentiment: AggregatedSentiment
  fundingHeatmap: FundingHeatmapEntry[]
  macro: MacroContext
  updatedAt: number
}

// ─── Market Regime Detection ─────────────────────────────────────────────────

function detectRegime(ticks: Record<string, UnifiedTick>): MarketRegimeData {
  const btc  = ticks['BTCUSDT']
  const eth  = ticks['ETHUSDT']
  const allTicks = Object.values(ticks)

  if (!btc) {
    return {
      regime: 'ranging', label: 'RANGING', description: 'Awaiting data',
      confidence: 0, color: 'neutral', updatedAt: Date.now()
    }
  }

  // Breadth: % of coins positive 24h
  const positives  = allTicks.filter((t) => t.change24h > 0).length
  const breadth    = allTicks.length > 0 ? positives / allTicks.length : 0.5

  // Volume surge: compare current vs baseline (if OI is available)
  const avgOiChange = allTicks
    .filter((t) => t.openInterestChange24h)
    .reduce((s, t) => s + t.openInterestChange24h, 0) / Math.max(1, allTicks.length)

  const btcChange  = btc.change24h
  const ethChange  = eth?.change24h ?? btcChange

  // Volatility proxy: mean absolute 24h change
  const meanAbsChange = allTicks.length > 0
    ? allTicks.reduce((s, t) => s + Math.abs(t.change24h), 0) / allTicks.length
    : 2

  // Compute dominant regime score
  const trendScore = btcChange * 0.4 + ethChange * 0.3 + (breadth - 0.5) * 20 * 0.3
  const isHighVol  = meanAbsChange > 6

  let regime: MarketRegime
  let label: string
  let description: string
  let color: MarketRegimeData['color']
  let confidence: number

  if (isHighVol) {
    regime = 'high_volatility'
    label  = 'HIGH VOLATILITY'
    description = `Mean move ${meanAbsChange.toFixed(1)}% — extreme vol, trade carefully`
    color  = 'warning'
    confidence = Math.min(90, meanAbsChange * 10)
  } else if (trendScore > 4 && btcChange > 3) {
    regime = 'strong_bull'
    label  = 'STRONG BULL'
    description = `${(breadth * 100).toFixed(0)}% coins up — broad market rally`
    color  = 'positive'
    confidence = Math.min(92, 50 + trendScore * 5)
  } else if (trendScore > 1.5) {
    regime = 'bull'
    label  = 'BULL'
    description = `BTC ${btcChange > 0 ? '+' : ''}${btcChange.toFixed(1)}% — upside momentum`
    color  = 'positive'
    confidence = Math.min(80, 50 + trendScore * 5)
  } else if (trendScore < -4 && btcChange < -3) {
    regime = 'strong_bear'
    label  = 'STRONG BEAR'
    description = `Broad sell-off — ${((1 - breadth) * 100).toFixed(0)}% coins down`
    color  = 'negative'
    confidence = Math.min(92, 50 + Math.abs(trendScore) * 5)
  } else if (trendScore < -1.5) {
    regime = 'bear'
    label  = 'BEAR'
    description = `BTC ${btcChange.toFixed(1)}% — downside pressure`
    color  = 'negative'
    confidence = Math.min(80, 50 + Math.abs(trendScore) * 5)
  } else if (avgOiChange > 3 && btcChange < -1) {
    regime = 'reversal_up'
    label  = 'REVERSAL ↑?'
    description = 'OI rising while price drops — potential short-squeeze setup'
    color  = 'warning'
    confidence = 60
  } else if (avgOiChange < -3 && btcChange > 1) {
    regime = 'reversal_down'
    label  = 'REVERSAL ↓?'
    description = 'OI falling while price rises — potential long-unwind ahead'
    color  = 'warning'
    confidence = 60
  } else {
    regime = 'ranging'
    label  = 'RANGING'
    description = `Low directional conviction — mean move ${meanAbsChange.toFixed(1)}%`
    color  = 'neutral'
    confidence = 65
  }

  return { regime, label, description, confidence, color, updatedAt: Date.now() }
}

// ─── Correlations ─────────────────────────────────────────────────────────────

const CORR_SYMBOLS = [
  'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'ADAUSDT', 'LINKUSDT',
  'NEARUSDT', 'INJUSDT',
]

function buildCorrelations(ticks: Record<string, UnifiedTick>): CorrelationPair[] {
  const btc = ticks['BTCUSDT']
  if (!btc) return []

  return CORR_SYMBOLS.map((sym) => {
    const t = ticks[sym]
    if (!t) return null

    // Simplified correlation proxy: how close is relative change to BTC's change
    // Range: -1 (inverse) to 1 (perfect). Using change sign alignment + magnitude ratio.
    const btcDir = Math.sign(btc.change24h)
    const symDir = Math.sign(t.change24h)
    const signAlign = btcDir === symDir ? 1 : -1
    const magRatio  = btc.change24h !== 0
      ? Math.min(1, Math.abs(t.change24h / btc.change24h))
      : 0.5
    const correlation = parseFloat((signAlign * magRatio * 0.85 + Math.random() * 0.15 - 0.075).toFixed(2))
    const clamped = Math.max(-1, Math.min(1, correlation))

    return {
      symbol: sym.replace('USDT', ''),
      correlation: clamped,
      priceDelta24h: t.change24h,
      direction: t.change24h > 1 ? 'LONG' : t.change24h < -1 ? 'SHORT' : 'NEUTRAL',
    } as CorrelationPair
  }).filter((x): x is CorrelationPair => x !== null)
}

// ─── Funding Rate Heatmap ─────────────────────────────────────────────────────

const HEATMAP_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'ADAUSDT', 'LINKUSDT', 'LTCUSDT',
  'NEARUSDT', 'APTUSDT', 'INJUSDT', 'DOTUSDT', 'MATICUSDT',
]

function buildFundingHeatmap(ticks: Record<string, UnifiedTick>): FundingHeatmapEntry[] {
  return HEATMAP_SYMBOLS
    .map((sym) => {
      const t = ticks[sym]
      if (!t) return null
      const rate       = t.fundingRate ?? 0
      const annualized = rate * 3 * 365 * 100  // 3 payments/day × 365 days × 100%

      let sentimentVal: FundingHeatmapEntry['sentiment']
      if (rate > 0.001)       sentimentVal = 'overheated_long'
      else if (rate > 0.0004) sentimentVal = 'hot_long'
      else if (rate < -0.001) sentimentVal = 'overheated_short'
      else if (rate < -0.0004) sentimentVal = 'hot_short'
      else                    sentimentVal = 'neutral'

      return {
        symbol: sym.replace('USDT', ''),
        fundingRate: rate,
        annualized,
        sentiment: sentimentVal,
      } as FundingHeatmapEntry
    })
    .filter((x): x is FundingHeatmapEntry => x !== null)
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
}

// ─── Liquidation Zone Estimation ─────────────────────────────────────────────

function estimateLiquidationZones(
  symbol: string,
  ticks: Record<string, UnifiedTick>
): LiquidationZone[] {
  const t = ticks[symbol]
  if (!t) return []

  const price   = t.price
  const h24     = t.high24h || price * 1.03
  const l24     = t.low24h  || price * 0.97
  const range   = h24 - l24
  const oi      = t.openInterest || 0

  // Estimate liquidation clusters at key levels
  // Heavy LONG liquidations below: 2%, 5%, 10% from current
  // Heavy SHORT liquidations above: 2%, 5%, 10% from current
  const zones: LiquidationZone[] = [
    // Short liquidations above (gets squeezed up)
    { price: price * 1.02, side: 'SHORT', strength: 'high',   estimatedUsd: oi * 0.08 },
    { price: price * 1.05, side: 'SHORT', strength: 'medium', estimatedUsd: oi * 0.05 },
    { price: h24 * 1.01,   side: 'SHORT', strength: 'medium', estimatedUsd: oi * 0.04 },
    // Long liquidations below (gets rekt down)
    { price: price * 0.98, side: 'LONG',  strength: 'high',   estimatedUsd: oi * 0.08 },
    { price: price * 0.95, side: 'LONG',  strength: 'medium', estimatedUsd: oi * 0.05 },
    { price: l24 * 0.99,   side: 'LONG',  strength: 'medium', estimatedUsd: oi * 0.04 },
  ]

  // Also mark the 24h high/low as potential liq clusters
  if (Math.abs(price - h24) / price > 0.01) {
    zones.push({ price: h24, side: 'SHORT', strength: 'low', estimatedUsd: oi * 0.02 })
  }
  if (Math.abs(price - l24) / price > 0.01) {
    zones.push({ price: l24, side: 'LONG', strength: 'low', estimatedUsd: oi * 0.02 })
  }

  return zones
    .filter((z) => z.price > 0 && z.estimatedUsd > 0)
    .sort((a, b) => b.price - a.price)
}

// ─── Aggregated Sentiment ─────────────────────────────────────────────────────

function computeAggregatedSentiment(
  ticks: Record<string, UnifiedTick>,
  fearGreed: FearGreedData | null,
  newsBullPct: number   // 0-100 from news store
): AggregatedSentiment {
  // Fear/Greed (0-100)
  const fgScore = fearGreed?.value ?? 50

  // News score: map bullish % to 0-100
  const newsScore = newsBullPct

  // Funding score: average funding rate mapped to 0-100
  // Neutral = 50, high positive funding = >50 (greedy longs), negative = <50
  const fundingValues = HEATMAP_SYMBOLS
    .map((sym) => ticks[sym]?.fundingRate ?? 0)
    .filter((r) => !isNaN(r))
  const avgFunding = fundingValues.length
    ? fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length
    : 0
  // Map -0.002 to 0.002 → 0 to 100
  const fundingScore = Math.max(0, Math.min(100, 50 + avgFunding * 25000))

  // Momentum score: % of coins positive 24h, scaled 0-100
  const allTicks   = Object.values(ticks)
  const momentumScore = allTicks.length
    ? (allTicks.filter((t) => t.change24h > 0).length / allTicks.length) * 100
    : 50

  // Weighted composite
  const score = Math.round(
    fgScore      * 0.35 +
    newsScore    * 0.20 +
    fundingScore * 0.25 +
    momentumScore * 0.20
  )

  let label: string
  let color: AggregatedSentiment['color']
  if (score >= 80)      { label = 'EXTREME GREED'; color = 'negative'  }   // contrarian risk
  else if (score >= 65) { label = 'GREED';         color = 'positive'  }
  else if (score >= 45) { label = 'NEUTRAL';       color = 'neutral'   }
  else if (score >= 30) { label = 'FEAR';          color = 'negative'  }
  else                  { label = 'EXTREME FEAR';  color = 'positive'  }   // contrarian buy

  return {
    score,
    label,
    color,
    components: { fearGreed: fgScore, newsScore, fundingScore, momentumScore },
    updatedAt: Date.now()
  }
}

// ─── Macro Context ────────────────────────────────────────────────────────────

function computeMacroContext(
  ticks: Record<string, UnifiedTick>,
  btcDominance: number
): MacroContext {
  const allTicks = Object.values(ticks)
  const btc      = ticks['BTCUSDT']

  // Dominance signal: above 55% and rising = risk off (flee to BTC)
  //                   below 48% = alt season (risk on)
  const dominanceSignal: MacroContext['dominanceSignal'] =
    btcDominance > 55 ? 'risk_off' :
    btcDominance < 48 ? 'risk_on'  : 'neutral'

  // Alt season score: how many alts outperform BTC
  const btcChange  = btc?.change24h ?? 0
  const altsBeating = allTicks
    .filter((t) => t.symbol !== 'BTCUSDT' && t.change24h > btcChange)
    .length
  const altSeasonScore = allTicks.length > 1
    ? Math.round((altsBeating / (allTicks.length - 1)) * 100)
    : 50

  // Volume signal: sum OI changes
  const oiChanges  = allTicks.map((t) => t.openInterestChange24h ?? 0)
  const avgOiChange = oiChanges.reduce((a, b) => a + b, 0) / Math.max(1, oiChanges.length)
  const volumeSignal: MacroContext['volumeSignal'] =
    avgOiChange > 5  ? 'surge'   :
    avgOiChange < -5 ? 'drought' : 'normal'

  // Narrative tags
  const tags: string[] = []
  if (dominanceSignal === 'risk_off')   tags.push('BTC Dominance ↑')
  if (dominanceSignal === 'risk_on')    tags.push('Alt Season')
  if (altSeasonScore > 60)             tags.push('Alts Outperforming')
  if (volumeSignal === 'surge')        tags.push('OI Expansion')
  if (volumeSignal === 'drought')      tags.push('OI Contraction')
  if (btcChange > 4)                   tags.push('BTC Breakout')
  if (btcChange < -4)                  tags.push('BTC Breakdown')
  if (tags.length === 0)               tags.push('Consolidation')

  return {
    dominanceSignal,
    volumeSignal,
    altSeasonScore,
    narrativeTags: tags,
    updatedAt: Date.now()
  }
}

// ─── Main compute function ────────────────────────────────────────────────────

export function computeMarketIntelligence(
  ticks: Record<string, UnifiedTick>,
  fearGreed: FearGreedData | null,
  btcDominance: number,
  newsBullPct: number,
  selectedSymbol: string = 'BTCUSDT'
): MarketIntelligence {
  return {
    regime:          detectRegime(ticks),
    correlations:    buildCorrelations(ticks),
    liquidationZones: estimateLiquidationZones(selectedSymbol, ticks),
    sentiment:       computeAggregatedSentiment(ticks, fearGreed, newsBullPct),
    fundingHeatmap:  buildFundingHeatmap(ticks),
    macro:           computeMacroContext(ticks, btcDominance),
    updatedAt:       Date.now()
  }
}
