import React, { useState } from 'react'
import { useLicenseStore } from '../../store/licenseStore'
import './license-gate.css'

export function LicenseGate() {
  const { state, error, activate } = useLicenseStore()
  const [key, setKey] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    await activate(key.trim())
  }

  const isActivating = state === 'activating'

  return (
    <div className="license-gate">
      <div className="license-gate__card">

        {/* Header */}
        <div className="license-gate__header">
          <div className="license-gate__logo">CNAX</div>
          <div className="license-gate__product">CRYPTO TERMINAL PRO</div>
        </div>

        {state === 'expired' ? (
          <>
            <div className="license-gate__status license-gate__status--expired">
              ⚠ LICENSE EXPIRED
            </div>
            <p className="license-gate__sub">
              Your subscription has ended. Renew at{' '}
              <a
                href="https://cnaxsoftware.pro/products/crypto-terminal"
                onClick={(e) => {
                  e.preventDefault()
                  window.electronAPI?.shell.openExternal('https://cnaxsoftware.pro/products/crypto-terminal')
                }}
              >
                cnaxsoftware.pro
              </a>
              , then enter your new license key below.
            </p>
          </>
        ) : (
          <p className="license-gate__sub">
            Enter your license key to activate Crypto Terminal Pro.
            <br />
            Your key was emailed after purchase.
          </p>
        )}

        <form onSubmit={handleSubmit} className="license-gate__form">
          <input
            className="license-gate__input"
            type="text"
            placeholder="CNAX-XXX-XXXXXXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            disabled={isActivating}
            autoFocus
            spellCheck={false}
          />

          {error && (
            <div className="license-gate__error">{error}</div>
          )}

          <button
            className="license-gate__btn"
            type="submit"
            disabled={isActivating || !key.trim()}
          >
            {isActivating ? (
              <span className="license-gate__spinner">ACTIVATING...</span>
            ) : (
              'ACTIVATE LICENSE'
            )}
          </button>
        </form>

        <div className="license-gate__footer">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.electronAPI?.shell.openExternal('https://cnaxsoftware.pro/products/crypto-terminal')
            }}
          >
            Buy a license
          </a>
          {' · '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.electronAPI?.shell.openExternal('mailto:support@cnaxsoftware.pro')
            }}
          >
            Support
          </a>
          {' · '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.electronAPI?.shell.openExternal('https://cnaxsoftware.pro/verify')
            }}
          >
            Verify key
          </a>
        </div>

      </div>
    </div>
  )
}
