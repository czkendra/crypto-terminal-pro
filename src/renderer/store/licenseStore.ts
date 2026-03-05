import { create } from 'zustand'
import { AppSettings } from '../../shared/ipcTypes'

type StoredLicense = AppSettings['license']

type LicenseState =
  | 'loading'      // checking stored license on startup
  | 'unlicensed'   // no license stored
  | 'activating'   // user submitted key, waiting for server
  | 'valid'        // license active
  | 'expired'      // license expired
  | 'error'        // activation error

interface LicenseStore {
  state: LicenseState
  license: StoredLicense | null
  error: string | null

  // Actions
  init: () => Promise<void>
  activate: (key: string) => Promise<void>
  deactivate: () => Promise<void>
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  state: 'loading',
  license: null,
  error: null,

  init: async () => {
    if (!window.electronAPI) {
      set({ state: 'unlicensed' })
      return
    }

    const stored = await window.electronAPI.license.getStored()
    if (!stored) {
      set({ state: 'unlicensed' })
      return
    }

    // Check expiry locally first
    if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
      set({ state: 'expired', license: stored })
      return
    }

    // Re-validate with server (12h throttled in licenseService)
    const valid = await window.electronAPI.license.revalidate()
    if (valid) {
      const refreshed = await window.electronAPI.license.getStored()
      set({ state: 'valid', license: refreshed })
    } else {
      set({ state: 'expired', license: stored })
    }
  },

  activate: async (key: string) => {
    set({ state: 'activating', error: null })
    const result = await window.electronAPI.license.activate(key.trim().toUpperCase())
    if (result.success) {
      const stored = await window.electronAPI.license.getStored()
      set({ state: 'valid', license: stored, error: null })
    } else {
      set({ state: 'unlicensed', error: result.error ?? 'Activation failed' })
    }
  },

  deactivate: async () => {
    await window.electronAPI.license.deactivate()
    set({ state: 'unlicensed', license: null, error: null })
  },
}))
