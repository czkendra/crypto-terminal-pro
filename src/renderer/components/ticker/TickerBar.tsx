/**
 * TickerBar — scrolling live price ticker strip shown below the top bar.
 * Auto-updates from the Zustand market store (WebSocket-driven ticks).
 */
import React, { useEffect, useRef, useState } from 'react'
import { useMarketStore } from '../../store/marketStore'
import './ticker-bar.css'

// Symbols to show in ticker (major perps)
const TICKER_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'LTCUSDT', 'MATICUSDT',
  'ADAUSDT', 'DOTUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT',
  'APTUSDT', 'OPUSDT', 'ARBUSDT', 'INJUSDT', 'SUIUSDT'
]

// Simple coin emoji mapping for visual flair (logos as emoji/text)
const COIN_ICONS: Record<string, string> = {
  BTCUSDT: '₿',
  ETHUSDT: 'Ξ',
  BNBUSDT: 'B',
  SOLUSDT: '◎',
  XRPUSDT: '✕',
  DOGEUSDT: 'Ð',
  AVAXUSDT: '△',
  LINKUSDT: '⬡',
  LTCUSDT: 'Ł',
  MATICUSDT: '⬡',
  ADAUSDT: '₳',
  DOTUSDT: '●',
  UNIUSDT: '🦄',
  ATOMUSDT: '⚛',
  NEARUSDT: 'N',
  APTUSDT: 'A',
  OPUSDT: 'O',
  ARBUSDT: 'A',
  INJUSDT: 'I',
  SUIUSDT: 'S'
}

function fmtPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0)
  if (price >= 1000)  return price.toFixed(1)
  if (price >= 1)     return price.toFixed(3)
  return price.toFixed(5)
}

interface TickerItem {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  fundingRate: number
}

function TickerCell({ item }: { item: TickerItem }) {
  const changeUp = item.change24h >= 0
  const name = item.symbol.replace('USDT', '')
  const icon = COIN_ICONS[item.symbol] || name[0]
  const fr = item.fundingRate * 100

  return (
    <div className="ticker-cell">
      <span className="ticker-icon">{icon}</span>
      <span className="ticker-name">{name}</span>
      <span className="ticker-price">{fmtPrice(item.price)}</span>
      <span className={`ticker-change ${changeUp ? 'up' : 'down'}`}>
        {changeUp ? '▲' : '▼'} {Math.abs(item.change24h).toFixed(2)}%
      </span>
      <span className={`ticker-fr ${fr > 0.05 ? 'fr-high' : fr < -0.02 ? 'fr-low' : 'fr-neutral'}`}>
        FR:{fr.toFixed(4)}%
      </span>
    </div>
  )
}

export function TickerBar() {
  const ticks = useMarketStore((s) => s.ticks)
  const [items, setItems] = useState<TickerItem[]>([])

  // Build ticker items from live ticks
  useEffect(() => {
    const newItems: TickerItem[] = []
    for (const sym of TICKER_SYMBOLS) {
      const tick = ticks[sym]
      if (tick) {
        newItems.push({
          symbol: sym,
          price: tick.price,
          change24h: tick.change24h,
          volume24h: tick.volume24h,
          fundingRate: tick.fundingRate
        })
      }
    }
    if (newItems.length > 0) setItems(newItems)
  }, [ticks])

  // Duplicate for seamless loop
  const displayItems = items.length > 0 ? [...items, ...items] : []

  if (items.length === 0) {
    return (
      <div className="ticker-bar">
        <div className="ticker-label">LIVE PERPS</div>
        <div className="ticker-loading dim">Connecting to market data…</div>
      </div>
    )
  }

  return (
    <div className="ticker-bar">
      <div className="ticker-label">
        <span className="ticker-live-dot" />
        LIVE
      </div>
      <div className="ticker-scroll-wrap">
        <div className="ticker-track">
          {displayItems.map((item, i) => (
            <TickerCell key={`${item.symbol}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
