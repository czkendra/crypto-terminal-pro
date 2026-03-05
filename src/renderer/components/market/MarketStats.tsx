import React from 'react'
import { useMarketStore } from '../../store/marketStore'
import { useUiStore } from '../../store/uiStore'
import './market-stats.css'

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

export function MarketStats() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol)
  const tick = useMarketStore((s) => s.ticks[selectedSymbol])
  const symbolStats = useMarketStore((s) => s.symbolStats[selectedSymbol])

  const longPct = symbolStats ? (symbolStats.longShortRatio * 100).toFixed(1) : null
  const shortPct = longPct ? (100 - parseFloat(longPct)).toFixed(1) : null
  const lsRatio = symbolStats ? symbolStats.longShortRatio : 0.5

  return (
    <div className="market-stats">
      <div className="ms-header">
        <span className="ms-title">MARKET STATS</span>
        <span className="ms-symbol dim">{selectedSymbol.replace('USDT', '/USDT')}</span>
      </div>

      <div className="ms-body">
        {/* 24H Range */}
        <div className="ms-row">
          <span className="ms-label">24H HIGH</span>
          <span className="ms-value positive">{fmtPrice(tick?.high24h ?? 0)}</span>
        </div>
        <div className="ms-row">
          <span className="ms-label">24H LOW</span>
          <span className="ms-value negative">{fmtPrice(tick?.low24h ?? 0)}</span>
        </div>

        {/* Open Interest */}
        <div className="ms-row">
          <span className="ms-label">OPEN INT</span>
          <span className="ms-value">{fmt(tick?.openInterest ?? 0)}</span>
        </div>

        {/* OI Change */}
        <div className="ms-row">
          <span className="ms-label">OI CHG 24H</span>
          {tick?.openInterestChange24h != null ? (
            <span className={`ms-value ${tick.openInterestChange24h >= 0 ? 'positive' : 'negative'}`}>
              {tick.openInterestChange24h >= 0 ? '+' : ''}{tick.openInterestChange24h.toFixed(1)}%
            </span>
          ) : (
            <span className="ms-value dim">--</span>
          )}
        </div>

        {/* Volume */}
        <div className="ms-row">
          <span className="ms-label">VOLUME 24H</span>
          <span className="ms-value">{fmt(tick?.volume24h ?? 0)}</span>
        </div>

        {/* Long/Short ratio */}
        <div className="ms-section-title">LONG / SHORT RATIO</div>
        {symbolStats ? (
          <>
            <div className="ms-ls-bar-wrap">
              <div className="ms-ls-bar">
                <div
                  className="ms-ls-long"
                  style={{ width: `${lsRatio * 100}%` }}
                />
                <div
                  className="ms-ls-short"
                  style={{ width: `${(1 - lsRatio) * 100}%` }}
                />
              </div>
            </div>
            <div className="ms-ls-labels">
              <span className="positive">{longPct}% LONG</span>
              <span className="negative">{shortPct}% SHORT</span>
            </div>
          </>
        ) : (
          <div className="ms-row">
            <span className="ms-value dim">Loading...</span>
          </div>
        )}

        {/* Recent Liquidations */}
        <div className="ms-row">
          <span className="ms-label">LIQS (1H)</span>
          <span className={`ms-value ${(symbolStats?.recentLiquidations ?? 0) > 5 ? 'negative' : ''}`}>
            {symbolStats?.recentLiquidations ?? '--'}
          </span>
        </div>
      </div>
    </div>
  )
}
