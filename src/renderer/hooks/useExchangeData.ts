import { useEffect, useRef } from 'react'
import { WsManager } from '../services/websocket/WsManager'
import { binanceAdapter, bybitAdapter, okxAdapter } from '../services/exchanges'
import { useMarketStore, useSettingsStore } from '../store'

export function useExchangeData(): void {
  const managerRef = useRef<WsManager | null>(null)
  const updateTick = useMarketStore((s) => s.updateTick)
  const updateOrderBook = useMarketStore((s) => s.updateOrderBook)
  const setExchangeStatus = useMarketStore((s) => s.setExchangeStatus)
  const exchanges = useSettingsStore((s) => s.exchanges)
  const settingsLoaded = useSettingsStore((s) => s.loaded)

  useEffect(() => {
    if (!settingsLoaded) return

    const manager = new WsManager(
      updateTick,
      updateOrderBook,
      setExchangeStatus
    )
    managerRef.current = manager

    // Load initial REST data then connect WS
    const init = async () => {
      if (exchanges.binance) {
        const ticks = await binanceAdapter.loadInitialTickers()
        ticks.forEach(updateTick)
        manager.connect(binanceAdapter)
      }
      if (exchanges.bybit) {
        const ticks = await bybitAdapter.loadInitialTickers()
        ticks.forEach(updateTick)
        manager.connect(bybitAdapter)
      }
      if (exchanges.okx) {
        const ticks = await okxAdapter.loadInitialTickers()
        ticks.forEach(updateTick)
        manager.connect(okxAdapter)
      }
    }

    init()

    return () => {
      manager.disconnectAll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded])
}
