import { useEffect, useRef, useCallback } from 'react'
import { useAiSignalStore } from '../store/aiSignalStore'
import { useMarketStore } from '../store/marketStore'
import { AiSignalTimeframe, AiSignal } from '../store/types'
import { playLongSignal, playShortSignal, playStrongAiSignal } from '../services/soundService'

// ─── Configuration ────────────────────────────────────────────────────────────

const SCAN_SYMBOLS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'ADAUSDT', 'LINKUSDT', 'MATICUSDT',
  'DOTUSDT', 'LTCUSDT', 'NEARUSDT', 'APTUSDT', 'INJUSDT',
]

const SCAN_TIMEFRAMES: AiSignalTimeframe[] = ['15m', '1h', '4h']

const SCAN_INTERVAL     = 5 * 60 * 1000   // 5 min recurring full scan
const QUICK_SCAN_INTERVAL = 90 * 1000     // 90s quick scan on top movers
const QUICK_SCAN_SYMBOLS  = 6             // how many top movers to quick-scan
const PRICE_MOVE_THRESHOLD = 0.8          // % move that triggers opportunistic scan

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAiSignals(): { triggerScan: () => Promise<void> } {
  const setScanning     = useAiSignalStore((s) => s.setScanning)
  const addSignals      = useAiSignalStore((s) => s.addSignals)
  const setLastScan     = useAiSignalStore((s) => s.setLastScan)
  const setScanProgress = useAiSignalStore((s) => s.setScanProgress)

  const ticksRef    = useRef(useMarketStore.getState().ticks)
  const scanningRef = useRef(false)
  const lastPricesRef = useRef<Record<string, number>>({})

  // Always keep ticksRef fresh
  useEffect(() => {
    return useMarketStore.subscribe((state) => {
      ticksRef.current = state.ticks
    })
  }, [])

  // ── Core scan function ──────────────────────────────────────────────────────

  const runScan = useCallback(async (
    symbols: string[],
    timeframes: AiSignalTimeframe[],
    label: string
  ) => {
    if (scanningRef.current) {
      console.log(`[AI Scan] Already scanning, skipping (${label})`)
      return
    }
    scanningRef.current = true
    setScanning(true)
    setScanProgress(0)

    const total = symbols.length * timeframes.length
    console.log(`[AI Scan] ${label}: ${symbols.length} symbols × ${timeframes.length} TFs = ${total} combos`)

    try {
      const fundingRates: Record<string, number>  = {}
      const openInterests: Record<string, number> = {}
      const currentTicks = ticksRef.current
      for (const [sym, tick] of Object.entries(currentTicks)) {
        fundingRates[sym]  = tick.fundingRate  ?? 0
        openInterests[sym] = tick.openInterest ?? 0
      }

      const { analyzeSymbol } = await import('../services/aiSignalEngine')

      let done = 0
      const allSignals: AiSignal[] = []

      // Process in small batches so UI stays responsive
      const BATCH = 4
      for (let i = 0; i < symbols.length; i += BATCH) {
        const batch = symbols.slice(i, i + BATCH)
        const batchResults = await Promise.allSettled(
          batch.flatMap((sym) =>
            timeframes.map((tf) =>
              analyzeSymbol(sym, tf, fundingRates[sym] ?? 0, openInterests[sym] ?? 0)
                .then((sig) => {
                  if (sig) {
                    allSignals.push(sig)
                    console.log(`[AI] ✓ ${sym} ${tf} → ${sig.direction} ${sig.strength} (${sig.score})`)
                  }
                })
                .catch((e) => console.warn(`[AI] ✗ ${sym} ${tf}:`, e?.message || e))
                .finally(() => {
                  done++
                  setScanProgress(Math.round((done / total) * 100))
                })
            )
          )
        )
        void batchResults // results handled above
      }

      console.log(`[AI Scan] ${label} complete: ${allSignals.length} signals`)
      addSignals(allSignals)
      setLastScan(Date.now())

      // Sound alert for new signals
      if (allSignals.length > 0) {
        const top = allSignals.reduce((a, b) =>
          Math.abs(a.score) > Math.abs(b.score) ? a : b
        )
        if (top.strength === 'STRONG') {
          playStrongAiSignal(top.direction)
        } else if (top.direction === 'LONG') {
          playLongSignal()
        } else {
          playShortSignal()
        }
      }
    } catch (err) {
      console.error('[AI Scan] Fatal error:', err)
    } finally {
      setScanning(false)
      setScanProgress(100)
      scanningRef.current = false
    }
  }, [setScanning, addSignals, setLastScan, setScanProgress])

  // ── Public trigger (manual or from AiSignalsPanel button) ──────────────────

  const triggerScan = useCallback(async () => {
    await runScan(SCAN_SYMBOLS, SCAN_TIMEFRAMES, 'MANUAL')
  }, [runScan])

  // Store triggerScan in a ref so intervals call latest version
  const triggerRef = useRef(triggerScan)
  useEffect(() => { triggerRef.current = triggerScan }, [triggerScan])

  const runRef = useRef(runScan)
  useEffect(() => { runRef.current = runScan }, [runScan])

  // ── Immediate initial scan on mount (no delay) ─────────────────────────────
  useEffect(() => {
    console.log('[AI Scan] Running immediate initial scan…')
    runRef.current(SCAN_SYMBOLS, ['15m', '1h'], 'INITIAL')
  }, [])                // eslint-disable-line react-hooks/exhaustive-deps

  // ── Full recurring scan every 5 minutes (all TFs) ─────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      console.log('[AI Scan] Running full scheduled scan…')
      runRef.current(SCAN_SYMBOLS, SCAN_TIMEFRAMES, 'SCHEDULED')
    }, SCAN_INTERVAL)
    return () => clearInterval(id)
  }, [])

  // ── Quick scan every 90s — top movers only (15m + 1h only) ────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const ticks = ticksRef.current
      // Get top movers by absolute % change
      const topMovers = Object.values(ticks)
        .filter((t) => SCAN_SYMBOLS.includes(t.symbol))
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, QUICK_SCAN_SYMBOLS)
        .map((t) => t.symbol)

      if (topMovers.length > 0) {
        console.log('[AI Scan] Quick scan on top movers:', topMovers.join(', '))
        runRef.current(topMovers, ['15m', '1h'], 'QUICK')
      }
    }, QUICK_SCAN_INTERVAL)
    return () => clearInterval(id)
  }, [])

  // ── Opportunistic scan on significant price moves ─────────────────────────
  useEffect(() => {
    // Check prices every 30s and trigger scan if any symbol moved > threshold
    const id = setInterval(() => {
      const ticks = ticksRef.current
      const movers: string[] = []

      for (const sym of SCAN_SYMBOLS) {
        const tick = ticks[sym]
        if (!tick) continue
        const lastPrice = lastPricesRef.current[sym]
        if (lastPrice && lastPrice > 0) {
          const movePct = Math.abs((tick.price - lastPrice) / lastPrice * 100)
          if (movePct >= PRICE_MOVE_THRESHOLD) {
            movers.push(sym)
            console.log(`[AI Scan] ${sym} moved ${movePct.toFixed(2)}% in 30s — flagging for opportunistic scan`)
          }
        }
        lastPricesRef.current[sym] = tick.price
      }

      if (movers.length > 0 && !scanningRef.current) {
        console.log('[AI Scan] Opportunistic scan triggered for:', movers.join(', '))
        runRef.current(movers, ['15m', '1h'], 'OPPORTUNISTIC')
      }
    }, 30000)
    return () => clearInterval(id)
  }, [])

  return { triggerScan }
}
