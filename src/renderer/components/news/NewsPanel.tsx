import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNewsStore } from '../../store/newsStore'
import { NewsItem, NewsFilter } from '../../store/types'
import './news.css'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

const FILTER_TABS: { key: NewsFilter; label: string }[] = [
  { key: 'all',     label: 'ALL'     },
  { key: 'bullish', label: '▲ BULL'  },
  { key: 'bearish', label: '▼ BEAR'  },
]

const SOURCE_ICONS: Record<string, string> = {
  'CoinDesk':       '📰',
  'CoinTelegraph':  '📡',
  'Decrypt':        '🔐',
  'The Block':      '🧱',
  'Bitcoin Magazine':'₿',
  'Messari':        '📊',
  'Crypto Briefing':'📋',
  'CoinGecko':      '🦎',
  'CryptoPanic':    '😱',
  'Binance':        '🟡',
}

interface NewsRowProps {
  item: NewsItem
  isNew: boolean
}

function NewsRow({ item, isNew }: NewsRowProps) {
  const handleClick = useCallback(() => {
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(item.url)
    } else {
      window.open(item.url, '_blank')
    }
  }, [item.url])

  const icon = SOURCE_ICONS[item.source] || '📄'
  const hasVotes = item.bullishVotes > 0 || item.bearishVotes > 0
  const totalVotes = item.bullishVotes + item.bearishVotes
  const bullPct = totalVotes > 0 ? Math.round((item.bullishVotes / totalVotes) * 100) : 0

  return (
    <div className={`news-row${isNew ? ' news-row-new' : ''}`} onClick={handleClick}>
      <div className="news-row-left">
        <span className="news-source-icon">{icon}</span>
      </div>
      <div className="news-row-content">
        <div className="news-row-meta">
          <span className="news-source">{item.source}</span>
          <span className="news-time dim">{timeAgo(item.publishedAt)}</span>
          {item.sentiment !== 'neutral' && (
            <span className={`news-sentiment-badge ${item.sentiment}`}>
              {item.sentiment === 'bullish' ? '▲' : '▼'}
            </span>
          )}
          {isNew && <span className="news-new-badge">NEW</span>}
        </div>
        <div className="news-title">{item.title}</div>
        {hasVotes && (
          <div className="news-vote-bar">
            <div className="news-vote-fill" style={{ width: `${bullPct}%` }} />
            <span className="news-vote-label positive">▲{fmt(item.bullishVotes)}</span>
            <span className="news-vote-label negative">▼{fmt(item.bearishVotes)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function NewsPanel() {
  const filteredItems    = useNewsStore((s) => s.filteredItems())
  const filter           = useNewsStore((s) => s.filter)
  const setFilter        = useNewsStore((s) => s.setFilter)
  const searchQuery      = useNewsStore((s) => s.searchQuery)
  const setSearchQuery   = useNewsStore((s) => s.setSearchQuery)
  const lastUpdated      = useNewsStore((s) => s.lastUpdated)
  const newItemCount     = useNewsStore((s) => s.newItemCount)
  const clearNewItemCount = useNewsStore((s) => s.clearNewItemCount)
  const trendingTopics   = useNewsStore((s) => s.trendingTopics)
  const isLoading        = useNewsStore((s) => s.isLoading)
  const allItems         = useNewsStore((s) => s.items)

  const bodyRef          = useRef<HTMLDivElement>(null)
  const [showTrending, setShowTrending]   = useState(false)
  const [newIds, setNewIds]               = useState<Set<number>>(new Set())
  const prevItemsRef                      = useRef<number[]>([])

  // Track new items to highlight them briefly
  useEffect(() => {
    const currentIds = filteredItems.map((i) => i.id)
    const prevSet    = new Set(prevItemsRef.current)
    const fresh      = currentIds.filter((id) => !prevSet.has(id))
    if (fresh.length > 0 && prevItemsRef.current.length > 0) {
      setNewIds((prev) => {
        const next = new Set(prev)
        fresh.forEach((id) => next.add(id))
        return next
      })
      // Remove highlight after 8 seconds
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev)
          fresh.forEach((id) => next.delete(id))
          return next
        })
      }, 8000)
    }
    prevItemsRef.current = currentIds
  }, [filteredItems])

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (newItemCount > 0 && bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [newItemCount])

  const handleBodyClick = useCallback(() => {
    if (newItemCount > 0) clearNewItemCount()
  }, [newItemCount, clearNewItemCount])

  // Sentiment summary
  const bulls    = allItems.filter((i) => i.sentiment === 'bullish').length
  const bears    = allItems.filter((i) => i.sentiment === 'bearish').length
  const total    = allItems.length
  const bullPct  = total > 0 ? Math.round((bulls / total) * 100) : 0
  const bearPct  = total > 0 ? Math.round((bears / total) * 100) : 0

  const sentimentLabel =
    bullPct > 60 ? 'BULLISH' :
    bearPct > 60 ? 'BEARISH' : 'MIXED'
  const sentimentClass =
    bullPct > 60 ? 'positive' :
    bearPct > 60 ? 'negative' : 'dim'

  return (
    <div className="terminal-panel news-panel">
      {/* ── Header ── */}
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">
          CRYPTO NEWS
          {isLoading && <span className="news-loading-dot" />}
          {!isLoading && lastUpdated && <span className="news-live-dot" />}
        </span>
        <div className="news-header-right">
          {total > 0 && (
            <span className={`news-sentiment-summary ${sentimentClass}`}>
              {sentimentLabel} {bullPct}%▲/{bearPct}%▼
            </span>
          )}
          {lastUpdated && (
            <span className="news-updated-time dim">
              {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className={`news-trending-btn${showTrending ? ' active' : ''}`}
            onClick={() => setShowTrending((v) => !v)}
            title="Trending topics"
          >
            🔥 TRENDING
          </button>
        </div>
      </div>

      {/* ── Trending Topics ── */}
      {showTrending && trendingTopics.length > 0 && (
        <div className="news-trending-row">
          {trendingTopics.slice(0, 12).map((t) => (
            <button
              key={t.word}
              className={`news-topic-chip ${t.sentiment}`}
              onClick={() => { setSearchQuery(t.word); setShowTrending(false) }}
              title={`${t.count} mentions — ${t.sentiment}`}
            >
              {t.word}
              <span className="news-topic-count">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Sentiment bar ── */}
      {total > 0 && (
        <div className="news-sentiment-bar-wrap">
          <div className="news-sentiment-bar">
            <div className="news-sentiment-bar-bull" style={{ width: `${bullPct}%` }} />
            <div className="news-sentiment-bar-bear" style={{ width: `${bearPct}%` }} />
          </div>
          <span className="news-sentiment-bar-label dim">
            {bulls}▲ / {bears}▼ / {total - bulls - bears}—
          </span>
        </div>
      )}

      {/* ── Filter + Search row ── */}
      <div className="news-controls">
        <div className="news-filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`news-filter-tab${filter === tab.key ? ' active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="news-search-wrap">
          <input
            className="news-search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="news-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* ── New-item notification bar ── */}
      {newItemCount > 0 && (
        <div className="news-new-bar" onClick={() => {
          clearNewItemCount()
          if (bodyRef.current) bodyRef.current.scrollTop = 0
        }}>
          ▲ {newItemCount} new {newItemCount === 1 ? 'story' : 'stories'} — click to scroll up
        </div>
      )}

      {/* ── Feed body ── */}
      <div
        className="terminal-panel-body news-body"
        ref={bodyRef}
        onClick={handleBodyClick}
      >
        {isLoading && filteredItems.length === 0 && (
          <div className="news-skeleton-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="news-skeleton-row">
                <div className="news-skeleton-line long" />
                <div className="news-skeleton-line short" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="news-empty dim">
            {lastUpdated ? 'No news matching filter' : 'Loading news…'}
          </div>
        )}

        {filteredItems.map((item) => (
          <NewsRow
            key={item.id}
            item={item}
            isNew={newIds.has(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
