import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { telegramService } from './services/telegramService'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    frame: true,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Allow renderer to fetch external APIs (news, binance, etc.)
      webSecurity: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.cryptoterminal.app')

  // Remove CSP headers that block external fetches from the renderer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "script-src * 'unsafe-inline' 'unsafe-eval'; " +
          "connect-src *; " +
          "img-src * data: blob:; " +
          "frame-src *; " +
          "style-src * 'unsafe-inline';"
        ]
      }
    })
  })

  app.on('browser-window-created', (_, win) => {
    optimizer.watchWindowShortcuts(win)
  })

  const win = createWindow()
  registerAllHandlers(win)

  // Attempt auto-reconnect to Telegram
  setTimeout(async () => {
    await telegramService.tryAutoConnect()
  }, 2000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
