import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/ipcTypes'

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS
})

export const settingsService = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return store.get(key)
  },

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    store.set(key, value)
  },

  getAll(): AppSettings {
    return store.store
  },

  setNested(path: string, value: unknown): void {
    store.set(path, value)
  },

  getNested(path: string): unknown {
    return store.get(path as keyof AppSettings)
  }
}
