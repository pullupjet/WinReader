const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false 
    }
  })

  // 修改：指向 src/renderer/index.html
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