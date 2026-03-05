import React, { useState, useEffect } from 'react'
import { useMarketStore } from '../../store/marketStore'
import { useUiStore } from '../../store/uiStore'
import { useTelegramStore } from '../../store/telegramStore'
import './topbar.css'

function SystemClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const utc = `${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())}:${pad(time.getUTCSeconds())} UTC`
  const local = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = time.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })

  return (
    <div className="topbar-clock">
      <span className="clock-date">{date}</span>
      <span className="clock-divider">|</span>
      <span className="clock-utc">{utc}</span>
      <span className="clock-divider">|</span>
      <span className="clock-local">{local}</span>
    </div>
  )
}

function ExchangeStatus() {
  const status = useMarketStore((s) => s.exchangeStatus)
  const exchanges = ['binance', 'bybit', 'okx'] as const

  return (
    <div className="topbar-exchange-status">
      {exchanges.map((ex) => (
        <div key={ex} className={`exchange-status-item ${status[ex] || 'disconnected'}`}>
          <span className={`status-dot ${status[ex] || 'disconnected'}`} />
          <span className="exchange-name">{ex.toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

function TelegramStatus() {
  const authState = useTelegramStore((s) => s.authState)
  const statusMap = {
    idle: { label: 'TG: OFFLINE', cls: 'disconnected' },
    sending_code: { label: 'TG: CONNECTING', cls: 'connecting' },
    awaiting_code: { label: 'TG: VERIFY CODE', cls: 'connecting' },
    awaiting_password: { label: 'TG: VERIFY 2FA', cls: 'connecting' },
    connected: { label: 'TG: LIVE', cls: 'connected' },
    error: { label: 'TG: ERROR', cls: 'error' }
  }
  const { label, cls } = statusMap[authState] || statusMap.idle

  return (
    <div className={`topbar-tg-status ${cls}`}>
      <span className={`status-dot ${cls}`} />
      <span>{label}</span>
    </div>
  )
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  return `$${(value / 1e6).toFixed(0)}M`
}

function FearGreedBadge() {
  const fearGreed = useMarketStore((s) => s.fearGreed)
  if (!fearGreed) return <div className="topbar-market-stat fg-loading">F&G: —</div>

  const { value, label } = fearGreed
  let cls = 'fg-neutral'
  if (value <= 24) cls = 'fg-extreme-fear'
  else if (value <= 44) cls = 'fg-fear'
  else if (value <= 55) cls = 'fg-neutral'
  else if (value <= 74) cls = 'fg-greed'
  else cls = 'fg-extreme-greed'

  return (
    <div className={`topbar-market-stat fg-badge ${cls}`} title={label}>
      <span className="stat-label">F&G</span>
      <span className="stat-value">{value}</span>
      <span className="stat-sublabel">{label.toUpperCase()}</span>
    </div>
  )
}

function GlobalStats() {
  const globalStats = useMarketStore((s) => s.globalStats)
  if (!globalStats) return null

  const changeClass = globalStats.marketCapChange24h >= 0 ? 'positive' : 'negative'
  const changeStr = `${globalStats.marketCapChange24h >= 0 ? '+' : ''}${globalStats.marketCapChange24h.toFixed(1)}%`

  return (
    <>
      <div className="topbar-market-stat">
        <span className="stat-label">MCAP</span>
        <span className="stat-value">{formatMarketCap(globalStats.totalMarketCap)}</span>
        <span className={`stat-change ${changeClass}`}>{changeStr}</span>
      </div>
      <div className="topbar-market-stat">
        <span className="stat-label">BTC.D</span>
        <span className="stat-value">{globalStats.btcDominance.toFixed(1)}%</span>
      </div>
      <div className="topbar-market-stat">
        <span className="stat-label">ETH.D</span>
        <span className="stat-value">{globalStats.ethDominance.toFixed(1)}%</span>
      </div>
    </>
  )
}

function AlertBadge() {
  const newSignalCount = useUiStore((s) => s.newSignalCount)
  const clearNewSignals = useUiStore((s) => s.clearNewSignals)

  if (newSignalCount === 0) return null

  return (
    <button
      className="topbar-alert-badge"
      onClick={clearNewSignals}
      title="New signals — click to dismiss"
    >
      <span className="alert-bell">&#9679;</span>
      <span className="alert-count">{newSignalCount}</span>
    </button>
  )
}

export function TopBar() {
  const openSettings = useUiStore((s) => s.openSettings)

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <span className="logo-text">CRYPTO</span>
          <span className="logo-accent">TERMINAL</span>
        </div>
        <SystemClock />
      </div>

      <div className="topbar-center">
        <GlobalStats />
        <FearGreedBadge />
        <div className="topbar-divider" />
        <ExchangeStatus />
        <TelegramStatus />
        <AlertBadge />
      </div>

      <div className="topbar-right">
        <button
          className="terminal-btn topbar-settings-btn"
          onClick={() => openSettings()}
          title="Settings (F1)"
        >
          ⚙ SETTINGS
        </button>
        <span className="topbar-kbd"><kbd>F1</kbd></span>
      </div>
    </div>
  )
}
