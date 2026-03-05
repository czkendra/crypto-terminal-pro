import { UnifiedTick, OrderBookLevel } from '../../store/types'
import { ExchangeAdapter, ParsedWsMessage, TOP_SYMBOLS } from './types'

const WS_URL = 'wss://stream.bybit.com/v5/public/linear'
const REST_BASE = 'https://api.bybit.com'

export const bybitAdapter: ExchangeAdapter = {
  name: 'bybit',

  getWsUrl(): string {
    return WS_URL
  },

  async getRestSymbols(): Promise<string[]> {
    return TOP_SYMBOLS
  },

  async loadInitialTickers(): Promise<UnifiedTick[]> {
    try {
      const res = await fetch(`${REST_BASE}/v5/market/tickers?category=linear`)
      const json = await res.json() as {
        result: {
          list: Array<{
            symbol: string
            lastPrice: string
            price24hPcnt: string
            turnover24h: string
            bid1Price: string
            ask1Price: string
            fundingRate: string
            nextFundingTime: string
            openInterest: string
          }>
        }
      }

      return json.result.list
        .filter((t) => TOP_SYMBOLS.includes(t.symbol))
        .map((t) => ({
          symbol: t.symbol,
          exchange: 'bybit' as const,
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.price24hPcnt) * 100,
          volume24h: parseFloat(t.turnover24h),
          openInterest: parseFloat(t.openInterest || '0'),
          fundingRate: parseFloat(t.fundingRate || '0'),
          fundingTime: parseInt(t.nextFundingTime || '0'),
          bidPrice: parseFloat(t.bid1Price),
          askPrice: parseFloat(t.ask1Price),
          lastUpdate: Date.now()
        }))
    } catch {
      return []
    }
  },

  subscribe(ws: WebSocket): void {
    const tickerArgs = TOP_SYMBOLS.map((s) => `tickers.${s}`)
    const bookArgs = TOP_SYMBOLS.slice(0, 5).map((s) => `orderbook.20.${s}`)

    ws.send(JSON.stringify({
      op: 'subscribe',
      args: [...tickerArgs, ...bookArgs]
    }))
  },

  parseMessage(data: string): ParsedWsMessage | null {
    try {
      const msg = JSON.parse(data)

      if (msg.op === 'pong' || msg.op === 'ping') return { type: 'ping' }
      if (!msg.topic || !msg.data) return null

      if (msg.topic.startsWith('tickers.')) {
        const t = msg.data as {
          symbol: string
          lastPrice: string
          price24hPcnt: string
          turnover24h: string
          bid1Price: string
          ask1Price: string
          fundingRate: string
          nextFundingTime: string
          openInterest: string
        }

        const tick: UnifiedTick = {
          symbol: t.symbol,
          exchange: 'bybit',
          price: parseFloat(t.lastPrice || '0'),
          change24h: parseFloat(t.price24hPcnt || '0') * 100,
          volume24h: parseFloat(t.turnover24h || '0'),
          openInterest: parseFloat(t.openInterest || '0'),
          fundingRate: parseFloat(t.fundingRate || '0'),
          fundingTime: parseInt(t.nextFundingTime || '0'),
          bidPrice: parseFloat(t.bid1Price || '0'),
          askPrice: parseFloat(t.ask1Price || '0'),
          lastUpdate: Date.now()
        }

        return { type: 'tick', data: tick }
      }

      if (msg.topic.startsWith('orderbook.')) {
        const symbol = msg.topic.split('.')[2]
        const d = msg.data as {
          b?: [string, string][]
          a?: [string, string][]
        }

        const parseLevels = (levels: [string, string][] = []): OrderBookLevel[] => {
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
            bids: parseLevels(d.b),
            asks: parseLevels(d.a),
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
