import Store from 'electron-store'
import { createHash } from 'crypto'
import { networkInterfaces } from 'os'
import { AppSettings } from '../../shared/ipcTypes'

const VALIDATE_URL = 'https://cnaxsoftware.pro/api/licenses/validate'
const ACTIVATE_URL = 'https://cnaxsoftware.pro/api/licenses/activate'
const DEACTIVATE_URL = 'https://cnaxsoftware.pro/api/licenses/deactivate'

// Re-validate every 12 hours
const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000

const store = new Store<AppSettings>({ name: 'config' })

/** Stable device fingerprint based on MAC addresses */
function getDeviceId(): string {
  const nets = networkInterfaces()
  const macs: string[] = []
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macs.push(iface.mac)
      }
    }
  }
  macs.sort()
  return createHash('sha256').update(macs.join('|')).digest('hex').slice(0, 32)
}

export const licenseService = {
  getDeviceId,

  getStored() {
    return store.get('license') as AppSettings['license'] | undefined
  },

  clearStored() {
    store.delete('license' as keyof AppSettings)
  },

  /** Activate a new license key — calls the server, stores result */
  async activate(key: string): Promise<{ success: boolean; error?: string }> {
    const deviceId = getDeviceId()
    try {
      const res = await fetch(ACTIVATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, deviceId }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (!data.success) {
        return { success: false, error: data.error || 'Activation failed' }
      }
      // Persist to local store
      store.set('license', {
        key,
        tier: data.tier,
        expiresAt: data.expiresAt ?? null,
        activatedAt: new Date().toISOString(),
        deviceId,
        lastChecked: Date.now(),
      })
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Could not reach activation server. Check your internet connection.' }
    }
  },

  /** Re-validate stored license against server. Returns true if still valid. */
  async revalidate(): Promise<boolean> {
    const stored = licenseService.getStored()
    if (!stored) return false

    // If checked recently, check local expiry only
    const now = Date.now()
    if (now - stored.lastChecked < RECHECK_INTERVAL_MS) {
      // Offline grace: check expiry locally
      if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
        licenseService.clearStored()
        return false
      }
      return true
    }

    try {
      const res = await fetch(`${VALIDATE_URL}?key=${stored.key}`, {
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()
      if (!data.valid) {
        licenseService.clearStored()
        return false
      }
      // Refresh lastChecked and expiry
      store.set('license', {
        ...stored,
        expiresAt: data.expiresAt ?? null,
        lastChecked: Date.now(),
      })
      return true
    } catch {
      // Network error — allow 7-day offline grace period
      const daysSinceCheck = (now - stored.lastChecked) / (1000 * 60 * 60 * 24)
      if (daysSinceCheck > 7) {
        licenseService.clearStored()
        return false
      }
      return true
    }
  },

  /** Deactivate this device (called on uninstall or manual deactivation) */
  async deactivate(): Promise<void> {
    const stored = licenseService.getStored()
    if (!stored) return
    try {
      await fetch(DEACTIVATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: stored.key, deviceId: stored.deviceId }),
        signal: AbortSignal.timeout(8000),
      })
    } catch { /* best effort */ }
    licenseService.clearStored()
  },
}
