import { ipcMain } from 'electron'
import { settingsService } from '../services/settingsService'
import { AppSettings } from '../../shared/ipcTypes'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_event, { key }: { key: keyof AppSettings }) => {
    return settingsService.get(key)
  })

  ipcMain.handle('settings:set', (_event, { key, value }: { key: keyof AppSettings; value: unknown }) => {
    settingsService.set(key, value as AppSettings[typeof key])
    return true
  })

  ipcMain.handle('settings:getAll', () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:setNested', (_event, { path, value }: { path: string; value: unknown }) => {
    settingsService.setNested(path, value)
    return true
  })
}
