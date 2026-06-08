import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const isMac = process.platform === 'darwin'

const template: Electron.MenuItemConstructorOptions[] = [
  ...(isMac ? [{
    label: '学术翻译器',
    submenu: [
      { role: 'about' as const, label: '关于 学术翻译器' },
      { type: 'separator' as const },
      { role: 'quit' as const, label: '退出' }
    ]
  }] : []),
  {
    label: '编辑',
    submenu: [
      { role: 'undo' as const, label: '撤销' },
      { role: 'redo' as const, label: '重做' },
      { type: 'separator' as const },
      { role: 'cut' as const, label: '剪切' },
      { role: 'copy' as const, label: '复制' },
      { role: 'paste' as const, label: '粘贴' },
      { role: 'selectAll' as const, label: '全选' }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

function createWindow(): void {
    const mainWindow = new BrowserWindow({
    width: 780,
    height: 520,
    minWidth: 640,
    minHeight: 420,
    show: false,
    frame: false,
    icon: join(__dirname, '../../icons/appicon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { height: 52 },
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    title: '学术翻译器',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow.close())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})
