import React, { useMemo } from 'react'
import { useMarketStore } from '../../store/marketStore'
import { useUiStore } from '../../store/uiStore'
import { UnifiedTick, TickerSortKey, TickerFilter } from '../../store/types'
import { useFlashEffect } from '../../hooks/useFlashEffect'
import './price-ticker.css'

function fmt(n: number, decimals = 2): string {
  if (!n || isNaN(n)) return '--'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(decimals)
}

function fmtPrice(n: number): string {
  if (!n || isNaN(n)) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(6)
}

function fmtFunding(rate: number): string {
  if (!rate || isNaN(rate)) return '--'
  return `${(rate * 100).toFixed(4)}%`
}

function fmtOiChange(v: number): string {
  if (!v || isNaN(v)) return '--'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

interface TickerRowProps {
  tick: UnifiedTick
  isSelected: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function TickerRow({ tick, isSelected, onClick, onContextMenu }: TickerRowProps) {
  const flashRef = useFlashEffect(tick.price)
  const isPositive = tick.change24h >= 0
  const fundingPositive = tick.fundingRate >= 0
  const oiPositive = (tick.openInterestChange24h ?? 0) >= 0

  return (
    <tr
      ref={flashRef as React.RefCallback<HTMLTableRowElement>}
      className={`ticker-row${isSelected ? ' selected' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <td className="ticker-symbol">
        <span className="symbol-base">{tick.symbol.replace('USDT', '')}</span>
        <span className="symbol-quote">/USDT</span>
      </td>
      <td className={`ticker-price ${isPositive ? 'positive' : 'negative'}`}>
        {fmtPrice(tick.price)}
      </td>
      <td className={`ticker-change ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{tick.change24h.toFixed(2)}%
      </td>
      <td className="ticker-volume secondary">
        {fmt(tick.volume24h)}
      </td>
      <td className={`ticker-oi-change ${oiPositive ? 'positive' : 'negative'}`}>
        {fmtOiChange(tick.openInterestChange24h)}
      </td>
      <td className={`ticker-funding ${fundingPositive ? 'positive' : 'negative'}`}>
        {fmtFunding(tick.fundingRate)}
      </td>
      <td className="ticker-exchange dim">
        {tick.exchange.slice(0, 3).toUpperCase()}
      </td>
    </tr>
  )
}

const FILTER_TABS: { key: TickerFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'gainers', label: 'GAINERS' },
  { key: 'losers', label: 'LOSERS' },
  { key: 'high_funding', label: 'HIGH FUNDING' }
]

const SORT_KEYS: { key: TickerSortKey; label: string }[] = [
  { key: 'symbol', label: 'SYMBOL' },
  { key: 'price', label: 'PRICE' },
  { key: 'change24h', label: '24H%' },
  { key: 'volume24h', label: 'VOLUME' },
  { key: 'openInterest', label: 'OI CHG' },
  { key: 'fundingRate', label: 'FUNDING' }
]

function applyFilter(ticks: UnifiedTick[], filter: TickerFilter): UnifiedTick[] {
  switch (filter) {
    case 'gainers': return ticks.filter((t) => t.change24h > 0)
    case 'losers': return ticks.filter((t) => t.change24h < 0)
    case 'high_funding': return ticks.filter((t) => Math.abs(t.fundingRate) > 0.0003)
    default: return ticks
  }
}

function applySort(
  ticks: UnifiedTick[],
  key: TickerSortKey,
  dir: 'asc' | 'desc'
): UnifiedTick[] {
  const sorted = [...ticks].sort((a, b) => {
    let va: number | string = 0
    let vb: number | string = 0
    switch (key) {
      case 'symbol': va = a.symbol; vb = b.symbol; break
      case 'price': va = a.price; vb = b.price; break
      case 'change24h': va = a.change24h; vb = b.change24h; break
      case 'volume24h': va = a.volume24h; vb = b.volume24h; break
      case 'openInterest': va = a.openInterestChange24h ?? 0; vb = b.openInterestChange24h ?? 0; break
      case 'fundingRate': va = Math.abs(a.fundingRate); vb = Math.abs(b.fundingRate); break
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
  return sorted
}

export function PriceTicker() {
  const allTicks = useMarketStore((s) => Object.values(s.ticks))
  const selectedSymbol = useUiStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useUiStore((s) => s.setSelectedSymbol)
  const tickerFilter = useUiStore((s) => s.tickerFilter)
  const setTickerFilter = useUiStore((s) => s.setTickerFilter)
  const tickerSortKey = useUiStore((s) => s.tickerSortKey)
  const tickerSortDir = useUiStore((s) => s.tickerSortDir)
  const setTickerSort = useUiStore((s) => s.setTickerSort)
  const openAlertForm = useUiStore((s) => s.openAlertForm)

  const ticks = useMemo(() => {
    const filtered = applyFilter(allTicks, tickerFilter)
    return applySort(filtered, tickerSortKey, tickerSortDir).slice(0, 50)
  }, [allTicks, tickerFilter, tickerSortKey, tickerSortDir])

  return (
    <div className="terminal-panel price-ticker-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">CRYPTO FUTURES</span>
        <span className="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
          {ticks.length} INSTRUMENTS
        </span>
      </div>

      <div className="ticker-filter-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ticker-filter-tab${tickerFilter === tab.key ? ' active' : ''}`}
            onClick={() => setTickerFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="terminal-panel-body price-ticker-body">
        <table className="terminal-table price-ticker-table">
          <thead>
            <tr>
              {SORT_KEYS.map((col) => (
                <th
                  key={col.key}
                  className={`sortable-th${tickerSortKey === col.key ? ' sort-active' : ''}`}
                  style={{ textAlign: col.key === 'symbol' ? 'left' : undefined }}
                  onClick={() => setTickerSort(col.key)}
                >
                  {col.label}
                  {tickerSortKey === col.key && (
                    <span className="sort-arrow">{tickerSortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
              <th>EXCH</th>
            </tr>
          </thead>
          <tbody>
            {ticks.map((tick) => (
              <TickerRow
                key={`${tick.symbol}-${tick.exchange}`}
                tick={tick}
                isSelected={tick.symbol === selectedSymbol}
                onClick={() => setSelectedSymbol(tick.symbol)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openAlertForm(tick.symbol)
                }}
              />
            ))}
            {ticks.length === 0 && (
              <tr>
                <td colSpan={7} className="ticker-empty dim">
                  {allTicks.length === 0 ? 'Connecting to exchanges...' : 'No instruments match filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
