import { UnifiedTick, OrderBookLevel } from '../../store/types'
import { ExchangeAdapter, ParsedWsMessage, TOP_SYMBOLS } from './types'

const WS_URL = 'wss://ws.okx.com:8443/ws/v5/public'
const REST_BASE = 'https://www.okx.com'

// OKX uses BTC-USDT-SWAP format
function toOkxSymbol(symbol: string): string {
  const base = symbol.replace('USDT', '')
  return `${base}-USDT-SWAP`
}

function fromOkxSymbol(instId: string): string {
  return instId.replace('-SWAP', '').replace('-', '')
}

export const okxAdapter: ExchangeAdapter = {
  name: 'okx',

  getWsUrl(): string {
    return WS_URL
  },

  async getRestSymbols(): Promise<string[]> {
    return TOP_SYMBOLS
  },

  async loadInitialTickers(): Promise<UnifiedTick[]> {
    try {
      const instIds = TOP_SYMBOLS.map(toOkxSymbol).join(',')
      const [tickerRes, fundingRes] = await Promise.all([
        fetch(`${REST_BASE}/api/v5/market/tickers?instType=SWAP`),
        fetch(`${REST_BASE}/api/v5/public/funding-rate?instId=BTC-USDT-SWAP`)
      ])

      const tickerJson = await tickerRes.json() as {
        data: Array<{
          instId: string
          last: string
          open24h: string
          volCcy24h: string
          bidPx: string
          askPx: string
        }>
      }

      void instIds
      void fundingRes

      return tickerJson.data
        .filter((t) => {
          const symbol = fromOkxSymbol(t.instId)
          return TOP_SYMBOLS.includes(symbol) && t.instId.endsWith('-USDT-SWAP')
        })
        .map((t) => {
          const open = parseFloat(t.open24h)
          const last = parseFloat(t.last)
          const change24h = open > 0 ? ((last - open) / open) * 100 : 0

          return {
            symbol: fromOkxSymbol(t.instId),
            exchange: 'okx' as const,
            price: last,
            change24h,
            volume24h: parseFloat(t.volCcy24h),
            openInterest: 0,
            fundingRate: 0,
            fundingTime: 0,
            bidPrice: parseFloat(t.bidPx),
            askPrice: parseFloat(t.askPx),
            lastUpdate: Date.now()
          }
        })
    } catch {
      return []
    }
  },

  subscribe(ws: WebSocket): void {
    const tickerArgs = TOP_SYMBOLS.map((s) => ({
      channel: 'tickers',
      instId: toOkxSymbol(s)
    }))
    const bookArgs = TOP_SYMBOLS.slice(0, 5).map((s) => ({
      channel: 'books5',
      instId: toOkxSymbol(s)
    }))

    ws.send(JSON.stringify({
      op: 'subscribe',
      args: [...tickerArgs, ...bookArgs]
    }))
  },

  parseMessage(data: string): ParsedWsMessage | null {
    try {
      const msg = JSON.parse(data)

      if (msg.event === 'pong' || data === 'pong') return { type: 'ping' }
      if (!msg.arg || !msg.data) return null

      const channel = msg.arg.channel
      const instId = msg.arg.instId as string
      const symbol = fromOkxSymbol(instId)

      if (channel === 'tickers' && Array.isArray(msg.data) && msg.data.length > 0) {
        const t = msg.data[0] as {
          last: string
          open24h: string
          volCcy24h: string
          bidPx: string
          askPx: string
          fundingRate?: string
          nextFundingTime?: string
          openInterest?: string
        }

        const open = parseFloat(t.open24h)
        const last = parseFloat(t.last)
        const change24h = open > 0 ? ((last - open) / open) * 100 : 0

        const tick: UnifiedTick = {
          symbol,
          exchange: 'okx',
          price: last,
          change24h,
          volume24h: parseFloat(t.volCcy24h || '0'),
          openInterest: parseFloat(t.openInterest || '0'),
          fundingRate: parseFloat(t.fundingRate || '0'),
          fundingTime: parseInt(t.nextFundingTime || '0'),
          bidPrice: parseFloat(t.bidPx || '0'),
          askPrice: parseFloat(t.askPx || '0'),
          lastUpdate: Date.now()
        }

        return { type: 'tick', data: tick }
      }

      if (channel === 'books5' && Array.isArray(msg.data) && msg.data.length > 0) {
        const book = msg.data[0] as {
          bids: [string, string][]
          asks: [string, string][]
        }

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
            bids: parseLevels(book.bids || []),
            asks: parseLevels(book.asks || []),
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
