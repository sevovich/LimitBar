import path from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from 'electron'
import type { AppState } from '../shared/contracts'
import { formatProviderTrayTitle } from '../shared/usage'
import { assertSettingsPatch, UsageCoordinator } from './coordinator'
import { StateStore } from './store'

let codexTray: Tray | null = null
let claudeTray: Tray | null = null
let popover: BrowserWindow | null = null
let coordinator: UsageCoordinator | null = null
let quitting = false

app.setName('LimitBar')

function createTray(): void {
  codexTray = createProviderTray('#168067', 'Codex limits')
  claudeTray = createProviderTray('#b45b36', 'Claude limits')
}

function createProviderTray(color: string, tooltip: string): Tray {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" fill="${color}" opacity=".18"/>
      <circle cx="9" cy="9" r="5.25" fill="none" stroke="${color}" stroke-width="1.8"/>
      <circle cx="9" cy="9" r="1.7" fill="${color}"/>
    </svg>`
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  )
  icon.setTemplateImage(false)
  const providerTray = new Tray(icon)
  providerTray.setToolTip(tooltip)
  providerTray.on('click', () => togglePopover(providerTray))
  providerTray.on('right-click', () => providerTray.popUpContextMenu(buildContextMenu()))
  return providerTray
}

function createPopover(): void {
  popover = new BrowserWindow({
    width: 404,
    height: 500,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })
  popover.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  void popover.loadFile(path.join(__dirname, '../renderer/index.html'))
  popover.on('blur', () => {
    if (!popover?.webContents.isDevToolsOpened()) popover?.hide()
  })
  popover.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      popover?.hide()
    }
  })
}

function togglePopover(sourceTray: Tray): void {
  if (!popover) return
  if (popover.isVisible()) {
    popover.hide()
    return
  }
  const trayBounds = sourceTray.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const windowBounds = popover.getBounds()
  const x = Math.round(
    Math.min(
      display.workArea.x + display.workArea.width - windowBounds.width - 8,
      Math.max(display.workArea.x + 8, trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2),
    ),
  )
  const y = Math.round(trayBounds.y + trayBounds.height + 6)
  popover.setPosition(x, y, false)
  popover.show()
  popover.focus()
}

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Refresh now', click: () => void coordinator?.refresh() },
    { type: 'separator' },
    { label: 'Quit LimitBar', click: () => app.quit() },
  ])
}

function updateUi(state: AppState): void {
  codexTray?.setTitle(` ${formatProviderTrayTitle(state.providers.codex, state.settings)}`, {
    fontType: 'monospacedDigit',
  })
  claudeTray?.setTitle(` ${formatProviderTrayTitle(state.providers.claude, state.settings)}`, {
    fontType: 'monospacedDigit',
  })
  if (popover && !popover.isDestroyed()) popover.webContents.send('state:changed', state)
}

function registerIpc(): void {
  ipcMain.handle('state:get', () => coordinator?.getState())
  ipcMain.handle('state:refresh', () => coordinator?.refresh())
  ipcMain.handle('settings:update', (_event, value: unknown) =>
    coordinator?.updateSettings(assertSettingsPatch(value)),
  )
  ipcMain.on('window:set-settings-open', (_event, open: unknown) => {
    if (!popover || typeof open !== 'boolean') return
    const [width] = popover.getSize()
    popover.setSize(width, open ? 720 : 500, true)
  })
  ipcMain.on('app:quit', () => app.quit())
}

app.whenReady().then(async () => {
  app.dock?.hide()
  createTray()
  createPopover()
  registerIpc()
  coordinator = new UsageCoordinator(
    new StateStore(app.getPath('userData')),
    (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
  )
  coordinator.subscribe(updateUi)
  await coordinator.start()
})

app.on('before-quit', () => {
  quitting = true
  coordinator?.stop()
})

app.on('window-all-closed', () => {})
