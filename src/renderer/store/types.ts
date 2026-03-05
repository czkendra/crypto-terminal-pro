export interface UnifiedTick {
  symbol: string
  exchange: 'binance' | 'bybit' | 'okx'
  price: number
  change24h: number
  volume24h: number
  openInterest: number
  openInterestChange24h: number
  fundingRate: number
  fundingTime: number
  bidPrice: number
  askPrice: number
  high24h: number
  low24h: number
  lastUpdate: number
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface OrderBookData {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  lastUpdate: number
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface ParsedSignal {
  id: string
  raw: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryMin: number
  entryMax: number
  takeProfits: number[]
  stopLoss: number
  leverage?: number
  confidence: number
  channelName: string
  channelId: string
  messageId: number
  timestamp: number
  status: SignalStatus
}

export type SignalStatus = 'pending' | 'active' | 'tp1' | 'tp2' | 'tp3' | 'sl' | 'cancelled'

export interface RawFeedItem {
  id: number
  channelId: string
  channelName: string
  text: string
  timestamp: number
  parsedSignalId?: string
}

export interface NewsItem {
  id: number
  title: string
  url: string
  source: string
  publishedAt: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
  bullishVotes: number
  bearishVotes: number
}

export interface GlobalMarketStats {
  totalMarketCap: number
  totalVolume24h: number
  marketCapChange24h: number
  btcDominance: number
  ethDominance: number
  lastUpdate: number
}

export interface FearGreedData {
  value: number                                                   // 0-100
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  lastUpdate: number
}

export interface SymbolMarketStats {
  symbol: string
  longShortRatio: number       // e.g. 0.52 = 52% long
  openInterest: number
  recentLiquidations: number   // count in last hour
  high24h: number
  low24h: number
  lastUpdate: number
}

export interface PriceAlert {
  id: string
  symbol: string
  type: 'above' | 'below'
  targetPrice: number
  createdAt: number
  triggered: boolean
}

export type TickerSortKey = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'fundingRate' | 'openInterest'
export type TickerSortDir = 'asc' | 'desc'
export type TickerFilter = 'all' | 'gainers' | 'losers' | 'high_funding'
export type SignalFilter = 'all' | 'long' | 'short' | 'high_conf'
export type NewsFilter = 'all' | 'bullish' | 'bearish'

// ---- AI Signal Engine ----

export interface Candle {
  time: number    // unix ms open time
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Chart pattern types
export type ChartPatternType =
  | 'double_top'
  | 'double_bottom'
  | 'head_shoulders'
  | 'inv_head_shoulders'
  | 'bull_flag'
  | 'bear_flag'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle'
  | 'rising_wedge'
  | 'falling_wedge'
  | 'cup_handle'
  | 'bull_pennant'
  | 'bear_pennant'

export interface ChartPattern {
  type: ChartPatternType
  direction: 'LONG' | 'SHORT'
  confidence: number   // 0-100
  description: string
  targetMove: number   // % expected move
  neckline?: number    // for H&S patterns
}

export interface QuantScore {
  zScore: number           // price vs rolling mean in std devs
  momentumFactor: number   // 0-1 momentum score
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme'
  trendStrength: number    // ADX-based 0-100
  meanReversionProb: number // probability price reverts to mean
  breakoutProb: number     // probability of breakout continuation
}

export interface IndicatorSnapshot {
  // EMAs
  ema9: number; ema21: number; ema50: number; ema200: number
  // RSI
  rsi14: number
  // Stochastic RSI
  stochRsiK: number; stochRsiD: number
  // MACD
  macdLine: number; macdSignal: number; macdHist: number
  // Bollinger Bands
  bbUpper: number; bbMid: number; bbLower: number; bbWidth: number
  // ATR
  atr14: number
  // VWAP
  vwap: number; volumeSurge: number; obv: number; obvSlope: number
  // Support / Resistance
  support: number; resistance: number; priceVsVwap: number
  // Futures
  fundingRate: number; openInterest: number
  // ADX / DMI
  adx: number; diPlus: number; diMinus: number
  // Williams %R
  williamsR: number
  // CMF (Chaikin Money Flow)
  cmf: number
  // Supertrend
  supertrend: number; supertrendBull: boolean
  // Ichimoku
  ichimokuTenkan: number; ichimokuKijun: number
  ichimokuSenkouA: number; ichimokuSenkouB: number
  ichimokuCloudBull: boolean
  // Pivot Points
  pivotPoint: number; pivotR1: number; pivotR2: number; pivotR3: number
  pivotS1: number; pivotS2: number; pivotS3: number
  // Quantitative
  quantScore: QuantScore
  // Detected chart patterns
  patterns: ChartPattern[]
}

export type AiSignalStrength = 'STRONG' | 'MODERATE' | 'WEAK'
export type AiSignalTimeframe = '15m' | '1h' | '4h'

export interface AiSignalReason {
  indicator: string
  detail: string
  bullish: boolean
  weight: number
}

export interface AiSignal {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  strength: AiSignalStrength
  score: number
  timeframe: AiSignalTimeframe
  entryPrice: number
  entryZoneLow: number
  entryZoneHigh: number
  tp1: number; tp2: number; tp3: number
  stopLoss: number
  riskRewardRatio: number
  suggestedLeverage: number
  positionSizeRisk: number
  indicators: IndicatorSnapshot
  reasons: AiSignalReason[]
  summary: string
  timestamp: number
  expiresAt: number
  invalidated: boolean
  status: 'active' | 'tp1' | 'tp2' | 'tp3' | 'sl' | 'expired'
  // New fields
  patternName?: string       // top detected chart pattern
  patternConfidence?: number
  quantScore?: QuantScore
  expectedMove?: number      // % expected move based on ATR/patterns
  winRateEstimate?: number   // historical win rate for this pattern+indicator combo
}

export type AiSignalFilter = 'all' | 'long' | 'short' | 'strong' | 'recent'
