import React, { useEffect } from 'react'
import { TerminalGrid } from './components/layout/TerminalGrid'
import { TopBar } from './components/topbar/TopBar'
import { SignalFeed } from './components/signals/SignalFeed'
import { PriceTicker } from './components/market/PriceTicker'
import { OrderBook } from './components/orderbook/OrderBook'
import { SignalHistory } from './components/history/SignalHistory'
import { NewsPanel } from './components/news/NewsPanel'
import { AiSignalsPanel } from './components/aisignals/AiSignalsPanel'
import { TradingViewChart } from './components/chart/TradingViewChart'
import { SettingsModal } from './components/settings/SettingsModal'
import { AlertFormModal } from './components/alerts/AlertFormModal'
import { TickerBar } from './components/ticker/TickerBar'
import { MarketIntelligencePanel } from './components/intelligence/MarketIntelligencePanel'
import { useExchangeData } from './hooks/useExchangeData'
import { useTelegramFeed } from './hooks/useTelegramFeed'
import { useNews } from './hooks/useNews'
import { useMarketStats } from './hooks/useMarketStats'
import { useAiSignals } from './hooks/useAiSignals'
import { useSettingsStore } from './store/settingsStore'
import { useUiStore } from './store/uiStore'
import { useMarketStore } from './store/marketStore'

function AppInner() {
  useExchangeData()
  useTelegramFeed()
  useNews()
  useMarketStats()
  const { triggerScan } = useAiSignals()

  const openSettings = useUiStore((s) => s.openSettings)
  const triggeredAlerts = useMarketStore((s) => s.triggeredAlerts)
  const clearTriggeredAlerts = useMarketStore((s) => s.clearTriggeredAlerts)

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        openSettings()
      }
      if (e.key === 'F2') {
        e.preventDefault()
        openSettings('channels')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openSettings])

  // Show desktop notifications for triggered price alerts
  useEffect(() => {
    if (triggeredAlerts.length === 0) return
    for (const alert of triggeredAlerts) {
      new Notification('Price Alert Triggered', {
        body: `${alert.symbol} is ${alert.type} ${alert.targetPrice}`
      })
    }
    clearTriggeredAlerts()
  }, [triggeredAlerts, clearTriggeredAlerts])

  return (
    <>
      <TerminalGrid
        topbar={<TopBar />}
        tickerBar={<TickerBar />}
        signalFeed={<SignalFeed />}
        chart={<TradingViewChart />}
        priceTicker={<PriceTicker />}
        aiSignals={<AiSignalsPanel onTriggerScan={triggerScan} />}
        orderBook={<OrderBook />}
        signalHistory={<SignalHistory />}
        newsPanel={<NewsPanel />}
        intelligencePanel={<MarketIntelligencePanel />}
      />
      <SettingsModal />
      <AlertFormModal />
    </>
  )
}

export function App() {
  const loadFromMain = useSettingsStore((s) => s.loadFromMain)

  useEffect(() => {
    loadFromMain()
  }, [loadFromMain])

  return <AppInner />
}
