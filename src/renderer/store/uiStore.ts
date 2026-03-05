import { create } from 'zustand'
import { TickerSortKey, TickerSortDir, TickerFilter, SignalFilter, NewsFilter } from './types'

interface PanelSizes {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
}

interface AlertFormState {
  symbol: string
  type: 'above' | 'below'
  price: string
}

interface UiState {
  selectedSymbol: string
  selectedSignalId: string | null
  isSettingsOpen: boolean
  settingsTab: 'telegram' | 'channels' | 'exchanges' | 'patterns'
  panelSizes: PanelSizes
  tickerFilter: TickerFilter
  tickerSortKey: TickerSortKey
  tickerSortDir: TickerSortDir
  signalFilter: SignalFilter
  newsFilter: NewsFilter
  alertForm: AlertFormState | null
  newSignalCount: number

  setSelectedSymbol: (symbol: string) => void
  setSelectedSignalId: (id: string | null) => void
  openSettings: (tab?: UiState['settingsTab']) => void
  closeSettings: () => void
  setSettingsTab: (tab: UiState['settingsTab']) => void
  setPanelSizes: (sizes: Partial<PanelSizes>) => void
  setTickerFilter: (f: TickerFilter) => void
  setTickerSort: (key: TickerSortKey) => void
  setSignalFilter: (f: SignalFilter) => void
  setNewsFilter: (f: NewsFilter) => void
  openAlertForm: (symbol: string) => void
  closeAlertForm: () => void
  setAlertFormField: (field: keyof AlertFormState, value: string) => void
  incrementNewSignals: () => void
  clearNewSignals: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedSymbol: 'BTCUSDT',
  selectedSignalId: null,
  isSettingsOpen: false,
  settingsTab: 'telegram',
  panelSizes: { leftWidth: 22, rightWidth: 22, bottomHeight: 220 },
  tickerFilter: 'all',
  tickerSortKey: 'volume24h',
  tickerSortDir: 'desc',
  signalFilter: 'all',
  newsFilter: 'all',
  alertForm: null,
  newSignalCount: 0,

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setSelectedSignalId: (id) => set({ selectedSignalId: id }),
  openSettings: (tab) => set({ isSettingsOpen: true, ...(tab ? { settingsTab: tab } : {}) }),
  closeSettings: () => set({ isSettingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setPanelSizes: (sizes) => set((state) => ({ panelSizes: { ...state.panelSizes, ...sizes } })),
  setTickerFilter: (f) => set({ tickerFilter: f }),
  setTickerSort: (key) => {
    const state = get()
    if (state.tickerSortKey === key) {
      set({ tickerSortDir: state.tickerSortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      set({ tickerSortKey: key, tickerSortDir: 'desc' })
    }
  },
  setSignalFilter: (f) => set({ signalFilter: f }),
  setNewsFilter: (f) => set({ newsFilter: f }),
  openAlertForm: (symbol) => set({
    alertForm: { symbol, type: 'above', price: '' }
  }),
  closeAlertForm: () => set({ alertForm: null }),
  setAlertFormField: (field, value) => set((state) => ({
    alertForm: state.alertForm ? { ...state.alertForm, [field]: value } : null
  })),
  incrementNewSignals: () => set((state) => ({ newSignalCount: state.newSignalCount + 1 })),
  clearNewSignals: () => set({ newSignalCount: 0 })
}))
