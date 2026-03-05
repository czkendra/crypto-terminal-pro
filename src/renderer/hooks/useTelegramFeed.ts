import { useEffect } from 'react'
import { useTelegramStore, useSignalStore } from '../store'
import { parseSignal } from '../services/signalParser'
import { playTelegramMessage, playTelegramSignal } from '../services/soundService'
import type { TelegramMessage, AuthStatusEvent } from '../../shared/ipcTypes'

export function useTelegramFeed(): void {
  const { setAuthState, setChannels, setWatchedChannelIds } = useTelegramStore()
  const { addRawMessage, addParsedSignal } = useSignalStore()

  useEffect(() => {
    if (!window.electronAPI) return

    // Restore initial state
    window.electronAPI.telegram.getStatus().then((status: AuthStatusEvent) => {
      setAuthState(status.state, status.error)
    })

    window.electronAPI.telegram.getWatchedChannels().then((ids: string[]) => {
      setWatchedChannelIds(ids)
    })

    // Listen for auth state changes
    const removeStatus = window.electronAPI.telegram.onAuthStatus((status: AuthStatusEvent) => {
      setAuthState(status.state, status.error)
      if (status.state === 'connected') {
        window.electronAPI.telegram.getChannels().then(setChannels)
        window.electronAPI.telegram.getWatchedChannels().then(setWatchedChannelIds)
      }
    })

    // Listen for incoming messages
    const removeMessage = window.electronAPI.telegram.onMessage((msg: TelegramMessage) => {
      addRawMessage({
        id: msg.id,
        channelId: msg.channelId,
        channelName: msg.channelName,
        text: msg.text,
        timestamp: msg.timestamp
      })

      const parsed = parseSignal(
        msg.text,
        msg.channelId,
        msg.channelName,
        msg.id,
        msg.timestamp
      )

      if (parsed) {
        addParsedSignal(parsed)
        playTelegramSignal(parsed.direction)
      } else {
        playTelegramMessage()
      }
    })

    return () => {
      if (typeof removeStatus === 'function') removeStatus()
      if (typeof removeMessage === 'function') removeMessage()
    }
  }, [addRawMessage, addParsedSignal, setAuthState, setChannels, setWatchedChannelIds])
}
