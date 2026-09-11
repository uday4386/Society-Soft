const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCandidates: () => ipcRenderer.invoke('get-candidates'),
  saveCandidate: (candidate) => ipcRenderer.invoke('save-candidate', candidate),
  deleteCandidate: (id) => ipcRenderer.invoke('delete-candidate', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  clearDatabase: () => ipcRenderer.invoke('clear-database')
});
