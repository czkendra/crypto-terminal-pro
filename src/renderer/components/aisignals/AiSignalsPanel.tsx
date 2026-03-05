import React, { useState } from 'react'
import { useAiSignalStore } from '../../store/aiSignalStore'
import { AiSignal, AiSignalFilter } from '../../store/types'
import { setSoundEnabled, isSoundEnabled } from '../../services/soundService'
import './ai-signals.css'

function fmtPrice(n: number): string {
  if (!n || isNaN(n)) return '--'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 1000)  return n.toFixed(2)
  if (n >= 1)     return n.toFixed(3)
  return n.toFixed(5)
}

function fmtPct(n: number, showPlus = true): string {
  if (isNaN(n)) return '--'
  const s = n.toFixed(2) + '%'
  return showPlus && n > 0 ? '+' + s : s
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function expiresIn(ts: number): string {
  const s = Math.floor((ts - Date.now()) / 1000)
  if (s <= 0) return 'EXPIRED'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m left`
  return `${Math.floor(m / 60)}h left`
}

function formatPatternName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Score Meter ─────────────────────────────────────────────────────────

function ScoreMeter({ score, direction }: { score: number; direction: 'LONG' | 'SHORT' }) {
  const color = direction === 'LONG' ? 'var(--color-positive)' : 'var(--color-negative)'
  return (
    <div className="ai-score-meter">
      <div className="ai-score-bar-track">
        <div className="ai-score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="ai-score-num" style={{ color }}>{score}</span>
    </div>
  )
}

// ─── Volatility Badge ─────────────────────────────────────────────────────

function VolBadge({ regime }: { regime: string }) {
  const cls = regime === 'extreme' ? 'vol-extreme' : regime === 'high' ? 'vol-high' : regime === 'low' ? 'vol-low' : 'vol-normal'
  return <span className={`ai-vol-badge ${cls}`}>{regime.toUpperCase()}</span>
}

// ─── Detail Modal ─────────────────────────────────────────────────────────

function SignalDetailModal({ signal, onClose }: { signal: AiSignal; onClose: () => void }) {
  const isBull = signal.direction === 'LONG'
  const { indicators: ind } = signal
  const [tab, setTab] = useState<'setup' | 'indicators' | 'patterns' | 'quant'>('setup')

  return (
    <div className="ai-detail-overlay" onClick={onClose}>
      <div className="ai-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-detail-header">
          <span className={`ai-dir-badge ${signal.direction.toLowerCase()}`}>{signal.direction}</span>
          <span className="ai-detail-symbol">{signal.symbol.replace('USDT', '/USDT')}</span>
          <span className="ai-detail-tf dim">{signal.timeframe}</span>
          <span className={`ai-strength-badge ${signal.strength.toLowerCase()}`}>{signal.strength}</span>
          <span className="ai-detail-time dim">{timeAgo(signal.timestamp)}</span>
          {signal.patternName && (
            <span className="ai-pattern-badge">{signal.patternName}</span>
          )}
          <button className="ai-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* AI Summary */}
        <div className="ai-detail-summary">{signal.summary}</div>

        {/* Stat chips row */}
        <div className="ai-stat-chips">
          <div className="ai-stat-chip">
            <span className="ai-chip-label">AI SCORE</span>
            <span className="ai-chip-value" style={{ color: isBull ? 'var(--color-positive)' : 'var(--color-negative)' }}>{signal.score}/100</span>
          </div>
          {signal.winRateEstimate && (
            <div className="ai-stat-chip">
              <span className="ai-chip-label">WIN RATE</span>
              <span className="ai-chip-value warning">{signal.winRateEstimate}%</span>
            </div>
          )}
          {signal.expectedMove && (
            <div className="ai-stat-chip">
              <span className="ai-chip-label">EXPECTED</span>
              <span className="ai-chip-value" style={{ color: isBull ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                {isBull ? '+' : '-'}{signal.expectedMove.toFixed(1)}%
              </span>
            </div>
          )}
          {signal.quantScore && (
            <div className="ai-stat-chip">
              <span className="ai-chip-label">VOLATILITY</span>
              <VolBadge regime={signal.quantScore.volatilityRegime} />
            </div>
          )}
          {signal.quantScore && (
            <div className="ai-stat-chip">
              <span className="ai-chip-label">TREND STR</span>
              <span className="ai-chip-value">{signal.quantScore.trendStrength}%</span>
            </div>
          )}
          {signal.quantScore && (
            <div className="ai-stat-chip">
              <span className="ai-chip-label">BREAKOUT P</span>
              <span className="ai-chip-value warning">{signal.quantScore.breakoutProb}%</span>
            </div>
          )}
          <div className="ai-stat-chip">
            <span className="ai-chip-label">EXPIRES</span>
            <span className={`ai-chip-value ${signal.expiresAt < Date.now() + 30*60*1000 ? 'warning' : 'dim'}`}>
              {expiresIn(signal.expiresAt)}
            </span>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="ai-modal-tabs">
          {(['setup', 'indicators', 'patterns', 'quant'] as const).map((t) => (
            <button key={t} className={`ai-modal-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'setup' ? 'TRADE SETUP' : t === 'indicators' ? 'INDICATORS' : t === 'patterns' ? 'PATTERNS' : 'QUANT'}
            </button>
          ))}
        </div>

        <div className="ai-detail-body">

          {/* ── SETUP TAB ── */}
          {tab === 'setup' && (
            <div className="ai-tab-content">
              <div className="ai-two-col">
                {/* Left: Trade Setup */}
                <div>
                  <div className="ai-detail-section-title">ENTRY / TARGETS</div>
                  <div className="ai-setup-grid">
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">Entry Zone</span>
                      <span className="ai-setup-value">{fmtPrice(signal.entryZoneLow)} – {fmtPrice(signal.entryZoneHigh)}</span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">Entry (mid)</span>
                      <span className="ai-setup-value">{fmtPrice(signal.entryPrice)}</span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">Stop Loss</span>
                      <span className="ai-setup-value negative">{fmtPrice(signal.stopLoss)}
                        <span className="dim" style={{fontSize:'10px', marginLeft:4}}>
                          ({fmtPct(((signal.stopLoss - signal.entryPrice) / signal.entryPrice) * 100)})
                        </span>
                      </span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">TP1 <span className="dim">(1.5R)</span></span>
                      <span className="ai-setup-value positive">{fmtPrice(signal.tp1)}
                        <span className="dim" style={{fontSize:'10px', marginLeft:4}}>
                          ({fmtPct(((signal.tp1 - signal.entryPrice) / signal.entryPrice) * 100)})
                        </span>
                      </span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">TP2 <span className="dim">(2.5R)</span></span>
                      <span className="ai-setup-value positive">{fmtPrice(signal.tp2)}
                        <span className="dim" style={{fontSize:'10px', marginLeft:4}}>
                          ({fmtPct(((signal.tp2 - signal.entryPrice) / signal.entryPrice) * 100)})
                        </span>
                      </span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">TP3 <span className="dim">(4R)</span></span>
                      <span className="ai-setup-value positive">{fmtPrice(signal.tp3)}
                        <span className="dim" style={{fontSize:'10px', marginLeft:4}}>
                          ({fmtPct(((signal.tp3 - signal.entryPrice) / signal.entryPrice) * 100)})
                        </span>
                      </span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">R:R Ratio</span>
                      <span className="ai-setup-value warning">1:{signal.riskRewardRatio}</span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">Suggested Lev</span>
                      <span className="ai-setup-value warning">{signal.suggestedLeverage}x</span>
                    </div>
                    <div className="ai-setup-row">
                      <span className="ai-setup-label">Risk / Trade</span>
                      <span className="ai-setup-value">{signal.positionSizeRisk}% of account</span>
                    </div>
                  </div>
                </div>

                {/* Right: Signal Reasons */}
                <div>
                  <div className="ai-detail-section-title">SIGNAL REASONS ({signal.reasons.length})</div>
                  <div className="ai-reasons-list">
                    {signal.reasons.slice(0, 12).map((r, i) => (
                      <div key={i} className={`ai-reason-row ${r.bullish ? 'bull' : 'bear'}`}>
                        <span className="ai-reason-icon">{r.bullish ? '▲' : '▼'}</span>
                        <div className="ai-reason-content">
                          <span className="ai-reason-name">{r.indicator}</span>
                          <span className="ai-reason-detail dim">{r.detail}</span>
                        </div>
                        <div className="ai-reason-weight-bar">
                          <div className={`ai-reason-weight-fill ${r.bullish ? 'bull' : 'bear'}`}
                            style={{ width: `${r.weight * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ marginTop: 10 }}>
                <div className="ai-detail-section-title">COMPOSITE SCORE</div>
                <ScoreMeter score={signal.score} direction={signal.direction} />
              </div>
            </div>
          )}

          {/* ── INDICATORS TAB ── */}
          {tab === 'indicators' && (
            <div className="ai-tab-content">
              <div className="ai-ind-grid-full">
                <div className="ai-ind-section-title">TREND</div>
                <IndRow label="EMA 9" value={fmtPrice(ind.ema9)} color={ind.ema9 > ind.ema21 ? 'positive' : 'negative'} />
                <IndRow label="EMA 21" value={fmtPrice(ind.ema21)} color={ind.ema9 > ind.ema21 ? 'positive' : 'negative'} />
                <IndRow label="EMA 50" value={fmtPrice(ind.ema50)} />
                <IndRow label="EMA 200" value={fmtPrice(ind.ema200)} />
                <IndRow label="Supertrend" value={`${fmtPrice(ind.supertrend)} (${ind.supertrendBull ? 'BULL' : 'BEAR'})`}
                  color={ind.supertrendBull ? 'positive' : 'negative'} />
                <IndRow label="ADX" value={ind.adx.toFixed(1)} color={ind.adx > 25 ? 'warning' : ''} />
                <IndRow label="DI+" value={ind.diPlus.toFixed(1)} color={ind.diPlus > ind.diMinus ? 'positive' : ''} />
                <IndRow label="DI−" value={ind.diMinus.toFixed(1)} color={ind.diMinus > ind.diPlus ? 'negative' : ''} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>MOMENTUM</div>
                <IndRow label="RSI (14)" value={ind.rsi14.toFixed(1)} color={ind.rsi14 < 35 ? 'positive' : ind.rsi14 > 65 ? 'negative' : ''} />
                <IndRow label="Stoch RSI K" value={ind.stochRsiK.toFixed(1)} color={ind.stochRsiK < 20 ? 'positive' : ind.stochRsiK > 80 ? 'negative' : ''} />
                <IndRow label="Stoch RSI D" value={ind.stochRsiD.toFixed(1)} />
                <IndRow label="Williams %R" value={ind.williamsR.toFixed(1)} color={ind.williamsR < -80 ? 'positive' : ind.williamsR > -20 ? 'negative' : ''} />
                <IndRow label="MACD" value={ind.macdLine.toFixed(4)} color={ind.macdHist > 0 ? 'positive' : 'negative'} />
                <IndRow label="MACD Signal" value={ind.macdSignal.toFixed(4)} />
                <IndRow label="MACD Hist" value={ind.macdHist.toFixed(4)} color={ind.macdHist > 0 ? 'positive' : 'negative'} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>VOLUME / FLOW</div>
                <IndRow label="Volume Surge" value={`${ind.volumeSurge.toFixed(2)}×`} color={ind.volumeSurge > 2 ? 'warning' : ''} />
                <IndRow label="OBV Slope" value={`${ind.obvSlope > 0 ? '+' : ''}${ind.obvSlope.toFixed(0)}`}
                  color={ind.obvSlope > 0 ? 'positive' : 'negative'} />
                <IndRow label="CMF (20)" value={ind.cmf.toFixed(3)} color={ind.cmf > 0.05 ? 'positive' : ind.cmf < -0.05 ? 'negative' : ''} />
                <IndRow label="VWAP" value={fmtPrice(ind.vwap)} />
                <IndRow label="Price vs VWAP" value={fmtPct(ind.priceVsVwap)} color={ind.priceVsVwap > 0 ? 'positive' : 'negative'} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>VOLATILITY / BANDS</div>
                <IndRow label="BB Upper" value={fmtPrice(ind.bbUpper)} />
                <IndRow label="BB Mid" value={fmtPrice(ind.bbMid)} />
                <IndRow label="BB Lower" value={fmtPrice(ind.bbLower)} />
                <IndRow label="BB Width" value={`${(ind.bbWidth*100).toFixed(2)}%`} color={ind.bbWidth < 0.02 ? 'warning' : ''} />
                <IndRow label="ATR (14)" value={`${fmtPrice(ind.atr14)} (${((ind.atr14/signal.entryPrice)*100).toFixed(2)}%)`} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>ICHIMOKU</div>
                <IndRow label="Tenkan-sen" value={fmtPrice(ind.ichimokuTenkan)} />
                <IndRow label="Kijun-sen" value={fmtPrice(ind.ichimokuKijun)} />
                <IndRow label="Senkou A" value={fmtPrice(ind.ichimokuSenkouA)} />
                <IndRow label="Senkou B" value={fmtPrice(ind.ichimokuSenkouB)} />
                <IndRow label="Cloud" value={ind.ichimokuCloudBull ? 'BULLISH (Green)' : 'BEARISH (Red)'}
                  color={ind.ichimokuCloudBull ? 'positive' : 'negative'} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>SUPPORT / RESISTANCE / PIVOTS</div>
                <IndRow label="Support" value={fmtPrice(ind.support)} color="positive" />
                <IndRow label="Resistance" value={fmtPrice(ind.resistance)} color="negative" />
                <IndRow label="Pivot Point" value={fmtPrice(ind.pivotPoint)} />
                <IndRow label="R1 / R2 / R3" value={`${fmtPrice(ind.pivotR1)} / ${fmtPrice(ind.pivotR2)} / ${fmtPrice(ind.pivotR3)}`} />
                <IndRow label="S1 / S2 / S3" value={`${fmtPrice(ind.pivotS1)} / ${fmtPrice(ind.pivotS2)} / ${fmtPrice(ind.pivotS3)}`} />

                <div className="ai-ind-section-title" style={{marginTop:8}}>FUTURES</div>
                <IndRow label="Funding Rate" value={`${(ind.fundingRate * 100).toFixed(4)}%`}
                  color={ind.fundingRate > 0.0005 ? 'negative' : ind.fundingRate < -0.0002 ? 'positive' : ''} />
                <IndRow label="Open Interest" value={ind.openInterest > 0 ? `${(ind.openInterest/1e6).toFixed(1)}M` : '--'} />
              </div>
            </div>
          )}

          {/* ── PATTERNS TAB ── */}
          {tab === 'patterns' && (
            <div className="ai-tab-content">
              {ind.patterns.length === 0 ? (
                <div className="ai-empty dim" style={{marginTop:20}}>No chart patterns detected in current data window</div>
              ) : (
                <div className="ai-patterns-list">
                  {ind.patterns.map((p, i) => (
                    <div key={i} className={`ai-pattern-card ${p.direction.toLowerCase()}`}>
                      <div className="ai-pattern-header">
                        <span className={`ai-dir-badge ${p.direction.toLowerCase()}`}>{p.direction}</span>
                        <span className="ai-pattern-name">{formatPatternName(p.type)}</span>
                        <div className="ai-pattern-conf-bar">
                          <div className="ai-pattern-conf-fill" style={{
                            width: `${p.confidence}%`,
                            background: p.direction === 'LONG' ? 'var(--color-positive)' : 'var(--color-negative)'
                          }} />
                        </div>
                        <span className="ai-pattern-conf-num">{p.confidence}%</span>
                        <span className={`ai-pattern-move ${p.targetMove > 0 ? 'positive' : 'negative'}`}>
                          {p.targetMove > 0 ? '+' : ''}{p.targetMove.toFixed(1)}%
                        </span>
                      </div>
                      <div className="ai-pattern-desc dim">{p.description}</div>
                      {p.neckline && (
                        <div className="ai-pattern-neckline dim">Neckline: {fmtPrice(p.neckline)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {signal.patternName && signal.winRateEstimate && (
                <div className="ai-winrate-box">
                  <span className="ai-detail-section-title">HISTORICAL WIN RATE</span>
                  <div className="ai-winrate-display">
                    <span className="ai-winrate-num warning">{signal.winRateEstimate}%</span>
                    <span className="dim"> estimated win rate for {signal.patternName} pattern</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── QUANT TAB ── */}
          {tab === 'quant' && signal.quantScore && (
            <div className="ai-tab-content">
              <div className="ai-quant-grid">
                <div className="ai-quant-card">
                  <div className="ai-quant-label">Z-SCORE</div>
                  <div className={`ai-quant-value ${signal.quantScore.zScore > 1 ? 'negative' : signal.quantScore.zScore < -1 ? 'positive' : ''}`}>
                    {signal.quantScore.zScore.toFixed(2)}σ
                  </div>
                  <div className="ai-quant-desc dim">
                    Price is {Math.abs(signal.quantScore.zScore).toFixed(2)} std devs {signal.quantScore.zScore > 0 ? 'above' : 'below'} 50-bar mean
                  </div>
                </div>

                <div className="ai-quant-card">
                  <div className="ai-quant-label">MOMENTUM</div>
                  <div className={`ai-quant-value ${signal.quantScore.momentumFactor > 0 ? 'positive' : 'negative'}`}>
                    {(signal.quantScore.momentumFactor * 100).toFixed(1)}%
                  </div>
                  <div className="ai-quant-desc dim">Composite 1/5/20-bar momentum factor</div>
                </div>

                <div className="ai-quant-card">
                  <div className="ai-quant-label">VOL REGIME</div>
                  <VolBadge regime={signal.quantScore.volatilityRegime} />
                  <div className="ai-quant-desc dim">Current ATR vs 20-bar avg ATR</div>
                </div>

                <div className="ai-quant-card">
                  <div className="ai-quant-label">TREND QUALITY</div>
                  <div className="ai-quant-value warning">{signal.quantScore.trendStrength}%</div>
                  <div className="ai-quant-desc dim">Linear regression R² over last 20 bars</div>
                </div>

                <div className="ai-quant-card">
                  <div className="ai-quant-label">MEAN REVERSION P</div>
                  <div className="ai-quant-value">{signal.quantScore.meanReversionProb}%</div>
                  <div className="ai-quant-desc dim">Prob of price returning to 50-bar mean</div>
                </div>

                <div className="ai-quant-card">
                  <div className="ai-quant-label">BREAKOUT P</div>
                  <div className={`ai-quant-value ${signal.quantScore.breakoutProb > 60 ? 'warning' : ''}`}>
                    {signal.quantScore.breakoutProb}%
                  </div>
                  <div className="ai-quant-desc dim">BB squeeze + volume surge probability</div>
                </div>
              </div>

              {/* Score breakdown chart */}
              <div style={{marginTop:12}}>
                <div className="ai-detail-section-title">FACTOR BREAKDOWN</div>
                <div className="ai-factor-chart">
                  {signal.reasons.slice(0, 10).map((r, i) => {
                    const barW = r.weight * 100
                    return (
                      <div key={i} className="ai-factor-row">
                        <span className="ai-factor-name dim">{r.indicator}</span>
                        <div className="ai-factor-bar-track">
                          <div className={`ai-factor-bar-fill ${r.bullish ? 'bull' : 'bear'}`}
                            style={{ width: `${barW}%` }} />
                        </div>
                        <span className={`ai-factor-wt ${r.bullish ? 'positive' : 'negative'}`}>
                          {(r.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function IndRow({ label, value, color = '' }: { label: string; value: string; color?: string }) {
  return (
    <div className="ai-ind-row">
      <span className="ai-ind-label">{label}</span>
      <span className={`ai-ind-value ${color}`}>{value}</span>
    </div>
  )
}

// ─── Signal Card (compact row) ────────────────────────────────────────────

function SignalRow({ signal, onClick }: { signal: AiSignal; onClick: () => void }) {
  const isBull = signal.direction === 'LONG'
  const expired = signal.expiresAt < Date.now()

  return (
    <div
      className={`ai-signal-row ${signal.direction.toLowerCase()} ${signal.strength.toLowerCase()} ${expired ? 'expired' : ''}`}
      onClick={onClick}
    >
      <div className="ai-row-left">
        <span className={`ai-dir-badge ${signal.direction.toLowerCase()}`}>{signal.direction}</span>
        <span className="ai-row-symbol">{signal.symbol.replace('USDT', '')}</span>
        <span className="ai-row-tf dim">{signal.timeframe}</span>
        <span className={`ai-strength-badge ${signal.strength.toLowerCase()}`}>{signal.strength}</span>
        {signal.patternName && (
          <span className="ai-pattern-mini">{signal.patternName}</span>
        )}
      </div>

      <div className="ai-row-center">
        <div className="ai-row-prices">
          <span className="ai-row-price-label dim">ENTRY</span>
          <span className="ai-row-entry">{signal.entryPrice >= 1000 ? signal.entryPrice.toFixed(1) : signal.entryPrice.toFixed(3)}</span>
          <span className="ai-row-sep dim">→</span>
          <span className="ai-row-price-label dim">TP1</span>
          <span className="ai-row-tp1 positive">{signal.tp1 >= 1000 ? signal.tp1.toFixed(1) : signal.tp1.toFixed(3)}</span>
          <span className="ai-row-sep dim">SL</span>
          <span className="ai-row-sl negative">{signal.stopLoss >= 1000 ? signal.stopLoss.toFixed(1) : signal.stopLoss.toFixed(3)}</span>
        </div>
        <div className="ai-row-meta">
          {signal.winRateEstimate && <span className="ai-row-winrate warning">Win:{signal.winRateEstimate}%</span>}
          {signal.expectedMove && <span className={`ai-row-move ${isBull ? 'positive' : 'negative'}`}>
            Exp:{isBull ? '+' : '-'}{signal.expectedMove.toFixed(1)}%
          </span>}
          {signal.quantScore && <span className="ai-row-regime dim">Vol:{signal.quantScore.volatilityRegime.toUpperCase()}</span>}
        </div>
      </div>

      <div className="ai-row-right">
        <ScoreMeter score={signal.score} direction={signal.direction} />
        <span className="ai-row-time dim">{timeAgo(signal.timestamp)}</span>
        <span className="ai-row-lev warning">{signal.suggestedLeverage}x</span>
      </div>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────

const FILTER_TABS: { key: AiSignalFilter; label: string }[] = [
  { key: 'all',    label: 'ALL' },
  { key: 'long',   label: 'LONG' },
  { key: 'short',  label: 'SHORT' },
  { key: 'strong', label: 'STRONG' },
  { key: 'recent', label: 'RECENT' }
]

// ─── Main Panel ───────────────────────────────────────────────────────────

interface AiSignalsPanelProps {
  onTriggerScan: () => Promise<void>
}

export function AiSignalsPanel({ onTriggerScan }: AiSignalsPanelProps) {
  const scanning       = useAiSignalStore((s) => s.scanning)
  const scanProgress   = useAiSignalStore((s) => s.scanProgress)
  const lastScan       = useAiSignalStore((s) => s.lastScan)
  const filter         = useAiSignalStore((s) => s.filter)
  const setFilter      = useAiSignalStore((s) => s.setFilter)
  const filteredSignals = useAiSignalStore((s) => s.filteredSignals())
  const totalSignals   = useAiSignalStore((s) => s.signals.length)

  const [detailSignal, setDetailSignal] = useState<AiSignal | null>(null)
  const [muted, setMuted] = useState(false)

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setSoundEnabled(!next)
  }

  const longCount  = filteredSignals.filter((s) => s.direction === 'LONG').length
  const shortCount = filteredSignals.filter((s) => s.direction === 'SHORT').length
  const strongCount = filteredSignals.filter((s) => s.strength === 'STRONG').length

  return (
    <div className="terminal-panel ai-signals-panel">
      {/* Header */}
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">
          <span className="ai-badge">AI</span> FUTURES SIGNALS
        </span>
        <div className="terminal-panel-actions">
          {lastScan && (
            <span className="dim" style={{ fontSize: 'var(--font-size-xs)' }}>
              {longCount}L / {shortCount}S / {strongCount} strong · {timeAgo(lastScan)}
            </span>
          )}
          <button
            className={`terminal-btn ${muted ? '' : 'primary'}`}
            onClick={toggleMute}
            title={muted ? 'Sounds muted' : 'Sounds on'}
            style={{ padding: '0 6px' }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            className={`terminal-btn ${scanning ? 'scanning' : 'primary'}`}
            onClick={onTriggerScan}
            disabled={scanning}
            title="Run AI scan — 15 symbols × 3 timeframes · chart patterns · quant analytics"
          >
            {scanning ? `SCANNING ${scanProgress}%` : '⚡ SCAN NOW'}
          </button>
        </div>
      </div>

      {/* Scan progress bar */}
      {scanning && (
        <div className="ai-scan-progress">
          <div className="ai-scan-bar" style={{ width: `${scanProgress}%` }} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="ai-filter-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ai-filter-tab${filter === tab.key ? ' active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            {tab.key === 'all' && totalSignals > 0 && <span className="ai-tab-count">{totalSignals}</span>}
          </button>
        ))}
      </div>

      {/* Signal list */}
      <div className="terminal-panel-body ai-signals-body">
        {filteredSignals.length === 0 && !scanning && (
          <div className="ai-empty dim">
            {totalSignals === 0
              ? 'Auto-scan starting… Monitoring 15 symbols × 3 timeframes with 18 indicators + chart patterns + quant analytics'
              : 'No signals match current filter'}
          </div>
        )}
        {scanning && filteredSignals.length === 0 && (
          <div className="ai-scanning-msg dim">
            <span className="ai-pulse">◉</span> Fetching candles, computing 18 indicators, detecting chart patterns…
          </div>
        )}
        {filteredSignals.map((sig) => (
          <SignalRow key={sig.id} signal={sig} onClick={() => setDetailSignal(sig)} />
        ))}
      </div>

      {/* Detail modal */}
      {detailSignal && (
        <SignalDetailModal signal={detailSignal} onClose={() => setDetailSignal(null)} />
      )}
    </div>
  )
}
