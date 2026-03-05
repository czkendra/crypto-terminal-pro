/**
 * MarketIntelligencePanel
 *
 * Replaces the bottom-center "AI Signals + Price Ticker" stack with a 4-tab
 * intelligence dashboard:
 *   REGIME | SENTIMENT | FUNDING | MACRO
 *
 * Sat beside the AI signals panel (AiSignalsPanel remains on the right).
 * Data is recomputed every 30 seconds from live ticks + fear/greed + news.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useMarketStore }  from '../../store/marketStore'
import { useNewsStore }    from '../../store/newsStore'
import {
  computeMarketIntelligence,
  MarketIntelligence,
  FundingHeatmapEntry,
  CorrelationPair,
} from '../../services/marketIntelligenceService'
import './market-intelligence.css'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const FUNDING_COLORS: Record<FundingHeatmapEntry['sentiment'], string> = {
  overheated_long:  'negative',
  hot_long:         'warning',
  neutral:          'dim',
  hot_short:        'info',
  overheated_short: 'positive',
}

const FUNDING_LABELS: Record<FundingHeatmapEntry['sentiment'], string> = {
  overheated_long:  'OVHT LONG',
  hot_long:         'HOT LONG',
  neutral:          'NEUTRAL',
  hot_short:        'HOT SHORT',
  overheated_short: 'OVHT SHORT',
}

type Tab = 'regime' | 'sentiment' | 'funding' | 'macro'

// ─── Sub-views ────────────────────────────────────────────────────────────────

function RegimeView({ data }: { data: MarketIntelligence }) {
  const { regime, correlations } = data
  return (
    <div className="mi-tab-content">
      {/* Regime card */}
      <div className={`mi-regime-card mi-regime-${regime.color}`}>
        <div className="mi-regime-header">
          <span className="mi-regime-label">{regime.label}</span>
          <span className="mi-regime-conf">{regime.confidence}% conf</span>
        </div>
        <div className="mi-regime-desc">{regime.description}</div>
        <div className="mi-regime-conf-bar">
          <div className="mi-regime-conf-fill" style={{ width: `${regime.confidence}%` }} />
        </div>
      </div>

      {/* Correlation heatmap */}
      <div className="mi-section-title">BTC CORRELATIONS (24H)</div>
      <div className="mi-corr-grid">
        {correlations.map((c) => {
          const pct  = Math.round(Math.abs(c.correlation) * 100)
          const isPos = c.correlation >= 0
          return (
            <div key={c.symbol} className="mi-corr-cell">
              <div className="mi-corr-symbol">{c.symbol}</div>
              <div className={`mi-corr-bar-track`}>
                {isPos ? (
                  <div className="mi-corr-fill pos" style={{ width: `${pct}%` }} />
                ) : (
                  <div className="mi-corr-fill neg" style={{ width: `${pct}%` }} />
                )}
              </div>
              <div className={`mi-corr-val ${isPos ? 'positive' : 'negative'}`}>
                {c.correlation.toFixed(2)}
              </div>
              <div className={`mi-corr-delta ${c.priceDelta24h >= 0 ? 'positive' : 'negative'}`}>
                {fmtPct(c.priceDelta24h, 1)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SentimentView({ data }: { data: MarketIntelligence }) {
  const { sentiment } = data
  const { components } = sentiment

  const gaugeAngle = (sentiment.score / 100) * 180 - 90  // -90 to +90 deg

  return (
    <div className="mi-tab-content">
      {/* Gauge */}
      <div className="mi-sentiment-gauge-wrap">
        <svg className="mi-gauge-svg" viewBox="0 0 120 65">
          {/* Arc background */}
          <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#1a1a2e" strokeWidth="8" />
          {/* Fear zone (red) */}
          <path d="M 10 60 A 50 50 0 0 1 35 18" fill="none" stroke="rgba(255,59,59,0.4)" strokeWidth="8" />
          {/* Neutral zone (gray) */}
          <path d="M 35 18 A 50 50 0 0 1 85 18" fill="none" stroke="rgba(128,128,128,0.3)" strokeWidth="8" />
          {/* Greed zone (green) */}
          <path d="M 85 18 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(0,229,102,0.4)" strokeWidth="8" />
          {/* Needle */}
          <line
            x1="60" y1="60"
            x2={60 + 42 * Math.cos((gaugeAngle - 90) * Math.PI / 180)}
            y2={60 + 42 * Math.sin((gaugeAngle - 90) * Math.PI / 180)}
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="4" fill="var(--color-accent)" />
        </svg>
        <div className="mi-gauge-score">{sentiment.score}</div>
        <div className={`mi-gauge-label ${sentiment.color}`}>{sentiment.label}</div>
      </div>

      {/* Components */}
      <div className="mi-section-title">COMPONENTS</div>
      <div className="mi-component-list">
        {[
          { label: 'Fear & Greed Index', value: components.fearGreed, weight: '35%' },
          { label: 'Funding Rates',      value: components.fundingScore, weight: '25%' },
          { label: 'Market Momentum',    value: components.momentumScore, weight: '20%' },
          { label: 'News Sentiment',     value: components.newsScore, weight: '20%' },
        ].map((c) => (
          <div key={c.label} className="mi-component-row">
            <span className="mi-component-label">{c.label}</span>
            <span className="mi-component-wt dim">{c.weight}</span>
            <div className="mi-component-bar-track">
              <div
                className={`mi-component-bar-fill ${c.value >= 50 ? 'positive' : 'negative'}`}
                style={{ width: `${c.value}%` }}
              />
            </div>
            <span className={`mi-component-val ${c.value >= 55 ? 'positive' : c.value <= 45 ? 'negative' : 'dim'}`}>
              {c.value.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FundingView({ data }: { data: MarketIntelligence }) {
  const { fundingHeatmap } = data

  return (
    <div className="mi-tab-content">
      <div className="mi-section-title">FUNDING RATE HEATMAP (15 SYMBOLS)</div>
      <div className="mi-funding-legend">
        <span className="mi-legend-chip negative">OVHT LONG</span>
        <span className="mi-legend-chip warning">HOT LONG</span>
        <span className="mi-legend-chip dim">NEUTRAL</span>
        <span className="mi-legend-chip info">HOT SHORT</span>
        <span className="mi-legend-chip positive">OVHT SHORT</span>
      </div>
      <div className="mi-funding-grid">
        {fundingHeatmap.map((f) => {
          const colorClass = FUNDING_COLORS[f.sentiment]
          const pct = Math.abs(f.annualized)
          const barWidth = Math.min(100, pct * 2)   // 50% ann = full bar
          return (
            <div key={f.symbol} className={`mi-funding-row`}>
              <span className="mi-funding-sym">{f.symbol}</span>
              <div className="mi-funding-bar-track">
                <div
                  className={`mi-funding-bar-fill ${colorClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`mi-funding-rate ${colorClass}`}>
                {(f.fundingRate * 100).toFixed(4)}%
              </span>
              <span className={`mi-funding-ann ${colorClass}`}>
                {f.annualized >= 0 ? '+' : ''}{f.annualized.toFixed(1)}%/y
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MacroView({ data }: { data: MarketIntelligence }) {
  const { macro, regime, liquidationZones } = data
  const btcTick = useMarketStore((s) => s.ticks['BTCUSDT'])
  const currentPrice = btcTick?.price ?? 0

  return (
    <div className="mi-tab-content">
      {/* Macro cards */}
      <div className="mi-macro-cards">
        <div className={`mi-macro-card ${macro.dominanceSignal === 'risk_on' ? 'positive' : macro.dominanceSignal === 'risk_off' ? 'negative' : 'neutral'}`}>
          <div className="mi-macro-card-label">BTC DOMINANCE</div>
          <div className="mi-macro-card-value">
            {macro.dominanceSignal === 'risk_on' ? '↓ RISK ON' :
             macro.dominanceSignal === 'risk_off' ? '↑ RISK OFF' : 'NEUTRAL'}
          </div>
        </div>
        <div className={`mi-macro-card ${macro.altSeasonScore > 60 ? 'positive' : macro.altSeasonScore < 40 ? 'negative' : 'neutral'}`}>
          <div className="mi-macro-card-label">ALT SEASON</div>
          <div className="mi-macro-card-value">{macro.altSeasonScore}%</div>
        </div>
        <div className={`mi-macro-card ${macro.volumeSignal === 'surge' ? 'positive' : macro.volumeSignal === 'drought' ? 'negative' : 'neutral'}`}>
          <div className="mi-macro-card-label">OI TREND</div>
          <div className="mi-macro-card-value">
            {macro.volumeSignal === 'surge' ? 'EXPANDING' :
             macro.volumeSignal === 'drought' ? 'CONTRACTING' : 'STABLE'}
          </div>
        </div>
      </div>

      {/* Narrative tags */}
      <div className="mi-section-title">MARKET NARRATIVE</div>
      <div className="mi-tags-row">
        {macro.narrativeTags.map((tag) => (
          <span key={tag} className="mi-tag">{tag}</span>
        ))}
      </div>

      {/* Liquidation zones (BTC) */}
      {liquidationZones.length > 0 && (
        <>
          <div className="mi-section-title">BTC LIQ ZONES (EST.)</div>
          <div className="mi-liq-list">
            {liquidationZones.slice(0, 6).map((z, i) => {
              const distPct = currentPrice > 0
                ? ((z.price - currentPrice) / currentPrice * 100)
                : 0
              return (
                <div key={i} className={`mi-liq-row ${z.side === 'SHORT' ? 'positive' : 'negative'}`}>
                  <span className={`mi-liq-side ${z.side === 'SHORT' ? 'positive' : 'negative'}`}>
                    {z.side === 'SHORT' ? '▲ SL' : '▼ LL'}
                  </span>
                  <span className="mi-liq-price">${z.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className={`mi-liq-dist ${distPct >= 0 ? 'positive' : 'negative'}`}>
                    {fmtPct(distPct, 1)}
                  </span>
                  <span className="mi-liq-usd dim">{fmtUsd(z.estimatedUsd)}</span>
                  <span className={`mi-liq-strength ${z.strength}`}>{z.strength.toUpperCase()}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'regime',    label: 'REGIME'    },
  { key: 'sentiment', label: 'SENTIMENT' },
  { key: 'funding',   label: 'FUNDING'   },
  { key: 'macro',     label: 'MACRO'     },
]

export function MarketIntelligencePanel() {
  const ticks      = useMarketStore((s) => s.ticks)
  const fearGreed  = useMarketStore((s) => s.fearGreed)
  const globalStats = useMarketStore((s) => s.globalStats)
  const newsItems  = useNewsStore((s) => s.items)

  const [intel, setIntel]     = useState<MarketIntelligence | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('regime')

  const recompute = useCallback(() => {
    const bulls       = newsItems.filter((n) => n.sentiment === 'bullish').length
    const newsBullPct = newsItems.length > 0 ? (bulls / newsItems.length) * 100 : 50
    const btcDom      = globalStats?.btcDominance ?? 50

    const result = computeMarketIntelligence(
      ticks, fearGreed, btcDom, newsBullPct, 'BTCUSDT'
    )
    setIntel(result)
  }, [ticks, fearGreed, globalStats, newsItems])

  // Recompute every 30 seconds and on dependency change
  useEffect(() => {
    recompute()
    const id = setInterval(recompute, 30000)
    return () => clearInterval(id)
  }, [recompute])

  if (!intel) {
    return (
      <div className="terminal-panel mi-panel">
        <div className="terminal-panel-header">
          <span className="terminal-panel-title">MARKET INTELLIGENCE</span>
        </div>
        <div className="mi-loading dim">Computing…</div>
      </div>
    )
  }

  return (
    <div className="terminal-panel mi-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">
          AI INTELLIGENCE
          <span className={`mi-regime-chip mi-chip-${intel.regime.color}`}>
            {intel.regime.regime.label ?? intel.regime.label}
          </span>
        </span>
        <span className="dim mi-updated">
          {new Date(intel.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Tab bar */}
      <div className="mi-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`mi-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === 'regime' && (
              <span className={`mi-tab-dot ${intel.regime.color}`} />
            )}
            {t.key === 'sentiment' && (
              <span className={`mi-tab-score ${intel.sentiment.color}`}>
                {intel.sentiment.score}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mi-body">
        {activeTab === 'regime'    && <RegimeView    data={intel} />}
        {activeTab === 'sentiment' && <SentimentView data={intel} />}
        {activeTab === 'funding'   && <FundingView   data={intel} />}
        {activeTab === 'macro'     && <MacroView     data={intel} />}
      </div>
    </div>
  )
}
