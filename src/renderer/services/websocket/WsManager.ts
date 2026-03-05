import { ExchangeAdapter } from '../exchanges/types'
import { UnifiedTick, OrderBookData, ConnectionStatus } from '../../store/types'

type OnTickFn = (tick: UnifiedTick) => void
type OnBookFn = (book: OrderBookData) => void
type OnStatusFn = (exchange: string, status: ConnectionStatus) => void

interface Connection {
  ws: WebSocket | null
  adapter: ExchangeAdapter
  reconnectAttempts: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  enabled: boolean
}

export class WsManager {
  private connections: Map<string, Connection> = new Map()
  private onTick: OnTickFn
  private onBook: OnBookFn
  private onStatus: OnStatusFn
  private pingTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

  constructor(onTick: OnTickFn, onBook: OnBookFn, onStatus: OnStatusFn) {
    this.onTick = onTick
    this.onBook = onBook
    this.onStatus = onStatus
  }

  connect(adapter: ExchangeAdapter): void {
    const conn: Connection = {
      ws: null,
      adapter,
      reconnectAttempts: 0,
      reconnectTimer: null,
      enabled: true
    }
    this.connections.set(adapter.name, conn)
    this.open(adapter.name)
  }

  disconnect(name: string): void {
    const conn = this.connections.get(name)
    if (!conn) return
    conn.enabled = false
    this.clearTimers(name)
    conn.ws?.close()
    conn.ws = null
    this.onStatus(name, 'disconnected')
  }

  disconnectAll(): void {
    for (const name of this.connections.keys()) {
      this.disconnect(name)
    }
    this.connections.clear()
  }

  private open(name: string): void {
    const conn = this.connections.get(name)
    if (!conn || !conn.enabled) return

    this.onStatus(name, 'connecting')
    const url = conn.adapter.getWsUrl()

    try {
      const ws = new WebSocket(url)
      conn.ws = ws

      ws.onopen = () => {
        conn.reconnectAttempts = 0
        this.onStatus(name, 'connected')
        conn.adapter.subscribe(ws, [])
        this.startPing(name, ws, conn.adapter.name)
      }

      ws.onmessage = (event) => {
        const result = conn.adapter.parseMessage(event.data as string)
        if (!result) return
        if (result.type === 'tick') this.onTick(result.data)
        if (result.type === 'orderbook') this.onBook(result.data)
      }

      ws.onclose = () => {
        this.clearPing(name)
        if (!conn.enabled) return
        this.onStatus(name, 'reconnecting')
        this.scheduleReconnect(name)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      this.scheduleReconnect(name)
    }
  }

  private scheduleReconnect(name: string): void {
    const conn = this.connections.get(name)
    if (!conn || !conn.enabled) return

    const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000)
    conn.reconnectAttempts++

    conn.reconnectTimer = setTimeout(() => {
      this.open(name)
    }, delay)
  }

  private startPing(name: string, ws: WebSocket, exchange: string): void {
    this.clearPing(name)
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      if (exchange === 'binance') ws.send(JSON.stringify({ method: 'ping' }))
      if (exchange === 'bybit') ws.send(JSON.stringify({ op: 'ping' }))
      if (exchange === 'okx') ws.send('ping')
    }, 20000)
    this.pingTimers.set(name, interval)
  }

  private clearPing(name: string): void {
    const timer = this.pingTimers.get(name)
    if (timer) clearInterval(timer)
    this.pingTimers.delete(name)
  }

  private clearTimers(name: string): void {
    this.clearPing(name)
    const conn = this.connections.get(name)
    if (conn?.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = null
    }
  }
}
