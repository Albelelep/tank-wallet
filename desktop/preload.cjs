const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tankDesktop', {
  mode: 'desktop',
  setSecureInput: (enabled) => ipcRenderer.invoke('tankwallet:setSecureInput', Boolean(enabled)),
  openExternal: (url) => ipcRenderer.invoke('tankwallet:openExternal', String(url || ''))
});
