import React from 'react'
import { useMarketStore } from '../../store/marketStore'
import { useUiStore } from '../../store/uiStore'
import { OrderBookLevel } from '../../store/types'
import './orderbook.css'

function fmtPrice(n: number): string {
  if (!n) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(6)
}

function fmtSize(n: number): string {
  if (!n) return '--'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  return n.toFixed(3)
}

interface BookSideProps {
  levels: OrderBookLevel[]
  side: 'bid' | 'ask'
  maxTotal: number
}

function BookSide({ levels, side, maxTotal }: BookSideProps) {
  return (
    <>
      {levels.map((level, i) => {
        const depthPct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0
        return (
          <tr key={i} className={`book-row book-${side}`}>
            <td className={`book-price ${side === 'bid' ? 'positive' : 'negative'}`}>
              {fmtPrice(level.price)}
            </td>
            <td className="book-size secondary">
              {fmtSize(level.size)}
            </td>
            <td className="book-depth-cell">
              <div
                className={`book-depth-bar ${side}`}
                style={{ width: `${depthPct}%` }}
              />
              <span className="book-total dim">{fmtSize(level.total)}</span>
            </td>
          </tr>
        )
      })}
    </>
  )
}

export function OrderBook() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol)
  const orderBooks = useMarketStore((s) => s.orderBooks)
  const ticks = useMarketStore((s) => s.ticks)

  const book = orderBooks[selectedSymbol]
  const tick = ticks[selectedSymbol]

  const bids = book?.bids.slice(0, 15) || []
  const asks = book?.asks.slice(0, 15) || []

  const maxBidTotal = bids[bids.length - 1]?.total || 1
  const maxAskTotal = asks[asks.length - 1]?.total || 1
  const maxTotal = Math.max(maxBidTotal, maxAskTotal)

  const spread = tick ? tick.askPrice - tick.bidPrice : 0
  const spreadBps = tick && tick.price > 0 ? (spread / tick.price) * 10000 : 0

  return (
    <div className="terminal-panel orderbook-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">ORDER BOOK</span>
        <span className="accent" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          {selectedSymbol.replace('USDT', '/USDT')}
        </span>
      </div>

      <div className="terminal-panel-body orderbook-body">
        {/* Asks (top, reversed - lowest ask at bottom) */}
        <div className="orderbook-asks-section">
          <table className="terminal-table orderbook-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>ASK</th>
                <th>SIZE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <BookSide levels={[...asks].reverse()} side="ask" maxTotal={maxTotal} />
            </tbody>
          </table>
        </div>

        {/* Spread indicator */}
        <div className="orderbook-spread">
          <span className="spread-label dim">SPREAD</span>
          <span className="spread-value warning">
            {spread > 0 ? fmtPrice(spread) : '--'}
          </span>
          <span className="spread-bps dim">
            {spreadBps > 0 ? `${spreadBps.toFixed(2)} bps` : ''}
          </span>
          {tick && (
            <span className="spread-mid accent">
              {fmtPrice(tick.price)}
            </span>
          )}
        </div>

        {/* Bids (bottom) */}
        <div className="orderbook-bids-section">
          <table className="terminal-table orderbook-table">
            <tbody>
              <BookSide levels={bids} side="bid" maxTotal={maxTotal} />
            </tbody>
          </table>
        </div>

        {!book && (
          <div className="orderbook-empty dim">
            Select a symbol to view order book
          </div>
        )}
      </div>
    </div>
  )
}
