import { UnifiedTick, OrderBookData } from '../../store/types'

export interface ExchangeAdapter {
  name: 'binance' | 'bybit' | 'okx'
  getWsUrl(): string
  getRestSymbols(): Promise<string[]>
  loadInitialTickers(): Promise<UnifiedTick[]>
  subscribe(ws: WebSocket, symbols: string[]): void
  parseMessage(data: string): ParsedWsMessage | null
}

export type ParsedWsMessage =
  | { type: 'tick'; data: UnifiedTick }
  | { type: 'orderbook'; data: OrderBookData }
  | { type: 'ping' }

export const TOP_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT',
  'OPUSDT', 'ARBUSDT', 'AAVEUSDT', 'FTMUSDT', 'INJUSDT'
]
