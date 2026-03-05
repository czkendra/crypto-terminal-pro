import React, { useRef, useState, Component, ErrorInfo } from 'react'
import { useMarketStore } from '../../store/marketStore'
import { useAiSignalStore } from '../../store/aiSignalStore'
import { useSignalStore } from '../../store/signalStore'
import './tradingview-chart.css'

// Error boundary to prevent black screen on chart crash
class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TradingViewChart] Error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="tv-error-fallback">
          <div className="tv-error-icon">⚠</div>
          <div className="tv-error-text">Chart Error</div>
          <div className="tv-error-detail dim">{this.state.error}</div>
          <button className="terminal-btn primary" onClick={() => this.setState({ hasError: false, error: '' })}>
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type ChartTimeframe = '1' | '5' | '15' | '60' | '240' | 'D'

const TIMEFRAME_LABELS: { key: ChartTimeframe; label: string }[] = [
  { key: '1',   label: '1m' },
  { key: '5',   label: '5m' },
  { key: '15',  label: '15m' },
  { key: '60',  label: '1h' },
  { key: '240', label: '4h' },
  { key: 'D',   label: '1D' },
]

function fmtPrice(n: number): string {
  if (!n || isNaN(n)) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000)  return n.toFixed(2)
  if (n >= 1)     return n.toFixed(3)
  return n.toFixed(5)
}

