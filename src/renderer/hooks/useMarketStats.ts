import { useEffect, useRef } from 'react'
import { useMarketStore } from '../store/marketStore'
import { fetchFearGreed, fetchGlobalMarketStats, fetchSymbolMarketStats } from '../services/marketDataService'

const GLOBAL_REFRESH = 5 * 60 * 1000   // 5 minutes
const SYMBOL_REFRESH = 30 * 1000        // 30 seconds

export function useMarketStats(): void {
  const { setGlobalStats, setFearGreed, setSymbolStats, ticks } = useMarketStore()
  const selectedSymbolRef = useRef('BTCUSDT')

  // Global stats (market cap, fear/greed)
  useEffect(() => {
    async function loadGlobal() {
      const [fg, gs] = await Promise.allSettled([
        fetchFearGreed(),
        fetchGlobalMarketStats()
      ])
      if (fg.status === 'fulfilled') setFearGreed(fg.value)
      if (gs.status === 'fulfilled') setGlobalStats(gs.value)
    }

    loadGlobal()
    const interval = setInterval(loadGlobal, GLOBAL_REFRESH)
    return () => clearInterval(interval)
  }, [setFearGreed, setGlobalStats])

  // Per-symbol stats (long/short ratio, liquidations) for BTCUSDT
  useEffect(() => {
    async function loadSymbol() {
      const symbol = 'BTCUSDT'
      const tick = ticks[symbol]
      const high24h = tick?.high24h ?? 0
      const low24h = tick?.low24h ?? 0
      const openInterest = tick?.openInterest ?? 0

      try {
        const stats = await fetchSymbolMarketStats(symbol, high24h, low24h, openInterest)
        setSymbolStats(stats)
      } catch {
        // silently ignore
      }
    }

    loadSymbol()
    const interval = setInterval(loadSymbol, SYMBOL_REFRESH)
    return () => clearInterval(interval)
  }, [setSymbolStats, ticks])
}
