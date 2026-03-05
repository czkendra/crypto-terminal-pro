import React, { useState } from 'react'
import { useTelegramStore } from '../../store/telegramStore'

export function TelegramAuth() {
  const authState = useTelegramStore((s) => s.authState)
  const authError = useTelegramStore((s) => s.authError)

  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStartAuth = async () => {
    if (!apiId || !apiHash || !phone) return
    setLoading(true)
    try {
      await window.electronAPI.telegram.startAuth(Number(apiId), apiHash, phone)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitCode = async () => {
    if (!code) return
    setLoading(true)
    try {
      await window.electronAPI.telegram.submitCode(code)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPassword = async () => {
    if (!password) return
    setLoading(true)
    try {
      await window.electronAPI.telegram.submitPassword(password)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    await window.electronAPI.telegram.disconnect()
  }

  if (authState === 'connected') {
    return (
      <div className="auth-connected">
        <div className="auth-connected-badge">
          <span className="status-dot connected" />
          <span className="positive">CONNECTED TO TELEGRAM</span>
        </div>
        <p className="secondary" style={{ marginTop: '8px', fontSize: 'var(--font-size-sm)' }}>
          Your session is active. Go to "Channels" tab to select which channels to monitor.
        </p>
        <button className="terminal-btn" onClick={handleDisconnect} style={{ marginTop: '16px' }}>
          DISCONNECT
        </button>
      </div>
    )
  }

  return (
    <div className="auth-form">
      <div className="auth-info">
        <p className="secondary">
          To access Telegram channels, you need a Telegram API ID and Hash.
        </p>
        <p className="secondary" style={{ marginTop: '6px' }}>
          Get them at:{' '}
          <span className="accent">my.telegram.org</span>
          {' → '}API Development Tools
        </p>
      </div>

      {authState === 'idle' || authState === 'error' ? (
        <div className="auth-step">
          <div className="form-group">
            <label className="form-label">API ID</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="12345678"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">API HASH</label>
            <input
              className="terminal-input"
              type="password"
              placeholder="abcdef1234567890abcdef1234567890"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">PHONE NUMBER (with country code)</label>
            <input
              className="terminal-input"
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {authError && (
            <div className="auth-error negative">{authError}</div>
          )}
          <button
            className="terminal-btn primary"
            onClick={handleStartAuth}
            disabled={loading || !apiId || !apiHash || !phone}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'CONNECTING...' : 'CONNECT'}
          </button>
        </div>
      ) : authState === 'sending_code' ? (
        <div className="auth-step">
          <div className="auth-status warning">
            Sending verification code to {phone}...
          </div>
        </div>
      ) : authState === 'awaiting_code' ? (
        <div className="auth-step">
          <div className="auth-status secondary">
            Enter the code sent to your Telegram app or SMS:
          </div>
          <div className="form-group">
            <label className="form-label">VERIFICATION CODE</label>
            <input
              className="terminal-input"
              type="text"
              placeholder="12345"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitCode()}
              autoFocus
              maxLength={10}
            />
          </div>
          <button
            className="terminal-btn primary"
            onClick={handleSubmitCode}
            disabled={loading || !code}
          >
            {loading ? 'VERIFYING...' : 'SUBMIT CODE'}
          </button>
        </div>
      ) : authState === 'awaiting_password' ? (
        <div className="auth-step">
          <div className="auth-status secondary">
            Two-factor authentication is enabled. Enter your cloud password:
          </div>
          <div className="form-group">
            <label className="form-label">2FA PASSWORD</label>
            <input
              className="terminal-input"
              type="password"
              placeholder="Your 2FA password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitPassword()}
              autoFocus
            />
          </div>
          <button
            className="terminal-btn primary"
            onClick={handleSubmitPassword}
            disabled={loading || !password}
          >
            {loading ? 'VERIFYING...' : 'SUBMIT PASSWORD'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
