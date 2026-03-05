import React from 'react'
import { useUiStore } from '../../store/uiStore'
import { useMarketStore } from '../../store/marketStore'
import { PriceAlert } from '../../store/types'
import './alert-form.css'

export function AlertFormModal() {
  const alertForm = useUiStore((s) => s.alertForm)
  const closeAlertForm = useUiStore((s) => s.closeAlertForm)
  const setAlertFormField = useUiStore((s) => s.setAlertFormField)
  const addPriceAlert = useMarketStore((s) => s.addPriceAlert)
  const ticks = useMarketStore((s) => s.ticks)

  if (!alertForm) return null

  const tick = ticks[alertForm.symbol]
  const currentPrice = tick?.price ?? 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!alertForm) return
    const targetPrice = parseFloat(alertForm.price)
    if (isNaN(targetPrice) || targetPrice <= 0) return

    const alert: PriceAlert = {
      id: `${alertForm.symbol}-${Date.now()}`,
      symbol: alertForm.symbol,
      type: alertForm.type,
      targetPrice,
      createdAt: Date.now(),
      triggered: false
    }
    addPriceAlert(alert)
    closeAlertForm()
  }

  return (
    <div className="alert-modal-overlay" onClick={closeAlertForm}>
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-header">
          <span className="alert-modal-title">SET PRICE ALERT</span>
          <span className="alert-modal-symbol accent">
            {alertForm.symbol.replace('USDT', '/USDT')}
          </span>
          <button className="alert-close-btn" onClick={closeAlertForm}>✕</button>
        </div>

        {currentPrice > 0 && (
          <div className="alert-current-price">
            <span className="dim">Current:</span>
            <span className="accent">{currentPrice.toFixed(currentPrice >= 1000 ? 2 : 4)}</span>
          </div>
        )}

        <form className="alert-form" onSubmit={handleSubmit}>
          <div className="alert-form-row">
            <label className="alert-form-label dim">Trigger</label>
            <div className="alert-type-group">
              {(['above', 'below'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`alert-type-btn${alertForm.type === t ? ' active' : ''}`}
                  onClick={() => setAlertFormField('type', t)}
                >
                  {t === 'above' ? '▲ ABOVE' : '▼ BELOW'}
                </button>
              ))}
            </div>
          </div>

          <div className="alert-form-row">
            <label className="alert-form-label dim">Price</label>
            <input
              className="alert-price-input"
              type="number"
              step="any"
              min="0"
              placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
              value={alertForm.price}
              onChange={(e) => setAlertFormField('price', e.target.value)}
              autoFocus
            />
          </div>

          <div className="alert-form-actions">
            <button type="button" className="terminal-btn" onClick={closeAlertForm}>
              CANCEL
            </button>
            <button type="submit" className="terminal-btn primary">
              SET ALERT
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
