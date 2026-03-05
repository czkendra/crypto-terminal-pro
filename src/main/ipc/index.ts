import { BrowserWindow } from 'electron'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerTelegramHandlers } from './telegramHandlers'
import { registerShellHandlers } from './shellHandlers'

export function registerAllHandlers(win: BrowserWindow): void {
  registerSettingsHandlers()
  registerTelegramHandlers(win)
  registerShellHandlers()
}
