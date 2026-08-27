const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', Boolean(enabled))
});
