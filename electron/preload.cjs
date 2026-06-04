const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendWebhook: (data) => ipcRenderer.invoke('webhook:send', data),
});
