import { NewsItem } from '../store/types'

// ─── Sentiment analysis ───────────────────────────────────────────────────

const BULLISH_RE = /\b(surge|surges?d?|rally|rallied|pump|pumps?ed?|bull(?:ish)?|breakout|broke.?out|all.?time.?high|ath|record.?(high|price)|gain|gains?ed?|rise|rose|moon(?:ing)?|soar|soars?ed?|adopt(?:ion)?|launch(?:es|ed)?|partnership|approv(?:al|ed)|upgrade|milestone|accumulate|inflow|etf|halving|institutional|bullrun|recovery|rebound|bounce|outperform)\b/i
const BEARISH_RE = /\b(crash|crashes?ed?|drop|drops?ped?|dump|dumps?ed?|bear(?:ish)?|breakdown|fell|fall|plunge|plunges?d?|sell.?off|hack(?:ed)?|exploit(?:ed)?|ban(?:ned)?|reject(?:ed)?|liquidat|panic|scam|fraud|loss(?:es)?|decline|collapse|lawsuit|sec\b|cftc\b|regulat(?:ory|or|ed)|warning|arrest|seized?|fine|crisis|contagion|insolvency|bankrupt|investigation)\b/i

function sentiment(title: string): NewsItem['sentiment'] {
  const bull = (title.match(new RegExp(BULLISH_RE.source, 'gi')) || []).length
  const bear = (title.match(new RegExp(BEARISH_RE.source, 'gi')) || []).length
  if (bull > bear) return 'bullish'
  if (bear > bull) return 'bearish'
  return 'neutral'
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h) || Math.floor(Math.random() * 1e9)
}

function makeItem(title: string, url: string, source: string, pubDate: string | number): NewsItem {
  const publishedAt = typeof pubDate === 'number'
    ? pubDate
    : (pubDate ? new Date(pubDate).getTime() : 0) || Date.now()
  return {
    id: hashStr(url || title),
    title: title.trim().replace(/\s+/g, ' '),
    url: url || '#',
    source,
    publishedAt,
    sentiment: sentiment(title),
    bullishVotes: 0,
    bearishVotes: 0
  }
}

// ─── Source Fetchers ──────────────────────────────────────────────────────

async function fetchCoinGecko(): Promise<NewsItem[]> {
  const r = await fetch('https://api.coingecko.com/api/v3/news?per_page=50', {
    signal: AbortSignal.timeout(10000)
  })
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
  const d = await r.json() as {
    data?: Array<{ id: string|number; title: string; url: string; author: string; updated_at: number }>
  }
  return (d.data || []).filter(i => i.title && i.url).map(i => ({
    id: typeof i.id === 'number' ? i.id : hashStr(i.url),
    title: i.title.trim(),
    url: i.url,
    source: i.author || 'CoinGecko',
    publishedAt: (i.updated_at || 0) * 1000 || Date.now(),
    sentiment: sentiment(i.title),
    bullishVotes: 0,
    bearishVotes: 0
  }))
}

async function fetchCryptoPanic(): Promise<NewsItem[]> {
  const r = await fetch(
    'https://cryptopanic.com/api/v1/posts/?auth_token=anonymous&public=true&kind=news&regions=en',
    { signal: AbortSignal.timeout(10000) }
  )
  if (!r.ok) throw new Error(`CryptoPanic ${r.status}`)
  const d = await r.json() as {
    results?: Array<{
      id: number; title: string; url: string
      source: { title: string }; published_at: string
      votes: { liked: number; disliked: number; important: number }
    }>
  }
  return (d.results || []).filter(p => p.title && p.url).map(p => {
    const bull = (p.votes?.liked || 0) + (p.votes?.important || 0)
    const bear = p.votes?.disliked || 0
    const sent: NewsItem['sentiment'] = bull === 0 && bear === 0
      ? sentiment(p.title)
      : bull > bear * 1.5 ? 'bullish' : bear > bull * 1.5 ? 'bearish' : 'neutral'
    return {
      id: p.id,
      title: p.title.trim(),
      url: p.url,
      source: p.source?.title || 'CryptoPanic',
      publishedAt: new Date(p.published_at).getTime() || Date.now(),
      sentiment: sent,
      bullishVotes: bull,
      bearishVotes: bear
    }
  })
}

async function fetchBinanceAnnouncements(): Promise<NewsItem[]> {
  const r = await fetch(
    'https://www.binance.com/bapi/composite/v1/public/cms/article/catalog/list/query?catalogId=48&pageNo=1&pageSize=20',
    { signal: AbortSignal.timeout(10000) }
  )
  if (!r.ok) throw new Error(`Binance ${r.status}`)
  const d = await r.json() as {
    data?: { catalogs?: Array<{ articles?: Array<{ id: number; title: string; releaseDate: number }> }> }
  }
  const articles = d.data?.catalogs?.[0]?.articles || []
  return articles.map(a => makeItem(
    a.title,
    `https://www.binance.com/en/support/announcement/${a.id}`,
    'Binance',
    a.releaseDate
  ))
}

