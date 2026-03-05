import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUiStore } from '../../store/uiStore'
import { TelegramAuth } from './TelegramAuth'
import { ChannelManager } from './ChannelManager'
import { ExchangeToggles } from './ExchangeToggles'
import './settings-modal.css'

type SettingsTab = 'telegram' | 'channels' | 'exchanges' | 'patterns'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'telegram', label: 'TELEGRAM AUTH' },
  { id: 'channels', label: 'CHANNELS' },
  { id: 'exchanges', label: 'EXCHANGES' },
  { id: 'patterns', label: 'SIGNAL PATTERNS' }
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
