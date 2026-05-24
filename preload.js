/**
 * SETT Telemetri - Electron Preload Script
 * Main process ile renderer arasında güvenli IPC köprüsü.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sett', {
  // Seri Port
  serial: {
    listPorts: () => ipcRenderer.invoke('serial:list-ports'),
    connect: (portPath, baudRate) => ipcRenderer.invoke('serial:connect', portPath, baudRate),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  },

  // Simülasyon
  simulation: {
    start: (profile) => ipcRenderer.invoke('simulation:start', profile),
    stop: () => ipcRenderer.invoke('simulation:stop'),
  },

  // CSV replay
  replay: {
    selectFile: () => ipcRenderer.invoke('replay:select-file'),
    start: (filePath, speed) => ipcRenderer.invoke('replay:start', filePath, speed),
    stop: () => ipcRenderer.invoke('replay:stop'),
    status: () => ipcRenderer.invoke('replay:status'),
  },

  // Loglama
  logging: {
    start: () => ipcRenderer.invoke('logging:start'),
    stop: () => ipcRenderer.invoke('logging:stop'),
    status: () => ipcRenderer.invoke('logging:status'),
  },

  // Uyarılar
  warnings: {
    getHistory: () => ipcRenderer.invoke('warnings:history'),
    getSettings: () => ipcRenderer.invoke('warnings:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('warnings:update-settings', settings),
    resetSettings: () => ipcRenderer.invoke('warnings:reset-settings'),
  },

  // Event listeners (Main → Renderer)
  on: {
    telemetryData: (callback) => ipcRenderer.on('telemetry-data', (e, data) => callback(data)),
    rawData: (callback) => ipcRenderer.on('raw-data', (e, line) => callback(line)),
    connectionStatus: (callback) => ipcRenderer.on('connection-status', (e, status) => callback(status)),
    warning: (callback) => ipcRenderer.on('warning', (e, warning) => callback(warning)),
    replayComplete: (callback) => ipcRenderer.on('replay-complete', () => callback()),
  },
});