function TradingViewChartInner() {
  const ticks          = useMarketStore((s) => s.ticks)
  const aiSignals      = useAiSignalStore((s) => s.signals)
  const telegramSigs   = useSignalStore((s) => s.signals)

  const [symbol,      setSymbol]      = useState('BTCUSDT')
  const [timeframe,   setTimeframe]   = useState<ChartTimeframe>('15')
  const [showOverlay, setShowOverlay] = useState(true)
  const [searchQ,     setSearchQ]     = useState('')
  const [searchOpen,  setSearchOpen]  = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const liveSymbols = Object.keys(ticks).sort()
  const filtered    = searchQ
    ? liveSymbols.filter(s => s.toLowerCase().includes(searchQ.toLowerCase()))
    : liveSymbols

  const tvSym    = `BINANCE:${symbol.replace('USDT', '')}USDT.P`
  const chartUrl = `https://www.tradingview.com/widgetembed/?` +
    `frameElementId=tv_chart` +
    `&symbol=${encodeURIComponent(tvSym)}` +
    `&interval=${timeframe}` +
    `&theme=dark&style=1&locale=en` +
    `&toolbar_bg=%230d1117` +
    `&enable_publishing=false` +
    `&allow_symbol_change=true` +
    `&save_image=false` +
    `&studies=RSI%40tv-basicstudies,MACD%40tv-basicstudies,Volume%40tv-basicstudies` +
    `&hide_top_toolbar=0&hide_legend=0&withdateranges=1&hide_side_toolbar=0` +
    `&details=0&hotlist=0&calendar=0`

  const tick         = ticks[symbol]
  const symAiSigs    = aiSignals.filter(s => s.symbol === symbol && !s.invalidated && s.expiresAt > Date.now())
  const symTgSigs    = telegramSigs.filter(s => s.symbol === symbol).slice(0, 3)
  const hasSignals   = symAiSigs.length > 0 || symTgSigs.length > 0

  function selectSymbol(sym: string) {
    setSymbol(sym)
    setSearchOpen(false)
    setSearchQ('')
  }

  return (
    <div className="tv-chart-panel">
      {/* ── Toolbar ── */}
      <div className="tv-toolbar">

        {/* Symbol picker */}
        <div className="tv-symbol-picker">
          <button className="tv-symbol-btn" onClick={() => setSearchOpen(o => !o)}>
            <span className="tv-sym-label">
              <span className="tv-sym-base">{symbol.replace('USDT','')}</span>
              <span className="tv-sym-quote">/USDT PERP</span>
            </span>
            {tick ? (
              <>
                <span className={`tv-sym-price ${tick.change24h >= 0 ? 'up' : 'down'}`}>
                  {fmtPrice(tick.price)}
                </span>
                <span className={`tv-sym-chg ${tick.change24h >= 0 ? 'up' : 'down'}`}>
                  {tick.change24h >= 0 ? '▲' : '▼'} {Math.abs(tick.change24h).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="tv-sym-loading">Loading…</span>
            )}
            <span className="tv-caret">▾</span>
          </button>

          {searchOpen && (
            <div className="tv-dropdown">
              <input
                className="tv-search-input"
                autoFocus
                placeholder="Search symbol…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQ('') }
                  if (e.key === 'Enter' && filtered.length > 0) selectSymbol(filtered[0])
                }}
              />
              <div className="tv-dropdown-list">
                {filtered.length === 0 && <div className="tv-dropdown-empty dim">No matches</div>}
                {filtered.map(sym => {
                  const t = ticks[sym]
                  const pct = t?.change24h ?? 0
                  return (
                    <div
                      key={sym}
                      className={`tv-dropdown-row${sym === symbol ? ' active' : ''}`}
                      onClick={() => selectSymbol(sym)}
                    >
                      <span className="tv-dr-sym">{sym.replace('USDT', '')}<span className="dim">/USDT</span></span>
                      {t && (
                        <>
                          <span className="tv-dr-price">{fmtPrice(t.price)}</span>
                          <span className={`tv-dr-chg ${pct >= 0 ? 'up' : 'down'}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="tv-sep" />

        {/* Timeframe tabs */}
        <div className="tv-tf-row">
          {TIMEFRAME_LABELS.map(tf => (
            <button
              key={tf.key}
              className={`tv-tf-btn${timeframe === tf.key ? ' active' : ''}`}
              onClick={() => setTimeframe(tf.key)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="tv-sep" />

        {/* Signal overlay toggle */}
        <button
          className={`tv-action-btn${showOverlay ? ' active' : ''}`}
          onClick={() => setShowOverlay(v => !v)}
          title="Toggle signal overlay"
        >
          ◈ SIGNALS {showOverlay ? 'ON' : 'OFF'}
        </button>

        {/* Open in full TradingView */}
        <button
          className="tv-action-btn"
          onClick={() => window.electronAPI?.shell?.openExternal(`https://www.tradingview.com/chart/?symbol=${tvSym}`)}
          title="Open full TradingView in browser"
        >
          ⬡ FULL CHART
        </button>

        {/* Live data indicators */}
        {tick && (
          <div className="tv-live-stats">
            <span className="tv-stat"><span className="dim">24H VOL </span>{(tick.volume24h / 1e6).toFixed(0)}M</span>
            <span className="tv-stat"><span className="dim">OI </span>{(tick.openInterest / 1e6).toFixed(0)}M</span>
            <span className="tv-stat">
              <span className="dim">FUND </span>
              <span className={tick.fundingRate >= 0 ? 'up' : 'down'}>
                {(tick.fundingRate * 100).toFixed(4)}%
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Chart + Overlay ── */}
      <div className="tv-body">
        <iframe
          ref={iframeRef}
          key={`${symbol}-${timeframe}`}
          src={chartUrl}
          className="tv-iframe"
          title={`TradingView ${symbol}`}
          allowFullScreen
        />

        {/* Signal overlay */}
        {showOverlay && hasSignals && (
          <div className="tv-overlay">
            <div className="tv-overlay-title">
              <span className="tv-overlay-sym">{symbol.replace('USDT','')}</span>
              <span className="dim"> ACTIVE SIGNALS</span>
            </div>

            {symAiSigs.map(sig => (
              <div key={sig.id} className={`tv-sig-card ${sig.direction === 'LONG' ? 'bull' : 'bear'}`}>
                <div className="tv-sig-top">
                  <span className={`tv-sig-dir ${sig.direction === 'LONG' ? 'bull' : 'bear'}`}>
                    {sig.direction === 'LONG' ? '▲' : '▼'} {sig.direction}
                  </span>
                  <span className="tv-sig-tf">{sig.timeframe}</span>
                  <span className={`tv-sig-str ${sig.strength.toLowerCase()}`}>{sig.strength}</span>
                  <span className="tv-sig-src dim">AI</span>
                  <span className="tv-sig-score">{sig.score}</span>
                </div>
                <div className="tv-sig-levels">
                  <div className="tv-sig-lv"><span className="dim">E</span> {fmtPrice(sig.entryPrice)}</div>
                  <div className="tv-sig-lv"><span className="positive">T</span> {fmtPrice(sig.tp1)}</div>
                  <div className="tv-sig-lv"><span className="negative">S</span> {fmtPrice(sig.stopLoss)}</div>
                  <div className="tv-sig-lv"><span className="warning">R</span> 1:{sig.riskRewardRatio}</div>
                </div>
                <div className="tv-sig-bar">
                  <div
                    className="tv-sig-fill"
                    style={{
                      width: `${sig.score}%`,
                      background: sig.direction === 'LONG'
                        ? 'linear-gradient(90deg, #00cc44 0%, #00ff66 100%)'
                        : 'linear-gradient(90deg, #cc2222 0%, #ff3333 100%)'
                    }}
                  />
                </div>
              </div>
            ))}

            {symTgSigs.map(sig => (
              <div key={sig.id} className={`tv-sig-card tg ${sig.direction === 'LONG' ? 'bull' : 'bear'}`}>
                <div className="tv-sig-top">
                  <span className={`tv-sig-dir ${sig.direction === 'LONG' ? 'bull' : 'bear'}`}>
                    {sig.direction === 'LONG' ? '▲' : '▼'} {sig.direction}
                  </span>
                  <span className="tv-sig-src dim">TG · #{sig.channelName}</span>
                  <span className="dim">{Math.round(sig.confidence * 100)}%</span>
                </div>
                <div className="tv-sig-levels">
                  <div className="tv-sig-lv"><span className="dim">E</span> {fmtPrice(sig.entryMin)}</div>
                  {sig.takeProfits[0] && <div className="tv-sig-lv"><span className="positive">T</span> {fmtPrice(sig.takeProfits[0])}</div>}
                  {sig.stopLoss > 0 && <div className="tv-sig-lv"><span className="negative">S</span> {fmtPrice(sig.stopLoss)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TradingViewChart() {
  return (
    <ChartErrorBoundary>
      <TradingViewChartInner />
    </ChartErrorBoundary>
  )
}