async function fetchRss2Json(rssUrl: string, sourceName: string): Promise<NewsItem[]> {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=30`
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(`rss2json ${r.status}`)
  const d = await r.json() as { status: string; items?: Array<{ title: string; link: string; pubDate: string }> }
  if (d.status !== 'ok' || !d.items?.length) throw new Error(`rss2json status=${d.status}`)
  return d.items
    .filter(i => i.title && i.link)
    .map(i => makeItem(i.title, i.link, sourceName, i.pubDate))
}

async function fetchAllOriginsRss(rssUrl: string, sourceName: string): Promise<NewsItem[]> {
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`allorigins ${r.status}`)
  const d = await r.json() as { contents?: string }
  const xml = d.contents || ''
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []
  const items: NewsItem[] = []
  for (const b of blocks.slice(0, 30)) {
    const title = (b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/) || b.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1]?.trim()
    const link  = (b.match(/<link>(https?:\/\/[^<]+)<\/link>/) || b.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/))?.[1]?.trim()
    const pub   = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || ''
    if (title && link) items.push(makeItem(title, link, sourceName, pub))
  }
  if (!items.length) throw new Error(`allorigins ${sourceName} 0 items`)
  return items
}

async function fetchRss(url: string, name: string): Promise<NewsItem[]> {
  try { return await fetchRss2Json(url, name) }
  catch { return fetchAllOriginsRss(url, name) }
}

// ─── Dedup ────────────────────────────────────────────────────────────────

function dedup(items: NewsItem[]): NewsItem[] {
  const ids   = new Set<number>()
  const titles = new Set<string>()
  return items.filter(i => {
    const tk = i.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    if (ids.has(i.id) || titles.has(tk)) return false
    ids.add(i.id); titles.add(tk)
    return true
  })
}

// ─── Main export ──────────────────────────────────────────────────────────

export async function fetchNews(): Promise<NewsItem[]> {
  console.log('[News] Fetching from all sources…')
  const sources = [
    fetchCoinGecko(),
    fetchCryptoPanic(),
    fetchBinanceAnnouncements(),
    fetchRss('https://www.coindesk.com/arc/outboundfeeds/rss/', 'CoinDesk'),
    fetchRss('https://cointelegraph.com/rss', 'CoinTelegraph'),
    fetchRss('https://decrypt.co/feed', 'Decrypt'),
    fetchRss('https://www.theblock.co/rss.xml', 'The Block'),
    fetchRss('https://bitcoinmagazine.com/.rss/full/', 'Bitcoin Magazine'),
    fetchRss('https://messari.io/rss/news.xml', 'Messari'),
    fetchRss('https://cryptobriefing.com/feed/', 'Crypto Briefing'),
  ]

  const results = await Promise.allSettled(sources)
  const all: NewsItem[] = []
  let ok = 0
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      all.push(...r.value); ok++
    } else if (r.status === 'rejected') {
      console.warn('[News] source failed:', (r.reason as Error)?.message || r.reason)
    }
  }

  console.log(`[News] ${ok}/${sources.length} sources OK → ${all.length} raw items`)
  if (!all.length) return []
  all.sort((a, b) => b.publishedAt - a.publishedAt)
  const out = dedup(all).slice(0, 200)
  console.log(`[News] ${out.length} after dedup`)
  return out
}

// ─── Trending topics ──────────────────────────────────────────────────────

export function extractTrendingTopics(items: NewsItem[]): Array<{
  word: string; count: number; sentiment: 'bullish' | 'bearish' | 'neutral'
}> {
  const STOP = new Set(['the','a','an','in','on','at','to','for','of','and','or','is','are','was','with','as','by','from','that','this','it','its','has','have','will','be','new','over','after','more','than','into','how','why','says','say','amid','up','down','out','about','what','but','not','all','report','crypto','bitcoin','ethereum','market','price','week','year','day','first','could','now','just','get','its','their','they','been','would','should','when','also','can','may','one','two','three','per','cent'])
  const counts = new Map<string, { count: number; bullish: number; bearish: number }>()

  for (const item of items.slice(0, 100)) {
    const words = item.title.toLowerCase().split(/[\s,:;.!?()\[\]"'—–]+/)
    for (const w of words) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue
      const cur = counts.get(w) || { count: 0, bullish: 0, bearish: 0 }
      cur.count++
      if (item.sentiment === 'bullish') cur.bullish++
      else if (item.sentiment === 'bearish') cur.bearish++
      counts.set(w, cur)
    }
  }

  return Array.from(counts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 25)
    .map(([word, v]) => ({
      word,
      count: v.count,
      sentiment: v.bullish > v.bearish * 1.3 ? 'bullish' : v.bearish > v.bullish * 1.3 ? 'bearish' : 'neutral'
    }))
}
