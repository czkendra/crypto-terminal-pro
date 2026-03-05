import { GlobalMarketStats, FearGreedData, SymbolMarketStats } from '../store/types'

// ---- Fear & Greed ----

interface FngResponse {
  data: Array<{ value: string; value_classification: string; timestamp: string }>
}

function toFearGreedLabel(value: number): FearGreedData['label'] {
  if (value <= 24) return 'Extreme Fear'
  if (value <= 44) return 'Fear'
  if (value <= 55) return 'Neutral'
  if (value <= 74) return 'Greed'
  return 'Extreme Greed'
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1')
  if (!res.ok) throw new Error(`Fear/Greed HTTP ${res.status}`)
  const data: FngResponse = await res.json()
  const entry = data.data[0]
  const value = parseInt(entry.value, 10)
  return {
    value,
    label: toFearGreedLabel(value),
    lastUpdate: parseInt(entry.timestamp, 10) * 1000
  }
}

// ---- CoinGecko Global ----

interface CoinGeckoGlobal {
  data: {
    total_market_cap: { usd: number }
    total_volume: { usd: number }
    market_cap_change_percentage_24h_usd: number
    market_cap_percentage: { btc: number; eth: number }
    updated_at: number
  }
}

export async function fetchGlobalMarketStats(): Promise<GlobalMarketStats> {
  const res = await fetch('https://api.coingecko.com/api/v3/global')
  if (!res.ok) throw new Error(`CoinGecko global HTTP ${res.status}`)
  const data: CoinGeckoGlobal = await res.json()
  const d = data.data
  return {
    totalMarketCap: d.total_market_cap.usd,
    totalVolume24h: d.total_volume.usd,
    marketCapChange24h: d.market_cap_change_percentage_24h_usd,
    btcDominance: d.market_cap_percentage.btc,
    ethDominance: d.market_cap_percentage.eth,
    lastUpdate: d.updated_at * 1000
  }
}

// ---- Binance Futures Market Stats ----

interface BinanceLongShortRatio {
  longShortRatio: string
  longAccount: string
  shortAccount: string
  timestamp: string
}

interface BinanceForceOrder {
  symbol: string
  price: string
  origQty: string
  executedQty: string
  averagePrice: string
  status: string
  timeInForce: string
  type: string
  side: string
  time: number
}

export async function fetchSymbolMarketStats(
  symbol: string,
  high24h: number,
  low24h: number,
  openInterest: number
): Promise<SymbolMarketStats> {
  const [lsRes, liqRes] = await Promise.allSettled([
    fetch(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`
    ),
    fetch(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&limit=20`)
  ])

  let longShortRatio = 0.5
  if (lsRes.status === 'fulfilled' && lsRes.value.ok) {
    const lsData: BinanceLongShortRatio[] = await lsRes.value.json()
    if (lsData.length > 0) {
      longShortRatio = parseFloat(lsData[0].longAccount)
    }
  }

  let recentLiquidations = 0
  if (liqRes.status === 'fulfilled' && liqRes.value.ok) {
    const liqData: BinanceForceOrder[] = await liqRes.value.json()
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    recentLiquidations = liqData.filter((o) => o.time >= oneHourAgo).length
  }

  return {
    symbol,
    longShortRatio,
    openInterest,
    recentLiquidations,
    high24h,
    low24h,
    lastUpdate: Date.now()
  }
}
