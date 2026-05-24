/**
 * SETT Telemetri - Electron Ana Süreç
 * Seri port, dosya sistemi ve IPC yönetimi burada yapılır.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const SerialService = require('./src/services/serialService');
const SimulationService = require('./src/services/simulationService');
const ReplayService = require('./src/services/replayService');
const { createParser } = require('./src/services/parserService');
const { WarningService } = require('./src/services/warningService');
const LoggingService = require('./src/services/loggingService');
const DEFAULTS = require('./src/config/defaults');
const TelemetryPacket = require('./src/models/telemetry');

let mainWindow;
let serialService;
let simulationService;
let replayService;
let parser;
let warningService;
let loggingService;
let dataTimeoutChecker;

function getWarningSettingsPath() {
  return path.join(app.getPath('userData'), 'warning-thresholds.json');
}

function loadWarningSettings() {
  try {
    const filePath = getWarningSettingsPath();
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('Warning settings could not be loaded:', error.message);
    return null;
  }
}

function saveWarningSettings(settings) {
  const filePath = getWarningSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SETT Telemetri - Pit Dashboard',
    backgroundColor: '#0a0e17',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Dev tools açmak için: mainWindow.webContents.openDevTools();
}

function initServices() {
  serialService = new SerialService();
  simulationService = new SimulationService();
  replayService = new ReplayService();
  parser = createParser('json-line');
  warningService = new WarningService(loadWarningSettings());
  loggingService = new LoggingService(app.getAppPath());

  // Veri zaman aşımı kontrolü (her 1 saniye)
  dataTimeoutChecker = setInterval(() => {
    if (!hasActiveDataSource()) return;
    const timeout = warningService.checkDataTimeout();
    if (timeout && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('warning', timeout);
    }
  }, 1000);
}

function hasActiveDataSource() {
  return Boolean(
    (serialService && serialService.isConnected()) ||
    (simulationService && simulationService.isRunning()) ||
    (replayService && replayService.isRunning())
  );
}

function getPacketRateHz() {
  if (serialService && serialService.isConnected()) return serialService.getPacketRateHz();
  if (replayService && replayService.isRunning()) return replayService.getPacketRateHz();
  if (simulationService && simulationService.isRunning()) {
    const interval = DEFAULTS.simulation?.intervalMs || 100;
    return (1000 / interval).toFixed(1);
  }
  return 0;
}

async function stopDataSources(except) {
  if (except !== 'simulation' && simulationService && simulationService.isRunning()) {
    simulationService.stop();
  }

  if (except !== 'replay' && replayService && replayService.isRunning()) {
    replayService.stop();
  }

  if (except !== 'serial' && serialService && serialService.isConnected()) {
    await serialService.disconnect();
  }
}

function handleSerialData(line) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Ham veriyi gönder (raw monitor)
  mainWindow.webContents.send('raw-data', line);

  // Parse et
  const packet = parser.parse(line);
  if (!packet) return;

  // Uyarıları değerlendir
  const warnings = warningService.evaluate(packet);

  // CSV logla
  if (loggingService.isLogging) {
    loggingService.logPacket(packet, warnings);
  }

  // UI'a gönder
  mainWindow.webContents.send('telemetry-data', {
    packet: packet.toFlatObject(),
    warnings,
    packetRate: getPacketRateHz(),
    parserStats: parser.getStats(),
    packetLoss: warningService.getPacketLossPercent(),
  });
}

// ========================
// IPC Handlers
// ========================

function setupIPC() {
  // Port listesi
  ipcMain.handle('serial:list-ports', async () => {
    return await SerialService.listPorts();
  });

  // Bağlan
  ipcMain.handle('serial:connect', async (event, portPath, baudRate) => {
    await stopDataSources('serial');
    serialService.onData = handleSerialData;
    serialService.onStatus = (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('connection-status', status);
      }
    };
    return await serialService.connect(portPath, baudRate);
  });

  // Bağlantıyı kes
  ipcMain.handle('serial:disconnect', async () => {
    await serialService.disconnect();
    return { success: true };
  });

  // Simülasyon başlat
  ipcMain.handle('simulation:start', async (event, profile) => {
    await stopDataSources('simulation');
    warningService.reset();
    parser.reset();
    simulationService.start(profile, (jsonLine) => {
      handleSerialData(jsonLine);
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', 'simulation');
    }
    return { success: true };
  });

  // Simülasyon durdur
  ipcMain.handle('simulation:stop', () => {
    simulationService.stop();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', 'offline');
    }
    return { success: true };
  });

  // CSV replay dosyasi sec
  ipcMain.handle('replay:select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'CSV replay dosyasi sec',
      properties: ['openFile'],
      filters: [
        { name: 'CSV Loglari', extensions: ['csv'] },
        { name: 'Tum Dosyalar', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return replayService.load(result.filePaths[0]);
  });

  // CSV replay baslat
  ipcMain.handle('replay:start', async (event, filePath, speed) => {
    await stopDataSources('replay');
    warningService.reset();
    parser.reset();

    const result = replayService.start(filePath, speed, handleSerialData, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('connection-status', 'offline');
        mainWindow.webContents.send('replay-complete');
      }
    });

    if (result.success && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', 'replay');
    }

    return result;
  });

  // CSV replay durdur
  ipcMain.handle('replay:stop', () => {
    replayService.stop();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', 'offline');
    }
    return { success: true };
  });

  ipcMain.handle('replay:status', () => {
    return replayService.getStatus();
  });

  // Loglama başlat
  ipcMain.handle('logging:start', () => {
    return loggingService.startLogging();
  });

  // Loglama durdur
  ipcMain.handle('logging:stop', () => {
    return loggingService.stopLogging();
  });

  // Loglama durumu
  ipcMain.handle('logging:status', () => {
    return loggingService.getStatus();
  });

  // Uyarı geçmişi
  ipcMain.handle('warnings:history', () => {
    return warningService.getWarningHistory();
  });

  ipcMain.handle('warnings:get-settings', () => {
    return warningService.getSettings();
  });

  ipcMain.handle('warnings:update-settings', (event, settings) => {
    const updatedSettings = warningService.updateSettings(settings);
    saveWarningSettings(updatedSettings);
    return { success: true, settings: updatedSettings };
  });

  ipcMain.handle('warnings:reset-settings', () => {
    const resetSettings = warningService.resetSettings();
    saveWarningSettings(resetSettings);
    return { success: true, settings: resetSettings };
  });
}

// ========================
// App Lifecycle
// ========================

app.whenReady().then(() => {
  initServices();
  createWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (dataTimeoutChecker) clearInterval(dataTimeoutChecker);
  if (simulationService && simulationService.isRunning()) simulationService.stop();
  if (replayService && replayService.isRunning()) replayService.stop();
  if (serialService && serialService.isConnected()) serialService.disconnect();
  if (loggingService && loggingService.isLogging) loggingService.stopLogging();
  if (process.platform !== 'darwin') app.quit();
});
