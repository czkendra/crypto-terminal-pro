import { contextBridge, ipcRenderer } from 'electron'
import type { TelegramMessage, AuthStatusEvent, ChannelInfo, AppSettings } from '../shared/ipcTypes'

const electronAPI = {
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', { url })
  },

  dialog: {
    exportCsv: (csvContent: string, filename: string) =>
      ipcRenderer.invoke('dialog:exportCsv', { csvContent, filename })
  },
  telegram: {
    startAuth: (apiId: number, apiHash: string, phone: string) =>
      ipcRenderer.invoke('telegram:startAuth', { apiId, apiHash, phone }),

    submitCode: (code: string) =>
      ipcRenderer.invoke('telegram:submitCode', { code }),

    submitPassword: (password: string) =>
      ipcRenderer.invoke('telegram:submitPassword', { password }),

    disconnect: () =>
      ipcRenderer.invoke('telegram:disconnect'),

    getChannels: (): Promise<ChannelInfo[]> =>
      ipcRenderer.invoke('telegram:getChannels'),

    setWatchedChannels: (channelIds: string[]) =>
      ipcRenderer.invoke('telegram:setWatchedChannels', { channelIds }),

    getStatus: (): Promise<AuthStatusEvent> =>
      ipcRenderer.invoke('telegram:getStatus'),

    getWatchedChannels: (): Promise<string[]> =>
      ipcRenderer.invoke('telegram:getWatchedChannels'),

    onMessage: (callback: (msg: TelegramMessage) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: TelegramMessage) => callback(data)
      ipcRenderer.on('telegram:message', handler)
      return () => ipcRenderer.removeListener('telegram:message', handler)
    },

    onAuthStatus: (callback: (status: AuthStatusEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AuthStatusEvent) => callback(data)
      ipcRenderer.on('telegram:authStatus', handler)
      return () => ipcRenderer.removeListener('telegram:authStatus', handler)
    }
  },

  settings: {
    get: (key: keyof AppSettings) =>
      ipcRenderer.invoke('settings:get', { key }),

    set: (key: keyof AppSettings, value: unknown) =>
      ipcRenderer.invoke('settings:set', { key, value }),

    getAll: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:getAll'),

    setNested: (path: string, value: unknown) =>
      ipcRenderer.invoke('settings:setNested', { path, value })
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
