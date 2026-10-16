const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Store = require('./store');

console.log('====== STARTING ELECTRON ======');
try {
  app.disableHardwareAcceleration();
} catch (e) {}

// Initialize the store
const store = new Store({
  configName: 'user-preferences',
  defaults: {
    candidates: {}, // candidates keyed by ID
    globalSettings: {
      halfLitreCost: 100, // default costs
      litreCost: 200,
      zoomFactor: 1.0
    }
  }
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    icon: path.join(__dirname, 'logo.png'), // Add custom icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove the default Electron menu bar
  mainWindow.setMenuBarVisibility(false);
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  // Enable DevTools shortcut (F12) and Reload (Ctrl+R / F5) for easy testing
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
        mainWindow.reload();
        event.preventDefault();
      }
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

// Setup IPC Handlers before ready
ipcMain.handle('get-candidates', async () => {
  return await store.getCandidates();
});

ipcMain.handle('save-candidate', async (event, candidate) => {
  return await store.saveCandidate(candidate);
});

ipcMain.handle('save-candidates', async (event, candidates) => {
  return await store.saveCandidates(candidates);
});

ipcMain.handle('delete-candidate', async (event, id) => {
  return await store.deleteCandidate(id);
});

ipcMain.handle('get-settings', async () => {
  return await store.getSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  return await store.saveSettings(settings);
});

ipcMain.handle('export-backup', async (event) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Database Backup',
    defaultPath: `LocalSales_Backup_${new Date().toISOString().split('T')[0]}.sqlite`,
    filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
  });
  if (canceled) return false;
  
  try {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    fs.copyFileSync(dbPath, filePath);
    return true;
  } catch (err) {
    console.error('Export failed', err);
    return false;
  }
});

ipcMain.handle('restore-backup', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore Database Backup',
    filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return false;

  try {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    
    // Close the current DB connection so we can overwrite the file
    if (store.db) {
      store.db.close();
    }
    
    fs.copyFileSync(filePaths[0], dbPath);
    
    // Relaunch app
    app.relaunch();
    app.exit();
    return true;
  } catch (err) {
    console.error('Restore failed', err);
    return false;
  }
});

ipcMain.handle('clear-database', async () => {
  try {
    await store.clearDatabase();
    app.relaunch();
    app.exit();
    return true;
  } catch (err) {
    console.error('Clear DB failed', err);
    return false;
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
