import { UnifiedTick, OrderBookLevel } from '../../store/types'
import { ExchangeAdapter, ParsedWsMessage, TOP_SYMBOLS } from './types'

const WS_URL = 'wss://fstream.binance.com/stream'
const REST_BASE = 'https://fapi.binance.com'

let fundingRates: Record<string, { rate: number; time: number }> = {}
let openInterests: Record<string, number> = {}

export const binanceAdapter: ExchangeAdapter = {
  name: 'binance',

  getWsUrl(): string {
    const streams = TOP_SYMBOLS.flatMap((s) => [
      `${s.toLowerCase()}@ticker`,
      `${s.toLowerCase()}@depth20@250ms`
    ]).join('/')
    return `${WS_URL}?streams=${streams}/!markPrice@arr@1s`
  },

  async getRestSymbols(): Promise<string[]> {
    return TOP_SYMBOLS
  },

  async loadInitialTickers(): Promise<UnifiedTick[]> {
    try {
      const [tickerRes, fundingRes, oiRes] = await Promise.all([
        fetch(`${REST_BASE}/fapi/v1/ticker/24hr`),
        fetch(`${REST_BASE}/fapi/v1/premiumIndex`),
        fetch(`${REST_BASE}/fapi/v1/openInterest?symbol=BTCUSDT`) // just one to test
      ])

      const tickers = await tickerRes.json() as Array<{
        symbol: string
        lastPrice: string
        priceChangePercent: string
        quoteVolume: string
        bidPrice: string
        askPrice: string
      }>

      const funding = await fundingRes.json() as Array<{
        symbol: string
        lastFundingRate: string
        nextFundingTime: number
      }>

      // Build funding map
      for (const f of funding) {
        fundingRates[f.symbol] = {
          rate: parseFloat(f.lastFundingRate),
          time: f.nextFundingTime
        }
      }

      return tickers
        .filter((t) => TOP_SYMBOLS.includes(t.symbol))
        .map((t) => ({
          symbol: t.symbol,
          exchange: 'binance' as const,
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          volume24h: parseFloat(t.quoteVolume),
          openInterest: openInterests[t.symbol] || 0,
          fundingRate: fundingRates[t.symbol]?.rate || 0,
          fundingTime: fundingRates[t.symbol]?.time || 0,
          bidPrice: parseFloat(t.bidPrice),
          askPrice: parseFloat(t.askPrice),
          lastUpdate: Date.now()
        }))
    } catch {
      return []
    }
  },

  subscribe(ws: WebSocket): void {
    // Streams are already in the URL via query params
    // Send a ping to keep alive
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: 'LIST_SUBSCRIPTIONS', id: 1 }))
    }
  },

  parseMessage(data: string): ParsedWsMessage | null {
    try {
      const msg = JSON.parse(data)

      // Mark price array (funding rates)
      if (msg.stream === '!markPrice@arr@1s' && Array.isArray(msg.data)) {
        for (const item of msg.data as Array<{
          s: string
          r: string
          T: number
        }>) {
          fundingRates[item.s] = {
            rate: parseFloat(item.r),
            time: item.T
          }
        }
        return null
      }

      // Individual stream data
      const streamData = msg.data || msg

      if (streamData.e === '24hrTicker') {
        const tick: UnifiedTick = {
          symbol: streamData.s,
          exchange: 'binance',
          price: parseFloat(streamData.c),
          change24h: parseFloat(streamData.P),
          volume24h: parseFloat(streamData.q),
          openInterest: openInterests[streamData.s] || 0,
          fundingRate: fundingRates[streamData.s]?.rate || 0,
          fundingTime: fundingRates[streamData.s]?.time || 0,
          bidPrice: parseFloat(streamData.b),
          askPrice: parseFloat(streamData.a),
          lastUpdate: Date.now()
        }
        return { type: 'tick', data: tick }
      }

      // Depth / order book
      if (streamData.e === 'depthUpdate' || (streamData.bids && streamData.asks)) {
        const bids = (streamData.bids || streamData.b || []) as [string, string][]
        const asks = (streamData.asks || streamData.a || []) as [string, string][]
        const symbol = streamData.s || (msg.stream || '').replace('@depth20@250ms', '').toUpperCase()

        if (!symbol) return null

        const parseLevels = (levels: [string, string][]): OrderBookLevel[] => {
          let total = 0
          return levels.slice(0, 20).map(([p, s]) => {
            const size = parseFloat(s)
            total += size
            return { price: parseFloat(p), size, total }
          })
        }

        return {
          type: 'orderbook',
          data: {
            symbol,
            bids: parseLevels(bids),
            asks: parseLevels(asks),
            lastUpdate: Date.now()
          }
        }
      }

      return null
    } catch {
      return null
    }
  }
}
