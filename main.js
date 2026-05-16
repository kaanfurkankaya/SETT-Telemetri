/**
 * SETT Telemetri - Electron Ana Süreç
 * Seri port, dosya sistemi ve IPC yönetimi burada yapılır.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SerialService = require('./src/services/serialService');
const SimulationService = require('./src/services/simulationService');
const { createParser } = require('./src/services/parserService');
const { WarningService } = require('./src/services/warningService');
const LoggingService = require('./src/services/loggingService');
const TelemetryPacket = require('./src/models/telemetry');

let mainWindow;
let serialService;
let simulationService;
let parser;
let warningService;
let loggingService;
let dataTimeoutChecker;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SETT Telemetri - Pit Dashboard',
    backgroundColor: '#0a0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  // Dev tools açmak için: mainWindow.webContents.openDevTools();
}

function initServices() {
  serialService = new SerialService();
  simulationService = new SimulationService();
  parser = createParser('json-line');
  warningService = new WarningService();
  loggingService = new LoggingService(app.getAppPath());

  // Veri zaman aşımı kontrolü (her 1 saniye)
  dataTimeoutChecker = setInterval(() => {
    const timeout = warningService.checkDataTimeout();
    if (timeout && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('warning', timeout);
    }
  }, 1000);
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
    packetRate: serialService.isConnected() ? serialService.getPacketRateHz() : 10,
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
  ipcMain.handle('simulation:start', () => {
    warningService.reset();
    parser.reset();
    simulationService.start((jsonLine) => {
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
  if (serialService && serialService.isConnected()) serialService.disconnect();
  if (loggingService && loggingService.isLogging) loggingService.stopLogging();
  if (process.platform !== 'darwin') app.quit();
});
