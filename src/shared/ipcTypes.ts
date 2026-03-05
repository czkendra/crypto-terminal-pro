export interface TelegramMessage {
  id: number
  channelId: string
  channelName: string
  text: string
  timestamp: number
  mediaType?: 'photo' | 'document' | null
}

export interface AuthStatusEvent {
  state: 'idle' | 'sending_code' | 'awaiting_code' | 'awaiting_password' | 'connected' | 'error'
  error?: string
}

export interface ChannelInfo {
  id: string
  title: string
  username?: string
  isPrivate: boolean
  memberCount?: number
}

export interface LicenseInfo {
  key: string
  tier: 'basic' | 'pro' | 'lifetime'
  status: 'active' | 'expired' | 'invalid'
  expiresAt: string | null   // ISO string or null for lifetime
  activatedAt: string
  deviceId: string
}

export interface LicenseValidateResult {
  valid: boolean
  license?: LicenseInfo
  error?: string
}

export interface AppSettings {
  telegram: {
    apiId?: number
    apiHash?: string
    session?: string
    watchedChannels: string[]
    phone?: string
  }
  exchanges: {
    binance: boolean
    bybit: boolean
    okx: boolean
  }
  ui: {
    selectedSymbol: string
  }
  license?: {
    key: string
    tier: 'basic' | 'pro' | 'lifetime'
    expiresAt: string | null
    activatedAt: string
    deviceId: string
    lastChecked: number    // unix timestamp
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  telegram: {
    watchedChannels: []
  },
  exchanges: {
    binance: true,
    bybit: true,
    okx: true
  },
  ui: {
    selectedSymbol: 'BTCUSDT'
  }
}
