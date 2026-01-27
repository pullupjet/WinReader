const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 这里的配置至关重要，决定了 index.html 能不能调用系统功能
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // 可选：如果你遇到图片加载问题，可以暂时关掉安全策略
    }
  })

  mainWindow.loadFile('index.html')

  // 打开调试窗口，这样你启动时直接就能看到报错
  // mainWindow.webContents.openDevTools()

  // --- 关键：处理打开文件请求 ---
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }]
    }).then(result => {
      if (!result.canceled) {
        // 用户选了文件，发回去
        event.reply('selected-file', result.filePaths[0])
      }
    }).catch(err => {
      console.log('打开文件出错:', err)
    })
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})