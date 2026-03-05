import React from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useMarketStore } from '../../store/marketStore'

type ExchangeName = 'binance' | 'bybit' | 'okx'

const EXCHANGE_INFO: Record<ExchangeName, { name: string; desc: string }> = {
  binance: { name: 'Binance Futures', desc: 'USDT-margined perpetuals via fstream.binance.com' },
  bybit: { name: 'Bybit Linear', desc: 'USDT perpetuals via stream.bybit.com' },
  okx: { name: 'OKX Swap', desc: 'USDT-margined swaps via ws.okx.com' }
}

export function ExchangeToggles() {
  const exchanges = useSettingsStore((s) => s.exchanges)
  const setExchangeEnabled = useSettingsStore((s) => s.setExchangeEnabled)
  const exchangeStatus = useMarketStore((s) => s.exchangeStatus)

  return (
    <div className="exchange-toggles">
      <p className="secondary" style={{ marginBottom: '12px', fontSize: 'var(--font-size-sm)' }}>
        Toggle which exchanges provide market data. Changes take effect on next restart.
      </p>

      {(Object.keys(EXCHANGE_INFO) as ExchangeName[]).map((ex) => {
        const { name, desc } = EXCHANGE_INFO[ex]
        const enabled = exchanges[ex]
        const status = exchangeStatus[ex] || 'disconnected'

        return (
          <div key={ex} className={`exchange-toggle-item ${enabled ? 'enabled' : 'disabled'}`}>
            <div className="exchange-toggle-left">
              <div className="exchange-toggle-header">
                <span className={`status-dot ${status}`} />
                <span className="exchange-toggle-name">{name}</span>
                <span className={`exchange-toggle-status ${status} secondary`}>
                  {status.toUpperCase()}
                </span>
              </div>
              <div className="exchange-toggle-desc dim">{desc}</div>
            </div>
            <div className="exchange-toggle-right">
              <button
                className={`terminal-btn ${enabled ? 'primary' : ''}`}
                onClick={() => setExchangeEnabled(ex, !enabled)}
              >
                {enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
