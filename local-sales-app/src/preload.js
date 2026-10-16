const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCandidates: () => ipcRenderer.invoke('get-candidates'),
  saveCandidate: (candidate) => ipcRenderer.invoke('save-candidate', candidate),
  saveCandidates: (candidates) => ipcRenderer.invoke('save-candidates', candidates),
  deleteCandidate: (id) => ipcRenderer.invoke('delete-candidate', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor()
});
