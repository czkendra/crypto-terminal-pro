import { create } from 'zustand'

interface SettingsState {
  exchanges: {
    binance: boolean
    bybit: boolean
    okx: boolean
  }
  loaded: boolean

  setExchangeEnabled: (exchange: 'binance' | 'bybit' | 'okx', enabled: boolean) => void
  loadFromMain: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  exchanges: { binance: true, bybit: true, okx: true },
  loaded: false,

  setExchangeEnabled: (exchange, enabled) => {
    set((state) => ({
      exchanges: { ...state.exchanges, [exchange]: enabled }
    }))
    const updated = { ...get().exchanges, [exchange]: enabled }
    window.electronAPI?.settings.set('exchanges', updated)
  },

  loadFromMain: async () => {
    if (!window.electronAPI) return
    const all = await window.electronAPI.settings.getAll()
    set({
      exchanges: all.exchanges || { binance: true, bybit: true, okx: true },
      loaded: true
    })
  }
}))
