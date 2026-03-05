import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { ParsedSignal, RawFeedItem, SignalStatus } from './types'

const MAX_RAW_FEED = 300
const MAX_SIGNALS = 200

interface SignalState {
  rawFeed: RawFeedItem[]
  signals: ParsedSignal[]

  addRawMessage: (item: RawFeedItem) => void
  addParsedSignal: (signal: ParsedSignal) => void
  updateSignalStatus: (id: string, status: SignalStatus) => void
  clearFeed: () => void
}

export const useSignalStore = create<SignalState>()(
  immer((set) => ({
    rawFeed: [],
    signals: [],

    addRawMessage: (item) =>
      set((state) => {
        state.rawFeed.unshift(item)
        if (state.rawFeed.length > MAX_RAW_FEED) {
          state.rawFeed.length = MAX_RAW_FEED
        }
      }),

    addParsedSignal: (signal) =>
      set((state) => {
        state.signals.unshift(signal)
        if (state.signals.length > MAX_SIGNALS) {
          state.signals.length = MAX_SIGNALS
        }
      }),

    updateSignalStatus: (id, status) =>
      set((state) => {
        const signal = state.signals.find((s) => s.id === id)
        if (signal) signal.status = status
      }),

    clearFeed: () =>
      set((state) => {
        state.rawFeed = []
      })
  }))
)
