const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('prismaArchitectureDesktop', { takeProject: () => ipcRenderer.invoke('architecture-take-project') });
ipcRenderer.on('architecture-open-file', (_event, text) => window.dispatchEvent(new CustomEvent('prisma-architecture-file', { detail: text })));
