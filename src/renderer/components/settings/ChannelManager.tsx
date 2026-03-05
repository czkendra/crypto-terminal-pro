import React, { useEffect, useState } from 'react'
import { useTelegramStore } from '../../store/telegramStore'
import type { ChannelInfo } from '../../../shared/ipcTypes'

export function ChannelManager() {
  const authState = useTelegramStore((s) => s.authState)
  const channels = useTelegramStore((s) => s.channels)
  const watchedChannelIds = useTelegramStore((s) => s.watchedChannelIds)
  const setChannels = useTelegramStore((s) => s.setChannels)
  const toggleChannel = useTelegramStore((s) => s.toggleChannel)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (authState === 'connected' && channels.length === 0) {
      loadChannels()
    }
  }, [authState])

  const loadChannels = async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.telegram.getChannels()
      setChannels(list)
    } finally {
      setLoading(false)
    }
  }

  if (authState !== 'connected') {
    return (
      <div className="channel-not-connected dim">
        Connect Telegram first (see "Telegram" tab)
      </div>
    )
  }

  const filtered = channels.filter(
    (c: ChannelInfo) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.username || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="channel-manager">
      <div className="channel-manager-header">
        <div className="channel-stats secondary">
          {watchedChannelIds.length} of {channels.length} channels watched
        </div>
        <button
          className="terminal-btn"
          onClick={loadChannels}
          disabled={loading}
        >
          {loading ? 'LOADING...' : '↻ REFRESH'}
        </button>
      </div>

      <input
        className="terminal-input"
        type="text"
        placeholder="Search channels..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: '8px' }}
      />

      <div className="channel-list">
        {filtered.map((ch: ChannelInfo) => {
          const isWatched = watchedChannelIds.includes(ch.id)
          return (
            <div
              key={ch.id}
              className={`channel-item ${isWatched ? 'watched' : ''}`}
              onClick={() => toggleChannel(ch.id)}
            >
              <div className="channel-item-left">
                <span className={`channel-watch-indicator ${isWatched ? 'active' : ''}`}>
                  {isWatched ? '◉' : '○'}
                </span>
                <div className="channel-info">
                  <span className="channel-title">{ch.title}</span>
                  {ch.username && (
                    <span className="channel-username dim">@{ch.username}</span>
                  )}
                </div>
              </div>
              <div className="channel-item-right">
                {ch.isPrivate && (
                  <span className="channel-badge-private secondary">PRIVATE</span>
                )}
                {ch.memberCount && (
                  <span className="channel-members dim">
                    {ch.memberCount >= 1000
                      ? `${(ch.memberCount / 1000).toFixed(1)}K`
                      : ch.memberCount}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && !loading && (
          <div className="dim" style={{ textAlign: 'center', padding: '16px' }}>
            {channels.length === 0 ? 'No channels found' : 'No matches for your search'}
          </div>
        )}
      </div>
    </div>
  )
}
