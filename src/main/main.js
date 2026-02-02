const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
// 1. 引入刚才写的模块
const WindowStateManager = require('./windowState'); 

function createWindow () {
  // 2. 初始化状态管理器
  const stateManager = new WindowStateManager();
  const state = stateManager.getState();

  // 3. 使用加载的状态创建窗口
  const mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false 
    }
  })

  // 4. 让管理器接管这个窗口（自动绑定 close 事件进行保存）
  stateManager.manage(mainWindow);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }]
    }).then(result => {
      if (!result.canceled) {
        event.reply('selected-file', result.filePaths[0])
      }
    }).catch(err => console.log(err))
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