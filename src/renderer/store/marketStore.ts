import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  UnifiedTick, OrderBookData, ConnectionStatus,
  GlobalMarketStats, FearGreedData, SymbolMarketStats, PriceAlert
} from './types'

interface MarketState {
  ticks: Record<string, UnifiedTick>
  orderBooks: Record<string, OrderBookData>
  exchangeStatus: Record<string, ConnectionStatus>
  globalStats: GlobalMarketStats | null
  fearGreed: FearGreedData | null
  symbolStats: Record<string, SymbolMarketStats>
  priceAlerts: PriceAlert[]
  triggeredAlerts: PriceAlert[]

  updateTick: (tick: UnifiedTick) => void
  updateOrderBook: (data: OrderBookData) => void
  setExchangeStatus: (exchange: string, status: ConnectionStatus) => void
  setGlobalStats: (stats: GlobalMarketStats) => void
  setFearGreed: (data: FearGreedData) => void
  setSymbolStats: (stats: SymbolMarketStats) => void
  addPriceAlert: (alert: PriceAlert) => void
  removePriceAlert: (id: string) => void
  clearTriggeredAlerts: () => void
  getTopByVolume: (n: number) => UnifiedTick[]
}

export const useMarketStore = create<MarketState>()(
  immer((set, get) => ({
    ticks: {},
    orderBooks: {},
    exchangeStatus: {
      binance: 'disconnected',
      bybit: 'disconnected',
      okx: 'disconnected'
    },
    globalStats: null,
    fearGreed: null,
    symbolStats: {},
    priceAlerts: [],
    triggeredAlerts: [],

    updateTick: (tick) =>
      set((state) => {
        const existing = state.ticks[tick.symbol]
        if (!existing || tick.lastUpdate >= existing.lastUpdate) {
          state.ticks[tick.symbol] = tick
        }
        // Check price alerts
        for (const alert of state.priceAlerts) {
          if (alert.triggered || alert.symbol !== tick.symbol) continue
          const triggered =
            (alert.type === 'above' && tick.price >= alert.targetPrice) ||
            (alert.type === 'below' && tick.price <= alert.targetPrice)
          if (triggered) {
            alert.triggered = true
            state.triggeredAlerts.unshift({ ...alert })
          }
        }
      }),

    updateOrderBook: (data) =>
      set((state) => {
        state.orderBooks[data.symbol] = data
      }),

    setExchangeStatus: (exchange, status) =>
      set((state) => {
        state.exchangeStatus[exchange] = status
      }),

    setGlobalStats: (stats) =>
      set((state) => {
        state.globalStats = stats
      }),

    setFearGreed: (data) =>
      set((state) => {
        state.fearGreed = data
      }),

    setSymbolStats: (stats) =>
      set((state) => {
        state.symbolStats[stats.symbol] = stats
      }),

    addPriceAlert: (alert) =>
      set((state) => {
        state.priceAlerts.push(alert)
      }),

    removePriceAlert: (id) =>
      set((state) => {
        state.priceAlerts = state.priceAlerts.filter((a) => a.id !== id) as PriceAlert[]
      }),

    clearTriggeredAlerts: () =>
      set((state) => {
        state.triggeredAlerts = []
      }),

    getTopByVolume: (n) =>
      Object.values(get().ticks)
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, n)
  }))
)
