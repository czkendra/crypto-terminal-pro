import React from 'react'
import './terminal-grid.css'

interface TerminalGridProps {
  topbar: React.ReactNode
  tickerBar?: React.ReactNode
  signalFeed: React.ReactNode
  chart: React.ReactNode
  priceTicker: React.ReactNode
  aiSignals: React.ReactNode
  orderBook: React.ReactNode
  signalHistory: React.ReactNode
  newsPanel: React.ReactNode
  intelligencePanel?: React.ReactNode
}

export function TerminalGrid({
  topbar,
  tickerBar,
  signalFeed,
  chart,
  priceTicker,
  aiSignals,
  orderBook,
  signalHistory,
  newsPanel,
  intelligencePanel,
}: TerminalGridProps) {
  return (
    <div className="terminal-grid">
      {/* Top bar */}
      <div className="grid-topbar">{topbar}</div>

      {/* Live ticker strip (full width) */}
      {tickerBar && <div className="grid-tickerbar">{tickerBar}</div>}

      {/* Main layout row */}
      <div className="grid-signals">{signalFeed}</div>

      {/* Center top: TradingView chart */}
      <div className="grid-chart">{chart}</div>

      <div className="grid-orderbook">{orderBook}</div>

      {/* Bottom left: News */}
      <div className="grid-news">{newsPanel}</div>

      {/* Bottom center: Intelligence panel (top) + AI Signals (bottom) */}
      <div className="grid-center-col">
        {intelligencePanel
          ? (
            <>
              <div className="grid-intelligence">{intelligencePanel}</div>
              <div className="grid-aisignals">{aiSignals}</div>
            </>
          )
          : (
            <>
              <div className="grid-ticker">{priceTicker}</div>
              <div className="grid-aisignals">{aiSignals}</div>
            </>
          )
        }
      </div>

      {/* Bottom right: Price ticker (compact) + Signal history */}
      <div className="grid-right-col">
        <div className="grid-ticker-compact">{priceTicker}</div>
        <div className="grid-history">{signalHistory}</div>
      </div>
    </div>
  )
}
