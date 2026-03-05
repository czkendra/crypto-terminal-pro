import { ParsedSignal } from '../store/types'

const DIRECTION_RE = /\b(LONG|SHORT|BUY|SELL)\b/i
const SYMBOL_RE = /\b([A-Z]{2,10})[\/\-]?(USDT|BUSD|USDC|USD|BTC)\b/i
const ENTRY_RE = /(?:entry|enter|buy(?:\s+at)?|long(?:\s+at)?)\s*[:@]?\s*([\d,\.]+)\s*[-–—~to]+\s*([\d,\.]+)/i
const ENTRY_SINGLE_RE = /(?:entry|enter|buy(?:\s+at)?|long(?:\s+at)?)\s*[:@]?\s*([\d,\.]+)/i
const TP_RE = /(?:tp|t\.?p\.?|target|take\s*profit)\s*([1-5]?)\s*[:@]?\s*([\d,\.]+)/gi
const SL_RE = /(?:sl|s\.?l\.?|stop[\s\-]?loss|stoploss)\s*[:@]?\s*([\d,\.]+)/i
const LEVERAGE_RE = /(\d+)\s*[xX×](?:\s*leverage)?|leverage\s*[:=]?\s*(\d+)\s*[xX×]/i
const LEVERAGE_ALT_RE = /(?:use|with|at)\s+(\d+)x/i

function parsePrice(raw: string): number {
  return parseFloat(raw.replace(/,/g, '').trim())
}

function normalizeDirection(raw: string): 'LONG' | 'SHORT' {
  const upper = raw.toUpperCase()
  return upper === 'LONG' || upper === 'BUY' ? 'LONG' : 'SHORT'
}

function normalizeSymbol(base: string, quote: string): string {
  return `${base.toUpperCase()}${quote.toUpperCase()}`
}

export function parseSignal(
  text: string,
  channelId: string,
  channelName: string,
  messageId: number,
  timestamp: number
): ParsedSignal | null {
  // Direction is required
  const dirMatch = text.match(DIRECTION_RE)
  if (!dirMatch) return null

  // Symbol is required
  const symMatch = text.match(SYMBOL_RE)
  if (!symMatch) return null

  // Entry price - try range first, then single
  let entryMin = 0
  let entryMax = 0
  const entryRange = text.match(ENTRY_RE)
  if (entryRange) {
    entryMin = parsePrice(entryRange[1])
    entryMax = parsePrice(entryRange[2])
  } else {
    const entrySingle = text.match(ENTRY_SINGLE_RE)
    if (!entrySingle) return null
    entryMin = parsePrice(entrySingle[1])
    entryMax = entryMin
  }

  if (entryMin <= 0) return null

  // Take profits - collect all
  const tpMatches = [...text.matchAll(TP_RE)]
  const takeProfits = tpMatches
    .sort((a, b) => parseInt(a[1] || '1') - parseInt(b[1] || '1'))
    .map((m) => parsePrice(m[2]))
    .filter((p) => p > 0)

  // Stop loss
  const slMatch = text.match(SL_RE)
  const stopLoss = slMatch ? parsePrice(slMatch[1]) : 0

  // Leverage
  const leverageMatch = text.match(LEVERAGE_RE) || text.match(LEVERAGE_ALT_RE)
  const leverage = leverageMatch
    ? parseInt(leverageMatch[1] || leverageMatch[2] || '0') || undefined
    : undefined

  // Confidence score
  let confidence = 0.4
  if (takeProfits.length > 0) confidence += 0.3
  if (stopLoss > 0) confidence += 0.2
  if (leverage) confidence += 0.1

  const id = `${messageId}-${timestamp}`

  return {
    id,
    raw: text,
    symbol: normalizeSymbol(symMatch[1], symMatch[2]),
    direction: normalizeDirection(dirMatch[1]),
    entryMin,
    entryMax,
    takeProfits,
    stopLoss,
    leverage,
    confidence,
    channelId,
    channelName,
    messageId,
    timestamp,
    status: 'pending'
  }
}
