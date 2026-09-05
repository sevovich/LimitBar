import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, LimitBarApi, SettingsPatch } from '../shared/contracts'

const api: LimitBarApi = {
  getState: () => ipcRenderer.invoke('state:get') as Promise<AppState>,
  refresh: () => ipcRenderer.invoke('state:refresh') as Promise<AppState>,
  updateSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<AppState>,
  subscribe: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppState) => listener(state)
    ipcRenderer.on('state:changed', handler)
    return () => ipcRenderer.removeListener('state:changed', handler)
  },
  setSettingsOpen: (open) => ipcRenderer.send('window:set-settings-open', open),
  quit: () => ipcRenderer.send('app:quit'),
}

contextBridge.exposeInMainWorld('limitBar', api)
