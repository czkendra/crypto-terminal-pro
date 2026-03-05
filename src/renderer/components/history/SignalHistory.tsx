import React, { useMemo, useState } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { useMarketStore } from '../../store/marketStore'
import { ParsedSignal, SignalStatus } from '../../store/types'
import './signal-history.css'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function fmtPrice(n: number): string {
  if (!n) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000) return n.toFixed(2)
  return n.toFixed(4)
}

const STATUS_LABELS: Record<SignalStatus, string> = {
  pending: 'PENDING',
  active: 'ACTIVE',
  tp1: 'TP1 HIT',
  tp2: 'TP2 HIT',
  tp3: 'TP3 HIT',
  sl: 'SL HIT',
  cancelled: 'CANCEL'
}

const STATUS_CLASS: Record<SignalStatus, string> = {
  pending: 'warning',
  active: 'info',
  tp1: 'positive',
  tp2: 'positive',
  tp3: 'positive',
  sl: 'negative',
  cancelled: 'dim'
}

function calcPnl(signal: ParsedSignal, currentPrice: number): number | null {
  if (!currentPrice || !signal.entryMin) return null
  const entry = (signal.entryMin + signal.entryMax) / 2
  if (!entry) return null
  const pct = ((currentPrice - entry) / entry) * 100
  return signal.direction === 'LONG' ? pct : -pct
}

function buildCsv(signals: ParsedSignal[], prices: Record<string, number>): string {
  const headers = ['Time', 'Channel', 'Symbol', 'Direction', 'Entry', 'TP1', 'TP2', 'TP3', 'SL', 'Leverage', 'Status', 'P&L%']
  const rows = signals.map((s) => {
    const entry = (s.entryMin + s.entryMax) / 2
    const pnl = calcPnl(s, prices[s.symbol] ?? 0)
    return [
      formatTime(s.timestamp),
      s.channelName,
      s.symbol,
      s.direction,
      entry.toFixed(4),
      s.takeProfits[0]?.toFixed(4) ?? '',
      s.takeProfits[1]?.toFixed(4) ?? '',
      s.takeProfits[2]?.toFixed(4) ?? '',
      s.stopLoss > 0 ? s.stopLoss.toFixed(4) : '',
      s.leverage ? `${s.leverage}x` : '',
      s.status,
      pnl != null ? pnl.toFixed(2) + '%' : ''
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

interface HistoryRowProps {
  signal: ParsedSignal
  currentPrice: number
  onStatusChange: (id: string, status: SignalStatus) => void
}

function HistoryRow({ signal, currentPrice, onStatusChange }: HistoryRowProps) {
  const pnl = calcPnl(signal, currentPrice)
  const pnlClass = pnl == null ? 'dim' : pnl >= 0 ? 'positive' : 'negative'

  return (
    <tr className={`history-row ${signal.direction.toLowerCase()}`}>
      <td className="dim" style={{ fontSize: 'var(--font-size-xs)' }}>
        {formatTime(signal.timestamp)}
      </td>
      <td className="secondary" style={{ overflow: 'hidden', maxWidth: '100px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {signal.channelName}
      </td>
      <td>
        <span className="history-symbol">
          {signal.symbol.replace('USDT', '/USDT')}
        </span>
      </td>
      <td>
        <span className={`direction-badge ${signal.direction.toLowerCase()}`}>
          {signal.direction}
        </span>
      </td>
      <td className="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {signal.entryMin === signal.entryMax
          ? fmtPrice(signal.entryMin)
          : `${fmtPrice(signal.entryMin)}–${fmtPrice(signal.entryMax)}`}
      </td>
      <td className="positive" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-xs)' }}>
        {signal.takeProfits.slice(0, 3).map(fmtPrice).join(' · ') || '--'}
      </td>
      <td className="negative" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {signal.stopLoss > 0 ? fmtPrice(signal.stopLoss) : '--'}
      </td>
      <td className="warning" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {signal.leverage ? `${signal.leverage}x` : '--'}
      </td>
      <td className={pnlClass} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {pnl != null ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : '--'}
      </td>
      <td>
        <select
          className={`history-status-select ${STATUS_CLASS[signal.status]}`}
          value={signal.status}
          onChange={(e) => onStatusChange(signal.id, e.target.value as SignalStatus)}
        >
          {(Object.keys(STATUS_LABELS) as SignalStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </td>
    </tr>
  )
}

type DirFilter = 'all' | 'long' | 'short'
type StatusFilter = 'all' | 'pending' | 'active' | 'won' | 'lost'

export function SignalHistory() {
  const signals = useSignalStore((s) => s.signals)
  const updateSignalStatus = useSignalStore((s) => s.updateSignalStatus)
  const ticks = useMarketStore((s) => s.ticks)
  const [dirFilter, setDirFilter] = useState<DirFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const prices: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [sym, tick] of Object.entries(ticks)) {
      out[sym] = tick.price
    }
    return out
  }, [ticks])

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (dirFilter === 'long' && s.direction !== 'LONG') return false
      if (dirFilter === 'short' && s.direction !== 'SHORT') return false
      if (statusFilter === 'pending' && s.status !== 'pending') return false
      if (statusFilter === 'active' && s.status !== 'active') return false
      if (statusFilter === 'won' && !['tp1', 'tp2', 'tp3'].includes(s.status)) return false
      if (statusFilter === 'lost' && s.status !== 'sl') return false
      return true
    })
  }, [signals, dirFilter, statusFilter])

  async function handleExportCsv() {
    const csv = buildCsv(filtered, prices)
    const filename = `signals-${new Date().toISOString().slice(0, 10)}.csv`
    await window.electronAPI?.dialog?.exportCsv(csv, filename)
  }

  return (
    <div className="terminal-panel signal-history-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">SIGNAL HISTORY</span>
        <div className="history-header-controls">
          <select
            className="history-filter-select"
            value={dirFilter}
            onChange={(e) => setDirFilter(e.target.value as DirFilter)}
          >
            <option value="all">ALL DIR</option>
            <option value="long">LONG</option>
            <option value="short">SHORT</option>
          </select>
          <select
            className="history-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">ALL STATUS</option>
            <option value="pending">PENDING</option>
            <option value="active">ACTIVE</option>
            <option value="won">WON</option>
            <option value="lost">LOST</option>
          </select>
          <span className="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {filtered.length}/{signals.length}
          </span>
          <button className="terminal-btn" onClick={handleExportCsv} title="Export CSV">
            ↓ CSV
          </button>
        </div>
      </div>
      <div className="terminal-panel-body signal-history-body">
        <table className="terminal-table signal-history-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>TIME</th>
              <th style={{ textAlign: 'left' }}>CHANNEL</th>
              <th style={{ textAlign: 'left' }}>SYMBOL</th>
              <th style={{ textAlign: 'left' }}>DIR</th>
              <th>ENTRY</th>
              <th>TARGETS</th>
              <th>SL</th>
              <th>LEV</th>
              <th>P&L</th>
              <th style={{ textAlign: 'left' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sig) => (
              <HistoryRow
                key={sig.id}
                signal={sig}
                currentPrice={prices[sig.symbol] ?? 0}
                onStatusChange={updateSignalStatus}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="dim" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  {signals.length === 0 ? 'No parsed signals yet' : 'No signals match filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
