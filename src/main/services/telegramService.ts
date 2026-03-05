import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, NewMessageEvent } from 'telegram/events'
import { Api } from 'telegram'
import { TelegramMessage, AuthStatusEvent, ChannelInfo } from '../../shared/ipcTypes'
import { settingsService } from './settingsService'

class TelegramService {
  private client: TelegramClient | null = null
  private resolveCode: ((code: string) => void) | null = null
  private resolvePassword: ((pw: string) => void) | null = null
  private messageCallbacks: ((msg: TelegramMessage) => void)[] = []
  private statusCallbacks: ((status: AuthStatusEvent) => void)[] = []
  private watchedChannels: Set<string> = new Set()
  private channelNames: Map<string, string> = new Map()
  private isConnected = false

  async startAuth(
    apiId: number,
    apiHash: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const savedSession = settingsService.getNested('telegram.session') as string || ''
      const session = new StringSession(savedSession)

      this.client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false
      })

      this.pushStatus({ state: 'sending_code' })

      await this.client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => {
          this.pushStatus({ state: 'awaiting_code' })
          return new Promise<string>((resolve) => {
            this.resolveCode = resolve
          })
        },
        password: async () => {
          this.pushStatus({ state: 'awaiting_password' })
          return new Promise<string>((resolve) => {
            this.resolvePassword = resolve
          })
        },
        onError: (err) => {
          this.pushStatus({ state: 'error', error: err.message })
        }
      })

      const sessionString = this.client.session.save() as string
      settingsService.setNested('telegram.session', sessionString)
      settingsService.setNested('telegram.apiId', apiId)
      settingsService.setNested('telegram.apiHash', apiHash)
      settingsService.setNested('telegram.phone', phone)

      this.isConnected = true
      this.pushStatus({ state: 'connected' })
      this.registerMessageListener()

      // Restore watched channels
      const watched = settingsService.getNested('telegram.watchedChannels') as string[] || []
      this.watchedChannels = new Set(watched)

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.pushStatus({ state: 'error', error: msg })
      return { success: false, error: msg }
    }
  }

  async tryAutoConnect(): Promise<boolean> {
    try {
      const apiId = settingsService.getNested('telegram.apiId') as number
      const apiHash = settingsService.getNested('telegram.apiHash') as string
      const savedSession = settingsService.getNested('telegram.session') as string

      if (!apiId || !apiHash || !savedSession) return false

      const session = new StringSession(savedSession)
      this.client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 3,
        useWSS: false
      })

      await this.client.connect()

      const isAuthorized = await this.client.isUserAuthorized()
      if (!isAuthorized) return false

      this.isConnected = true
      this.pushStatus({ state: 'connected' })
      this.registerMessageListener()

      const watched = settingsService.getNested('telegram.watchedChannels') as string[] || []
      this.watchedChannels = new Set(watched)

      return true
    } catch {
      return false
    }
  }

  submitCode(code: string): void {
    if (this.resolveCode) {
      this.resolveCode(code)
      this.resolveCode = null
    }
  }

  submitPassword(password: string): void {
    if (this.resolvePassword) {
      this.resolvePassword(password)
      this.resolvePassword = null
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
    }
    this.isConnected = false
    settingsService.setNested('telegram.session', '')
    this.pushStatus({ state: 'idle' })
  }

  async getChannels(): Promise<ChannelInfo[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to Telegram')
    }

    const dialogs = await this.client.getDialogs({ limit: 100 })
    const channels: ChannelInfo[] = []

    for (const dialog of dialogs) {
      if (dialog.isChannel || dialog.isGroup) {
        const entity = dialog.entity as Api.Channel | Api.Chat | null
        if (!entity) continue

        const id = entity.id?.toString() || ''
        const title = dialog.title || 'Unknown'
        this.channelNames.set(id, title)

        channels.push({
          id,
          title,
          username: (entity as Api.Channel).username || undefined,
          isPrivate: !(entity as Api.Channel).username,
          memberCount: (entity as Api.Channel).participantsCount || undefined
        })
      }
    }

    return channels
  }

  setWatchedChannels(channelIds: string[]): void {
    this.watchedChannels = new Set(channelIds)
    settingsService.setNested('telegram.watchedChannels', channelIds)
  }

  getWatchedChannels(): string[] {
    return Array.from(this.watchedChannels)
  }

  onMessage(callback: (msg: TelegramMessage) => void): void {
    this.messageCallbacks.push(callback)
  }

  onStatus(callback: (status: AuthStatusEvent) => void): void {
    this.statusCallbacks.push(callback)
  }

  getStatus(): AuthStatusEvent {
    return { state: this.isConnected ? 'connected' : 'idle' }
  }

  private pushStatus(status: AuthStatusEvent): void {
    this.statusCallbacks.forEach(cb => cb(status))
  }

  private registerMessageListener(): void {
    if (!this.client) return

    this.client.addEventHandler(async (event: NewMessageEvent) => {
      const msg = event.message
      if (!msg || !msg.text) return

      const peerId = msg.peerId as Api.PeerChannel | Api.PeerChat | null
      const channelId = (peerId as Api.PeerChannel)?.channelId?.toString() ||
                        (peerId as Api.PeerChat)?.chatId?.toString() || ''

      if (this.watchedChannels.size > 0 && !this.watchedChannels.has(channelId)) return

      const channelName = this.channelNames.get(channelId) || `Channel ${channelId}`

      const outgoing: TelegramMessage = {
        id: msg.id,
        channelId,
        channelName,
        text: msg.text,
        timestamp: (msg.date || 0) * 1000,
        mediaType: null
      }

      this.messageCallbacks.forEach(cb => cb(outgoing))
    }, new NewMessage({}))
  }
}

export const telegramService = new TelegramService()
