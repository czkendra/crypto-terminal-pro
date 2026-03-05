import { create } from 'zustand'
import { AiSignal, AiSignalFilter } from './types'

interface AiSignalState {
  signals: AiSignal[]
  scanning: boolean
  lastScan: number | null
  filter: AiSignalFilter
  selectedId: string | null
  scanProgress: number      // 0-100

  setSignals: (signals: AiSignal[]) => void
  addSignals: (signals: AiSignal[]) => void
  setScanning: (v: boolean) => void
  setLastScan: (ts: number) => void
  setFilter: (f: AiSignalFilter) => void
  setSelectedId: (id: string | null) => void
  setScanProgress: (pct: number) => void
  invalidateSignal: (id: string) => void
  updateSignalStatus: (id: string, status: AiSignal['status']) => void
  filteredSignals: () => AiSignal[]
}

export const useAiSignalStore = create<AiSignalState>((set, get) => ({
  signals: [],
  scanning: false,
  lastScan: null,
  filter: 'all',
  selectedId: null,
  scanProgress: 0,

  setSignals: (signals) => set({ signals }),

  addSignals: (incoming) =>
    set((state) => {
      // Merge — deduplicate by symbol+timeframe, keep newest
      const existing = new Map(state.signals.map((s) => [`${s.symbol}-${s.timeframe}`, s]))
      for (const sig of incoming) {
        const key = `${sig.symbol}-${sig.timeframe}`
        const prev = existing.get(key)
        if (!prev || sig.timestamp > prev.timestamp) {
          existing.set(key, sig)
        }
      }
      const merged = Array.from(existing.values())
        .filter((s) => !s.invalidated && s.expiresAt > Date.now())
        .sort((a, b) => b.score - a.score)
        .slice(0, 60)
      return { signals: merged }
    }),

  setScanning: (v) => set({ scanning: v }),
  setLastScan: (ts) => set({ lastScan: ts }),
  setFilter: (f) => set({ filter: f }),
  setSelectedId: (id) => set({ selectedId: id }),
  setScanProgress: (pct) => set({ scanProgress: pct }),

  invalidateSignal: (id) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.id === id ? { ...s, invalidated: true, status: 'expired' } : s
      )
    })),

  updateSignalStatus: (id, status) =>
    set((state) => ({
      signals: state.signals.map((s) => s.id === id ? { ...s, status } : s)
    })),

  filteredSignals: () => {
    const { signals, filter } = get()
    const now = Date.now()
    const active = signals.filter((s) => !s.invalidated && s.expiresAt > now)
    switch (filter) {
      case 'long':   return active.filter((s) => s.direction === 'LONG')
      case 'short':  return active.filter((s) => s.direction === 'SHORT')
      case 'strong': return active.filter((s) => s.strength === 'STRONG')
      case 'recent': return active.filter((s) => now - s.timestamp < 30 * 60 * 1000)
      default:       return active
    }
  }
}))
