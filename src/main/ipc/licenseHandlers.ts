import { ipcMain } from 'electron'
import { licenseService } from '../services/licenseService'

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:getStored', () => {
    return licenseService.getStored() ?? null
  })

  ipcMain.handle('license:getDeviceId', () => {
    return licenseService.getDeviceId()
  })

  ipcMain.handle('license:activate', async (_event, { key }: { key: string }) => {
    return licenseService.activate(key)
  })

  ipcMain.handle('license:revalidate', async () => {
    return licenseService.revalidate()
  })

  ipcMain.handle('license:deactivate', async () => {
    await licenseService.deactivate()
    return true
  })
}
