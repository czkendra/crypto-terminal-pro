import React, { useRef, useEffect, useState, useMemo } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { useUiStore } from '../../store/uiStore'
import { RawFeedItem, ParsedSignal, SignalFilter } from '../../store/types'
import './signal-feed.css'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function fmtPrice(n: number): string {
  if (!n) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000) return n.toFixed(2)
  return n.toFixed(4)
}

function confidenceClass(conf: number): string {
  if (conf >= 0.8) return 'conf-high'
  if (conf >= 0.6) return 'conf-med'
  return 'conf-low'
}

function copySignalText(signal: ParsedSignal): void {
  const tps = signal.takeProfits.map((tp, i) => `TP${i + 1}: ${fmtPrice(tp)}`).join(' | ')
  const lines = [
    `${signal.direction} ${signal.symbol.replace('USDT', '/USDT')}${signal.leverage ? ` ${signal.leverage}x` : ''}`,
    `Entry: ${signal.entryMin === signal.entryMax ? fmtPrice(signal.entryMin) : `${fmtPrice(signal.entryMin)}-${fmtPrice(signal.entryMax)}`}`,
    tps || null,
    signal.stopLoss > 0 ? `SL: ${fmtPrice(signal.stopLoss)}` : null,
    `Conf: ${Math.round(signal.confidence * 100)}% | Source: #${signal.channelName}`
  ].filter(Boolean).join('\n')
  navigator.clipboard.writeText(lines)
}

function openTradingView(symbol: string): void {
  const base = symbol.replace('USDT', '')
  const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${base}USDT.P`
  window.electronAPI?.shell?.openExternal(url)
}

const FILTER_TABS: { key: SignalFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'long', label: 'LONG' },
  { key: 'short', label: 'SHORT' },
  { key: 'high_conf', label: 'HIGH CONF' }
]

interface SignalCardProps {
  signal: ParsedSignal
}

function SignalCard({ signal }: SignalCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copySignalText(signal)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleTv = (e: React.MouseEvent) => {
    e.stopPropagation()
    openTradingView(signal.symbol)
  }

  const confCls = confidenceClass(signal.confidence)

  return (
    <div className={`signal-card ${signal.direction.toLowerCase()} ${confCls} slide-in`}>
      <div className="signal-card-header">
        <span className={`direction-badge ${signal.direction.toLowerCase()}`}>
          {signal.direction}
        </span>
        <span className="signal-symbol accent">{signal.symbol.replace('USDT', '/USDT')}</span>
        {signal.leverage && (
          <span className="signal-leverage warning">{signal.leverage}x</span>
        )}
        <span className="signal-time dim">{formatTime(signal.timestamp)}</span>
      </div>

      <div className="signal-card-body">
        <div className="signal-row">
          <span className="signal-label dim">ENTRY</span>
          <span className="signal-value">
            {signal.entryMin === signal.entryMax
              ? fmtPrice(signal.entryMin)
              : `${fmtPrice(signal.entryMin)} – ${fmtPrice(signal.entryMax)}`}
          </span>
        </div>

        {signal.takeProfits.length > 0 && (
          <div className="signal-row">
            <span className="signal-label dim">TP</span>
            <span className="signal-value positive">
              {signal.takeProfits.map((tp, i) => (
                <span key={i} className="signal-tp">
                  {i > 0 && <span className="signal-sep">·</span>}
                  {fmtPrice(tp)}
                </span>
              ))}
            </span>
          </div>
        )}

        {signal.stopLoss > 0 && (
          <div className="signal-row">
            <span className="signal-label dim">SL</span>
            <span className="signal-value negative">{fmtPrice(signal.stopLoss)}</span>
          </div>
        )}
      </div>

      <div className="signal-card-footer">
        <span className="signal-channel secondary">#{signal.channelName}</span>
        <span className="signal-confidence dim">{Math.round(signal.confidence * 100)}% conf</span>
        <div className="signal-actions">
          <button className="signal-action-btn" onClick={handleTv} title="Open in TradingView">TV</button>
          <button className="signal-action-btn" onClick={handleCopy} title="Copy signal">
            {copied ? '✓' : 'COPY'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RawMessageRowProps {
  item: RawFeedItem
}

function RawMessageRow({ item }: RawMessageRowProps) {
  const preview = item.text.slice(0, 120) + (item.text.length > 120 ? '...' : '')

  return (
    <div className="raw-message-row">
      <div className="raw-message-meta">
        <span className="raw-channel secondary">#{item.channelName}</span>
        <span className="raw-time dim">{formatTime(item.timestamp)}</span>
      </div>
      <div className="raw-message-text secondary">{preview}</div>
    </div>
  )
}

export function SignalFeed() {
  const rawFeed = useSignalStore((s) => s.rawFeed)
  const signals = useSignalStore((s) => s.signals)
  const signalFilter = useUiStore((s) => s.signalFilter)
  const setSignalFilter = useUiStore((s) => s.setSignalFilter)
  const [locked, setLocked] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(rawFeed.length)

  useEffect(() => {
    if (locked && rawFeed.length !== prevLengthRef.current) {
      scrollRef.current?.scrollTo({ top: 0 })
    }
    prevLengthRef.current = rawFeed.length
  }, [rawFeed.length, locked])

  const signalMap = useMemo(() => {
    const map = new Map<number, ParsedSignal>()
    for (const sig of signals) map.set(sig.messageId, sig)
    return map
  }, [signals])

  const filteredFeed = useMemo(() => {
    if (signalFilter === 'all') return rawFeed
    return rawFeed.filter((item) => {
      const parsed = signalMap.get(item.id)
      if (!parsed) return false
      if (signalFilter === 'long') return parsed.direction === 'LONG'
      if (signalFilter === 'short') return parsed.direction === 'SHORT'
      if (signalFilter === 'high_conf') return parsed.confidence >= 0.8
      return true
    })
  }, [rawFeed, signalFilter, signalMap])

  return (
    <div className="terminal-panel signal-feed-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">SIGNAL FEED</span>
        <div className="terminal-panel-actions">
          <span className={`feed-live-dot ${rawFeed.length > 0 ? 'blink' : ''}`}>●</span>
          <span className="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {signals.length} PARSED
          </span>
          <button
            className={`terminal-btn ${locked ? 'primary' : ''}`}
            onClick={() => setLocked(!locked)}
            title={locked ? 'Auto-scroll on' : 'Auto-scroll off'}
          >
            {locked ? '⬇ AUTO' : '⏸ PAUSE'}
          </button>
        </div>
      </div>

      <div className="signal-filter-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`signal-filter-tab${signalFilter === tab.key ? ' active' : ''}`}
            onClick={() => setSignalFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="terminal-panel-body signal-feed-body" ref={scrollRef}>
        {filteredFeed.length === 0 && (
          <div className="signal-feed-empty dim">
            <div>{rawFeed.length === 0 ? 'Waiting for signals...' : 'No signals match filter'}</div>
            {rawFeed.length === 0 && (
              <div className="feed-empty-hint">Connect Telegram in Settings (F1)</div>
            )}
          </div>
        )}

        {filteredFeed.map((item) => {
          const parsed = signalMap.get(item.id)
          if (parsed) {
            return <SignalCard key={`s-${item.id}`} signal={parsed} />
          }
          return <RawMessageRow key={`r-${item.id}`} item={item} />
        })}
      </div>
    </div>
  )
}
