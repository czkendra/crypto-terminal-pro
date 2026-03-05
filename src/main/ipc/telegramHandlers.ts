import { ipcMain, BrowserWindow } from 'electron'
import { telegramService } from '../services/telegramService'

export function registerTelegramHandlers(win: BrowserWindow): void {
  // Push messages to renderer
  telegramService.onMessage((msg) => {
    if (!win.isDestroyed()) {
      win.webContents.send('telegram:message', msg)
    }
  })

  // Push auth status to renderer
  telegramService.onStatus((status) => {
    if (!win.isDestroyed()) {
      win.webContents.send('telegram:authStatus', status)
    }
  })

  ipcMain.handle('telegram:startAuth', async (_event, { apiId, apiHash, phone }) => {
    return telegramService.startAuth(Number(apiId), apiHash, phone)
  })

  ipcMain.handle('telegram:submitCode', (_event, { code }) => {
    telegramService.submitCode(code)
    return true
  })

  ipcMain.handle('telegram:submitPassword', (_event, { password }) => {
    telegramService.submitPassword(password)
    return true
  })

  ipcMain.handle('telegram:disconnect', async () => {
    await telegramService.disconnect()
    return true
  })

  ipcMain.handle('telegram:getChannels', async () => {
    return telegramService.getChannels()
  })

  ipcMain.handle('telegram:setWatchedChannels', (_event, { channelIds }) => {
    telegramService.setWatchedChannels(channelIds)
    return true
  })

  ipcMain.handle('telegram:getStatus', () => {
    return telegramService.getStatus()
  })

  ipcMain.handle('telegram:getWatchedChannels', () => {
    return telegramService.getWatchedChannels()
  })
}
