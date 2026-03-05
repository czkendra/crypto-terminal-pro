import { create } from 'zustand'
import type { ChannelInfo, AuthStatusEvent } from '../../shared/ipcTypes'

interface TelegramState {
  authState: AuthStatusEvent['state']
  authError?: string
  channels: ChannelInfo[]
  watchedChannelIds: string[]

  setAuthState: (state: AuthStatusEvent['state'], error?: string) => void
  setChannels: (channels: ChannelInfo[]) => void
  setWatchedChannelIds: (ids: string[]) => void
  toggleChannel: (id: string) => void
}

export const useTelegramStore = create<TelegramState>((set, get) => ({
  authState: 'idle',
  authError: undefined,
  channels: [],
  watchedChannelIds: [],

  setAuthState: (state, error) => set({ authState: state, authError: error }),
  setChannels: (channels) => set({ channels }),
  setWatchedChannelIds: (ids) => set({ watchedChannelIds: ids }),
  toggleChannel: (id) => {
    const current = get().watchedChannelIds
    const updated = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    set({ watchedChannelIds: updated })
    window.electronAPI?.telegram.setWatchedChannels(updated)
  }
}))
