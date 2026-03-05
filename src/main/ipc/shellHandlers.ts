import { ipcMain, shell, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export function registerShellHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_event, { url }: { url: string }) => {
    const allowed = url.startsWith('https://') || url.startsWith('http://')
    if (allowed) {
      await shell.openExternal(url)
    }
  })

  ipcMain.handle(
    'dialog:exportCsv',
    async (_event, { csvContent, filename }: { csvContent: string; filename: string }) => {
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false }
      await writeFile(filePath, csvContent, 'utf-8')
      return { success: true, path: filePath }
    }
  )
}
