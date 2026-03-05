import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUiStore } from '../../store/uiStore'
import { useLicenseStore } from '../../store/licenseStore'
import { TelegramAuth } from './TelegramAuth'
import { ChannelManager } from './ChannelManager'
import { ExchangeToggles } from './ExchangeToggles'
import './settings-modal.css'

type SettingsTab = 'telegram' | 'channels' | 'exchanges' | 'patterns' | 'license'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'telegram', label: 'TELEGRAM AUTH' },
  { id: 'channels', label: 'CHANNELS' },
  { id: 'exchanges', label: 'EXCHANGES' },
  { id: 'patterns', label: 'SIGNAL PATTERNS' },
  { id: 'license', label: 'LICENSE' }
]

function SignalPatterns() {
  const patterns = [
    { name: 'DIRECTION', pattern: '/\\b(LONG|SHORT|BUY|SELL)\\b/i', desc: 'Detects trade direction' },
    { name: 'SYMBOL', pattern: '/\\b([A-Z]{2,10})[\\/\\-]?(USDT|BUSD|USD|BTC)\\b/i', desc: 'Matches trading pair' },
    { name: 'ENTRY', pattern: '/(?:entry|enter|buy at)\\s*[:@]?\\s*(\\d+\\.?\\d*)\\s*[-–]?\\s*(\\d*)/i', desc: 'Entry price (range or single)' },
    { name: 'TAKE PROFIT', pattern: '/(?:tp|target|take profit)\\s*([1-5]?)\\s*[:@]?\\s*(\\d+\\.?\\d*)/gi', desc: 'TP1, TP2, TP3 levels' },
    { name: 'STOP LOSS', pattern: '/(?:sl|stop loss|stoploss)\\s*[:@]?\\s*(\\d+\\.?\\d*)/i', desc: 'Stop loss level' },
    { name: 'LEVERAGE', pattern: '/(\\d+)\\s*[xX×]|leverage\\s*[:=]?\\s*(\\d+)/i', desc: 'Leverage multiplier' }
  ]

  return (
    <div className="signal-patterns">
      <p className="secondary" style={{ marginBottom: '12px', fontSize: 'var(--font-size-sm)' }}>
        These regex patterns are used to extract structured data from Telegram messages.
      </p>
      <table className="terminal-table patterns-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>FIELD</th>
            <th style={{ textAlign: 'left' }}>PATTERN</th>
            <th style={{ textAlign: 'left' }}>DESCRIPTION</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((p) => (
            <tr key={p.name}>
              <td className="accent" style={{ fontWeight: 600 }}>{p.name}</td>
              <td>
                <code className="pattern-code secondary">{p.pattern}</code>
              </td>
              <td className="dim" style={{ fontSize: 'var(--font-size-xs)' }}>{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim" style={{ marginTop: '16px', fontSize: 'var(--font-size-xs)' }}>
        Custom pattern editing will be available in a future update.
      </p>
    </div>
  )
}

function LicenseSettings() {
  const { license, deactivate } = useLicenseStore()
  const tierLabel = license?.tier?.toUpperCase() ?? 'UNKNOWN'
  const expires = license?.expiresAt
    ? new Date(license.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Never (Lifetime)'

  const handleDeactivate = async () => {
    if (window.confirm('Deactivate this device? You can reactivate later with the same key.')) {
      await deactivate()
    }
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <p className="secondary" style={{ marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
        Your license information for this device.
      </p>
      {license ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'KEY', value: license.key },
            { label: 'TIER', value: tierLabel },
            { label: 'EXPIRES', value: expires },
            { label: 'ACTIVATED', value: new Date(license.activatedAt).toLocaleDateString() },
            { label: 'DEVICE ID', value: license.deviceId.slice(0, 16) + '...' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 'var(--font-size-xs)' }}>
              <span className="dim" style={{ letterSpacing: '0.08em' }}>{label}</span>
              <span className="accent" style={{ fontWeight: 600, fontFamily: 'Courier New', letterSpacing: '0.05em' }}>{value}</span>
            </div>
          ))}
          <button
            onClick={handleDeactivate}
            style={{
              marginTop: '16px', background: 'transparent',
              border: '1px solid #ff4444', color: '#ff6060',
              fontFamily: 'Courier New', fontSize: 11, letterSpacing: '0.1em',
              padding: '10px', cursor: 'pointer',
            }}
          >
            DEACTIVATE THIS DEVICE
          </button>
          <p className="dim" style={{ fontSize: 10, marginTop: 4 }}>
            Deactivating frees up a device slot so you can activate on another machine.
          </p>
        </div>
      ) : (
        <p className="dim">No license found.</p>
      )}
    </div>
  )
}

function SettingsContent() {
  const activeTab = useUiStore((s) => s.settingsTab)
  const setTab = useUiStore((s) => s.setSettingsTab)
  const close = useUiStore((s) => s.closeSettings)

  return (
    <div className="settings-modal">
      <div className="settings-modal-header">
        <span className="settings-title accent">⚙ SETTINGS</span>
        <button className="settings-close-btn terminal-btn" onClick={close}>
          ✕ CLOSE
        </button>
      </div>

      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'telegram' && <TelegramAuth />}
        {activeTab === 'channels' && <ChannelManager />}
        {activeTab === 'exchanges' && <ExchangeToggles />}
        {activeTab === 'patterns' && <SignalPatterns />}
        {activeTab === 'license' && <LicenseSettings />}
      </div>
    </div>
  )
}

export function SettingsModal() {
  const isOpen = useUiStore((s) => s.isSettingsOpen)
  const close = useUiStore((s) => s.closeSettings)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, close])

  if (!isOpen) return null

  return createPortal(
    <div className="settings-backdrop" onClick={close}>
      <div className="settings-container" onClick={(e) => e.stopPropagation()}>
        <SettingsContent />
      </div>
    </div>,
    document.body
  )
}
