const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('melyiaElectron', {
  isElectron: true,

  // Receive an auto-capture from main process (triggered by tray menu or global hotkey)
  onAutoCapture: (callback) => {
    ipcRenderer.on('auto-capture', (_, data) => callback(data));
  },

  // Receive a "open this modal" command from main process
  onOpenModal: (callback) => {
    ipcRenderer.on('open-modal', (_, type) => callback(type));
  },

  // Receive a capture error from main process
  onCaptureError: (callback) => {
    ipcRenderer.on('capture-error', (_, message) => callback(message));
  },

  // Trigger a capture from the renderer (in-app button)
  triggerCapture: (type) => ipcRenderer.invoke('trigger-capture', type),

  showWindow: () => ipcRenderer.invoke('show-window'),
  hideToTray: () => ipcRenderer.invoke('hide-to-tray'),

  // Extraction du texte d'un PDF (devis Logos) côté main (pdf-parse)
  extractPdfText: (base64) => ipcRenderer.invoke('extract-pdf-text', base64),

  getAppInfo: () => ipcRenderer.invoke('app-info'),

  // Google OAuth (PKCE flow via loopback http server)
  googleSignIn: (params) => ipcRenderer.invoke('google-sign-in', params),
  googleRefreshToken: (params) => ipcRenderer.invoke('google-refresh-token', params),

  // Auto-launch Windows
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // Notification système + tray dynamique
  notifyRelances: ({ count, names }) => ipcRenderer.invoke('notify-relances', { count, names }),

  // Auto-updater (electron-updater + GitHub Releases)
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdateNow: () => ipcRenderer.invoke('install-update-now'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_, payload) => callback(payload));
  }
});
