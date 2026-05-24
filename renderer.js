/**
 * SETT Telemetri - Renderer (UI Kontrol)
 * Dashboard güncellemesi, bağlantı yönetimi, loglama UI kontrolü.
 */

// ===== State =====
let isConnected = false;
let isSimulation = false;
let isReplay = false;
let selectedReplayFile = null;
let isRecording = false;
let rawLines = [];
let sessionStats = createSessionStats();
let warningSettings = null;
let lastTelemetryAt = null;
let latestLinkMetrics = createLinkMetrics();
const MAX_RAW_LINES = 3;
const CHART_WINDOW_MS = 60000;

const FALLBACK_WARNING_SETTINGS = {
  clt: { warningHigh: 100, criticalHigh: 110 },
  iat: { warningHigh: 55, criticalHigh: 65 },
  battery: { warningLow: 12.0, criticalLow: 11.5 },
  rpm: { warningHigh: 11000, criticalHigh: 12500 },
  oil: { rpmThresholdForCheck: 2000 },
  rssi: { warningLow: -90, criticalLow: -100 },
  afr: { leanWarning: 15.0, leanCritical: 16.0, richWarning: 11.5, richCritical: 10.5 },
  packetLoss: { warningPercent: 5, criticalPercent: 15 },
  noData: { warningMs: 3000, criticalMs: 5000 },
};

const WARNING_SETTINGS_SCHEMA = [
  {
    title: 'Sıcaklık',
    fields: [
      { path: ['clt', 'warningHigh'], label: 'CLT uyarı (°C)', step: '0.1' },
      { path: ['clt', 'criticalHigh'], label: 'CLT kritik (°C)', step: '0.1' },
      { path: ['iat', 'warningHigh'], label: 'IAT uyarı (°C)', step: '0.1' },
      { path: ['iat', 'criticalHigh'], label: 'IAT kritik (°C)', step: '0.1' },
    ],
  },
  {
    title: 'Motor / Güç',
    fields: [
      { path: ['rpm', 'warningHigh'], label: 'RPM uyarı', step: '100' },
      { path: ['rpm', 'criticalHigh'], label: 'RPM kritik', step: '100' },
      { path: ['battery', 'warningLow'], label: 'Akü uyarı (V)', step: '0.1' },
      { path: ['battery', 'criticalLow'], label: 'Akü kritik (V)', step: '0.1' },
      { path: ['oil', 'rpmThresholdForCheck'], label: 'Yağ kontrol RPM', step: '100' },
    ],
  },
  {
    title: 'AFR',
    fields: [
      { path: ['afr', 'leanWarning'], label: 'Fakir uyarı', step: '0.1' },
      { path: ['afr', 'leanCritical'], label: 'Fakir kritik', step: '0.1' },
      { path: ['afr', 'richWarning'], label: 'Zengin uyarı', step: '0.1' },
      { path: ['afr', 'richCritical'], label: 'Zengin kritik', step: '0.1' },
    ],
  },
  {
    title: 'Sinyal / Veri',
    fields: [
      { path: ['rssi', 'warningLow'], label: 'RSSI uyarı (dBm)', step: '1' },
      { path: ['rssi', 'criticalLow'], label: 'RSSI kritik (dBm)', step: '1' },
      { path: ['packetLoss', 'warningPercent'], label: 'Kayıp uyarı (%)', step: '0.1' },
      { path: ['packetLoss', 'criticalPercent'], label: 'Kayıp kritik (%)', step: '0.1' },
      { path: ['noData', 'warningMs'], label: 'Veri yok uyarı (ms)', step: '100' },
      { path: ['noData', 'criticalMs'], label: 'Veri yok kritik (ms)', step: '100' },
    ],
  },
];

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);

// Top bar
const connDot = $('conn-dot');
const connLabel = $('conn-label');
const packetRateEl = $('packet-rate');
const rssiValueEl = $('rssi-value');
const dataSourceContainer = $('status-datasource');
const dataSourceValueEl = $('datasource-value');
const simBadge = $('simulation-badge');
const clockEl = $('clock');
const recStatus = $('recording-status');
const recLabel = $('recording-label');
const recTime = $('recording-time');

// Connection panel
const portSelect = $('port-select');
const baudSelect = $('baud-select');
const btnRefresh = $('btn-refresh-ports');
const btnConnect = $('btn-connect');
const btnSim = $('btn-simulation');
const simProfileSelect = $('sim-profile-select');

// Logging
const btnLog = $('btn-log');
const logInfo = $('log-info');
const logFilename = $('log-filename');
const logPackets = $('log-packets');
const logDuration = $('log-duration');

// Replay
const btnReplaySelect = $('btn-replay-select');
const btnReplay = $('btn-replay');
const replayFilename = $('replay-filename');
const replayPackets = $('replay-packets');
const replaySpeedSelect = $('replay-speed-select');

// Warnings
const warningCount = $('warning-count');
const warningList = $('warning-list');

// Dashboard values
const valRpm = $('val-rpm');
const valSpeed = $('val-speed');
const valGear = $('val-gear');
const valTps = $('val-tps');
const valMap = $('val-map');
const valAfr = $('val-afr');
const valClt = $('val-clt');
const valIat = $('val-iat');
const valBattery = $('val-battery');
const valBrake = $('val-brake');
const valOil = $('val-oil');
const valCounter = $('val-counter');
const valLoss = $('val-loss');
const barRpm = $('bar-rpm');
const barTps = $('bar-tps');

// Link health
const cardLinkHealth = $('card-link-health');
const valLinkHealth = $('val-link-health');
const linkRssi = $('link-rssi');
const linkLoss = $('link-loss');
const linkRate = $('link-rate');
const linkAge = $('link-age');

// Session summary
const sessionSource = $('session-source');
const sessionPackets = $('session-packets');
const sessionMaxSpeed = $('session-max-speed');
const sessionMaxRpm = $('session-max-rpm');
const sessionMaxClt = $('session-max-clt');
const sessionMinBattery = $('session-min-battery');

// Cards (for state styling)
const cardRpm = $('card-rpm');
const cardClt = $('card-clt');
const cardIat = $('card-iat');
const cardBattery = $('card-battery');
const cardOil = $('card-oil');
const cardAfr = $('card-afr');

// Raw monitor
const rawMonitor = $('raw-monitor');
const btnRawClear = $('btn-raw-clear');

// Theme toggle
const btnThemeToggle = $('btn-theme-toggle');
const btnSettings = $('btn-settings');

// Settings modal
const settingsOverlay = $('settings-overlay');
const settingsForm = $('settings-form');
const settingsGrid = $('settings-grid');
const settingsStatus = $('settings-status');
const btnSettingsClose = $('btn-settings-close');
const btnSettingsReset = $('btn-settings-reset');

// Charts
let chartHistory = [];
const chartConfigs = [
  { key: 'rpm', canvas: $('chart-rpm'), current: $('chart-rpm-current'), min: 0, max: 13000, color: '#ff9500', format: v => Math.round(v).toLocaleString() },
  { key: 'speed', canvas: $('chart-speed'), current: $('chart-speed-current'), min: 0, max: 320, color: '#28a745', format: v => v.toFixed(1) },
  { key: 'clt', canvas: $('chart-clt'), current: $('chart-clt-current'), min: 20, max: 115, color: '#dc3545', format: v => v.toFixed(1) },
  { key: 'battery', canvas: $('chart-battery'), current: $('chart-battery-current'), min: 9, max: 15, color: '#9b59b6', format: v => v.toFixed(1) },
  { key: 'rssi', canvas: $('chart-rssi'), current: $('chart-rssi-current'), min: -110, max: -40, color: '#0aa6b5', format: v => Math.round(v).toString() },
  { key: 'loss', canvas: $('chart-loss'), current: $('chart-loss-current'), min: 0, max: 100, color: '#f5a623', format: v => v.toFixed(1) },
];

// ===== Init =====
function init() {
  populateBaudRates();
  refreshPorts();
  startClock();
  initTheme();
  initWarningSettings();

  // Event listeners
  btnRefresh.addEventListener('click', refreshPorts);
  btnConnect.addEventListener('click', handleConnect);
  btnSim.addEventListener('click', handleSimulation);
  btnLog.addEventListener('click', handleLogging);
  btnReplaySelect.addEventListener('click', handleReplaySelect);
  btnReplay.addEventListener('click', handleReplay);
  btnRawClear.addEventListener('click', clearRawMonitor);
  btnThemeToggle.addEventListener('click', toggleTheme);
  btnSettings.addEventListener('click', openSettingsModal);
  btnSettingsClose.addEventListener('click', closeSettingsModal);
  btnSettingsReset.addEventListener('click', resetWarningSettings);
  settingsForm.addEventListener('submit', saveWarningSettings);
  settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) closeSettingsModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !settingsOverlay.classList.contains('hidden')) closeSettingsModal();
  });
  window.addEventListener('resize', drawCharts);

  // IPC listeners
  window.sett.on.telemetryData(handleTelemetryData);
  window.sett.on.rawData(handleRawData);
  window.sett.on.connectionStatus(handleConnectionStatus);
  window.sett.on.warning(handleWarning);
  window.sett.on.replayComplete(handleReplayComplete);

  drawCharts();
  updateSessionSummary(null);
  updateLinkHealth();
  setInterval(updateLinkHealth, 1000);
}

// ===== Theme =====
function initTheme() {
  const savedTheme = localStorage.getItem('sett-theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    btnThemeToggle.textContent = '☀️';
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  btnThemeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('sett-theme', isDark ? 'dark' : 'light');
}

// ===== Warning Settings =====
function initWarningSettings() {
  renderWarningSettingsForm();
  loadWarningSettings();
}

function renderWarningSettingsForm() {
  settingsGrid.innerHTML = WARNING_SETTINGS_SCHEMA.map((group) => {
    const fields = group.fields.map((field) => {
      const id = getSettingInputId(field.path);
      return `<div class="settings-field">
        <label for="${id}">${field.label}</label>
        <input id="${id}" type="number" step="${field.step}" data-path="${field.path.join('.')}" inputmode="decimal">
      </div>`;
    }).join('');
    return `<section class="settings-section">
      <h3>${group.title}</h3>
      ${fields}
    </section>`;
  }).join('');
}

async function loadWarningSettings() {
  try {
    warningSettings = await window.sett.warnings.getSettings();
    fillWarningSettingsForm(warningSettings);
  } catch (error) {
    warningSettings = cloneSettings(FALLBACK_WARNING_SETTINGS);
    fillWarningSettingsForm(warningSettings);
    setSettingsStatus('Eşik ayarları okunamadı, varsayılanlar gösteriliyor.', 'error');
  }
}

function openSettingsModal() {
  fillWarningSettingsForm(getWarningSettings());
  setSettingsStatus('', '');
  settingsOverlay.classList.remove('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'false');
  const firstInput = settingsOverlay.querySelector('input');
  if (firstInput) firstInput.focus();
}

function closeSettingsModal() {
  settingsOverlay.classList.add('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

async function saveWarningSettings(event) {
  event.preventDefault();
  const result = collectWarningSettingsFromForm();
  if (!result.success) {
    setSettingsStatus(result.error, 'error');
    return;
  }

  try {
    const response = await window.sett.warnings.updateSettings(result.settings);
    warningSettings = response.settings;
    fillWarningSettingsForm(warningSettings);
    setSettingsStatus('Kaydedildi.', 'success');
  } catch (error) {
    setSettingsStatus('Kaydedilemedi: ' + error.message, 'error');
  }
}

async function resetWarningSettings() {
  try {
    const response = await window.sett.warnings.resetSettings();
    warningSettings = response.settings;
    fillWarningSettingsForm(warningSettings);
    setSettingsStatus('Varsayılan eşikler yüklendi.', 'success');
  } catch (error) {
    setSettingsStatus('Varsayılana dönülemedi: ' + error.message, 'error');
  }
}

function collectWarningSettingsFromForm() {
  const nextSettings = cloneSettings(getWarningSettings());

  for (const field of getWarningSettingFields()) {
    const input = $(getSettingInputId(field.path));
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return { success: false, error: `${field.label} sayısal olmalı.` };
    }
    setSettingValue(nextSettings, field.path, value);
  }

  const validationError = validateWarningSettings(nextSettings);
  if (validationError) return { success: false, error: validationError };

  return { success: true, settings: nextSettings };
}

function validateWarningSettings(settings) {
  if (settings.clt.warningHigh >= settings.clt.criticalHigh) return 'CLT uyarı değeri kritik değerden küçük olmalı.';
  if (settings.iat.warningHigh >= settings.iat.criticalHigh) return 'IAT uyarı değeri kritik değerden küçük olmalı.';
  if (settings.rpm.warningHigh >= settings.rpm.criticalHigh) return 'RPM uyarı değeri kritik değerden küçük olmalı.';
  if (settings.packetLoss.warningPercent >= settings.packetLoss.criticalPercent) return 'Kayıp uyarı yüzdesi kritik yüzdeden küçük olmalı.';
  if (settings.noData.warningMs >= settings.noData.criticalMs) return 'Veri yok uyarı süresi kritik süreden küçük olmalı.';
  if (settings.battery.criticalLow >= settings.battery.warningLow) return 'Akü kritik değeri uyarı değerinden küçük olmalı.';
  if (settings.rssi.criticalLow >= settings.rssi.warningLow) return 'RSSI kritik değeri uyarı değerinden küçük olmalı.';
  if (settings.afr.leanWarning >= settings.afr.leanCritical) return 'AFR fakir uyarı değeri kritik değerden küçük olmalı.';
  if (settings.afr.richCritical >= settings.afr.richWarning) return 'AFR zengin kritik değeri uyarı değerinden küçük olmalı.';
  return '';
}

function fillWarningSettingsForm(settings) {
  getWarningSettingFields().forEach((field) => {
    const input = $(getSettingInputId(field.path));
    if (input) input.value = getSettingValue(settings, field.path);
  });
}

function getWarningSettings() {
  return warningSettings || FALLBACK_WARNING_SETTINGS;
}

function getWarningSettingFields() {
  return WARNING_SETTINGS_SCHEMA.flatMap(group => group.fields);
}

function getSettingInputId(path) {
  return 'setting-' + path.join('-');
}

function getSettingValue(settings, path) {
  return path.reduce((target, key) => target && target[key], settings);
}

function setSettingValue(settings, path, value) {
  const [groupKey, settingKey] = path;
  if (!settings[groupKey]) settings[groupKey] = {};
  settings[groupKey][settingKey] = value;
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function setSettingsStatus(message, type) {
  settingsStatus.textContent = message;
  settingsStatus.className = 'settings-status' + (type ? ' ' + type : '');
}

// ===== Baud Rate Dropdown =====
function populateBaudRates() {
  const rates = [9600, 19200, 38400, 57600, 115200, 230400, 256000, 460800, 921600];
  baudSelect.innerHTML = '';
  rates.forEach(rate => {
    const opt = document.createElement('option');
    opt.value = rate;
    opt.textContent = rate.toLocaleString();
    if (rate === 115200) opt.selected = true;
    baudSelect.appendChild(opt);
  });
}

// ===== Port List =====
async function refreshPorts() {
  const ports = await window.sett.serial.listPorts();
  portSelect.innerHTML = '<option value="">Port seçin...</option>';
  if (ports.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Port bulunamadı';
    opt.disabled = true;
    portSelect.appendChild(opt);
  } else {
    ports.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = `${p.path} (${p.manufacturer})`;
      portSelect.appendChild(opt);
    });
  }
}

// ===== Connection =====
async function handleConnect() {
  if (isSimulation) {
    await window.sett.simulation.stop();
    isSimulation = false;
  }

  if (isReplay) {
    await window.sett.replay.stop();
    isReplay = false;
  }

  if (isConnected) {
    await window.sett.serial.disconnect();
    return;
  }

  const port = portSelect.value;
  const baud = parseInt(baudSelect.value);
  if (!port) { alert('Lütfen bir COM port seçin.'); return; }

  const result = await window.sett.serial.connect(port, baud);
  if (!result.success) {
    alert(`Bağlantı hatası: ${result.error}`);
  }
}

// ===== Simulation =====
async function handleSimulation() {
  if (isConnected) {
    await window.sett.serial.disconnect();
  }

  if (isReplay) {
    await window.sett.replay.stop();
  }

  if (isSimulation) {
    await window.sett.simulation.stop();
  } else {
    const profile = simProfileSelect ? simProfileSelect.value : 'race';
    await window.sett.simulation.start(profile);
  }
}

// ===== Logging =====
async function handleLogging() {
  if (isRecording) {
    const result = await window.sett.logging.stop();
    isRecording = false;
    btnLog.textContent = 'Kayda Başla';
    btnLog.classList.remove('recording');
    logInfo.classList.add('hidden');
    recStatus.classList.add('hidden');
  } else {
    const result = await window.sett.logging.start();
    if (result.success) {
      isRecording = true;
      btnLog.textContent = 'Kaydı Durdur';
      btnLog.classList.add('recording');
      logInfo.classList.remove('hidden');
      recStatus.classList.remove('hidden');
      logFilename.textContent = result.filePath.split(/[/\\]/).pop();
    } else {
      alert(`Loglama hatası: ${result.error}`);
    }
  }
}

// ===== CSV Replay =====
async function handleReplaySelect() {
  const result = await window.sett.replay.selectFile();
  if (!result.success) {
    if (!result.canceled) alert(`Replay dosyası açılamadı: ${result.error}`);
    return;
  }

  selectedReplayFile = result.filePath;
  replayFilename.textContent = result.fileName || result.filePath.split(/[/\\]/).pop();
  replayPackets.textContent = result.packetCount.toLocaleString();
  btnReplay.disabled = false;
}

async function handleReplay() {
  if (isReplay) {
    await window.sett.replay.stop();
    return;
  }

  if (!selectedReplayFile) {
    alert('Lütfen önce bir CSV log dosyası seçin.');
    return;
  }

  if (isConnected) await window.sett.serial.disconnect();
  if (isSimulation) await window.sett.simulation.stop();

  const speed = parseFloat(replaySpeedSelect.value || '1');
  const result = await window.sett.replay.start(selectedReplayFile, speed);
  if (!result.success) {
    alert(`Replay başlatılamadı: ${result.error}`);
  }
}

function handleReplayComplete() {
  isReplay = false;
  btnReplay.textContent = 'Replay Başlat';
  btnReplay.classList.remove('recording');
  btnReplay.disabled = !selectedReplayFile;
  btnReplaySelect.disabled = false;
  replaySpeedSelect.disabled = false;
}

// ===== Connection Status =====
function handleConnectionStatus(status) {
  // Reset states
  isConnected = false;
  isSimulation = false;
  isReplay = false;
  connDot.className = 'status-dot ' + status;

  switch (status) {
    case 'online':
      isConnected = true;
      connLabel.textContent = 'Bağlandı';
      btnConnect.textContent = 'Bağlantıyı Kes';
      btnConnect.classList.add('connected');
      btnSim.disabled = true;
      btnReplay.disabled = true;
      btnReplaySelect.disabled = true;
      replaySpeedSelect.disabled = true;
      simBadge.classList.add('hidden');
      break;
    case 'connecting':
      connLabel.textContent = 'Bağlanıyor...';
      break;
    case 'simulation':
      isSimulation = true;
      connLabel.textContent = 'Simülasyon';
      btnSim.textContent = 'Simülasyonu Durdur';
      btnSim.classList.add('active');
      btnConnect.disabled = true;
      btnReplay.disabled = true;
      btnReplaySelect.disabled = true;
      replaySpeedSelect.disabled = true;
      simBadge.classList.remove('hidden');
      break;
    case 'replay':
      isReplay = true;
      connLabel.textContent = 'CSV Replay';
      btnReplay.textContent = 'Replay Durdur';
      btnReplay.classList.add('recording');
      btnReplay.disabled = false;
      btnReplaySelect.disabled = true;
      replaySpeedSelect.disabled = true;
      btnConnect.disabled = true;
      btnSim.disabled = true;
      simBadge.classList.add('hidden');
      break;
    case 'error':
      connLabel.textContent = 'Hata';
      btnConnect.textContent = 'Bağlan';
      btnConnect.classList.remove('connected');
      btnReplay.textContent = 'Replay Başlat';
      btnReplay.classList.remove('recording');
      btnReplay.disabled = !selectedReplayFile;
      btnReplaySelect.disabled = false;
      replaySpeedSelect.disabled = false;
      btnSim.disabled = false;
      btnConnect.disabled = false;
      resetDashboard();
      break;
    case 'offline':
    default:
      connLabel.textContent = 'Bağlantı Yok';
      btnConnect.textContent = 'Bağlan';
      btnConnect.classList.remove('connected');
      btnSim.textContent = 'Simülasyon Başlat';
      btnSim.classList.remove('active');
      btnReplay.textContent = 'Replay Başlat';
      btnReplay.classList.remove('recording');
      btnReplay.disabled = !selectedReplayFile;
      btnReplaySelect.disabled = false;
      replaySpeedSelect.disabled = false;
      btnSim.disabled = false;
      btnConnect.disabled = false;
      simBadge.classList.add('hidden');
      resetDashboard();
      break;
  }
}

// ===== Reset Dashboard =====
function resetDashboard() {
  valRpm.textContent = '0';
  valSpeed.textContent = '0';
  valGear.textContent = 'N';
  valTps.textContent = '0';
  valMap.textContent = '0';
  valAfr.textContent = '--';
  valClt.textContent = '--';
  valIat.textContent = '--';
  valBattery.textContent = '--';
  valBrake.textContent = '--';
  valOil.textContent = '--';
  valCounter.textContent = '0';
  valLoss.textContent = '0';
  barRpm.style.width = '0%';
  barTps.style.width = '0%';
  packetRateEl.textContent = '0';
  rssiValueEl.textContent = '--';
  dataSourceContainer.style.display = 'none';

  // Clear card states
  [cardRpm, cardClt, cardIat, cardBattery, cardOil, cardAfr].forEach(card => {
    if (card) card.className = card.className.replace(/ state-\w+/g, '');
  });
  [valAfr, valOil, valBrake].forEach(el => {
    if (el) el.className = el.className.replace(/ val-\w+/g, '');
  });

  // Clear warnings
  lastWarnings = [];
  updateWarningsList([]);
  resetCharts();
  sessionStats = createSessionStats();
  lastTelemetryAt = null;
  latestLinkMetrics = createLinkMetrics();
  updateSessionSummary(null);
  updateLinkHealth();
}

// ===== Telemetry Data Update =====
function handleTelemetryData(data) {
  const p = data.packet;
  const warnings = data.warnings || [];
  lastTelemetryAt = Date.now();

  // Hero values
  valRpm.textContent = p.rpm !== null ? Math.round(p.rpm).toLocaleString() : '--';
  barRpm.style.width = p.rpm !== null ? Math.min(100, (p.rpm / 13000) * 100) + '%' : '0%';

  valSpeed.textContent = p.speed !== null ? p.speed.toFixed(1) : '--';
  // Gear: 0 veya "N" → "N", numeric 1-6 veya string "1"-"6" → sayı
  if (p.gear === null || p.gear === undefined) {
    valGear.textContent = '--';
  } else if (p.gear === 0 || p.gear === '0' || p.gear === 'N' || p.gear === 'n') {
    valGear.textContent = 'N';
  } else {
    valGear.textContent = p.gear;
  }

  // Engine values
  valTps.textContent = p.tps !== null ? p.tps.toFixed(1) : '--';
  barTps.style.width = p.tps !== null ? Math.min(100, p.tps) + '%' : '0%';

  valMap.textContent = p.map !== null ? p.map.toFixed(1) : '--';
  valAfr.textContent = p.afr !== null ? p.afr.toFixed(1) : '--';
  valClt.textContent = p.clt !== null ? p.clt.toFixed(1) : '--';
  valIat.textContent = p.iat !== null ? p.iat.toFixed(1) : '--';

  // Status values
  valBattery.textContent = p.battery !== null ? p.battery.toFixed(1) : '--';
  valBrake.textContent = p.brake !== null ? (p.brake ? 'AKTIF' : 'SERBEST') : '--';
  valOil.textContent = p.oil_ok !== null ? (p.oil_ok ? 'OK' : 'HATA') : '--';
  valCounter.textContent = p.counter !== null ? p.counter.toLocaleString() : '--';
  valLoss.textContent = data.packetLoss !== undefined ? parseFloat(data.packetLoss).toFixed(1) : '0';

  // Packet rate, RSSI & Data Source
  packetRateEl.textContent = data.packetRate || '0';
  rssiValueEl.textContent = p.rssi !== null ? p.rssi : '--';
  latestLinkMetrics = {
    rssi: numberOrNull(p.rssi),
    packetLoss: numberOrNull(data.packetLoss) ?? 0,
    packetRate: numberOrNull(data.packetRate) ?? 0,
  };
  
  if (p.data_source) {
    dataSourceContainer.style.display = 'flex';
    dataSourceValueEl.textContent = p.data_source;
  } else {
    dataSourceContainer.style.display = 'none';
  }

  pushChartSample(p, parseFloat(valLoss.textContent) || 0);
  drawCharts();
  updateSessionSummary(p);
  updateLinkHealth();

  // Card state styling
  const thresholds = getWarningSettings();
  applyCardState(cardRpm, p.rpm, thresholds.rpm.warningHigh, thresholds.rpm.criticalHigh, 'high');
  applyCardState(cardClt, p.clt, thresholds.clt.warningHigh, thresholds.clt.criticalHigh, 'high');
  applyCardState(cardIat, p.iat, thresholds.iat.warningHigh, thresholds.iat.criticalHigh, 'high');
  applyCardState(cardBattery, p.battery, thresholds.battery.warningLow, thresholds.battery.criticalLow, 'low');

  // Oil card
  cardOil.className = 'dash-card card-status';
  if (p.oil_ok === false && (p.rpm === null || p.rpm > thresholds.oil.rpmThresholdForCheck)) { cardOil.classList.add('state-critical'); valOil.className = 'card-value val-critical'; }
  else if (p.oil_ok === false) { cardOil.classList.add('state-warning'); valOil.className = 'card-value val-warning'; }
  else if (p.oil_ok === true) { valOil.className = 'card-value val-ok'; }
  else { valOil.className = 'card-value'; }

  // Brake styling
  valBrake.className = 'card-value' + (p.brake ? ' val-warning' : '');

  // AFR card
  cardAfr.className = 'dash-card card-sm';
  if (p.afr !== null) {
    if (p.afr >= thresholds.afr.leanCritical || p.afr <= thresholds.afr.richCritical) { cardAfr.classList.add('state-critical'); valAfr.className = 'card-value val-critical'; }
    else if (p.afr >= thresholds.afr.leanWarning || p.afr <= thresholds.afr.richWarning) { cardAfr.classList.add('state-warning'); valAfr.className = 'card-value val-warning'; }
    else { valAfr.className = 'card-value'; }
  }

  // Update warnings panel
  updateWarningsList(warnings);

  // Update logging info
  if (isRecording) {
    updateLoggingInfo();
  }
}

// ===== Session Summary =====
function createSessionStats() {
  return {
    packets: 0,
    source: '--',
    maxSpeed: 0,
    maxRpm: 0,
    maxClt: null,
    minBattery: null,
  };
}

function updateSessionSummary(packet) {
  if (packet) {
    sessionStats.packets++;
    sessionStats.source = packet.data_source || sessionStats.source;

    const speed = numberOrNull(packet.speed);
    if (speed !== null) sessionStats.maxSpeed = Math.max(sessionStats.maxSpeed, speed);

    const rpm = numberOrNull(packet.rpm);
    if (rpm !== null) sessionStats.maxRpm = Math.max(sessionStats.maxRpm, rpm);

    const clt = numberOrNull(packet.clt);
    if (clt !== null) {
      sessionStats.maxClt = sessionStats.maxClt === null ? clt : Math.max(sessionStats.maxClt, clt);
    }

    const battery = numberOrNull(packet.battery);
    if (battery !== null) {
      sessionStats.minBattery = sessionStats.minBattery === null ? battery : Math.min(sessionStats.minBattery, battery);
    }
  }

  sessionSource.textContent = sessionStats.source;
  sessionPackets.textContent = sessionStats.packets.toLocaleString();
  sessionMaxSpeed.textContent = sessionStats.maxSpeed.toFixed(1);
  sessionMaxRpm.textContent = Math.round(sessionStats.maxRpm).toLocaleString();
  sessionMaxClt.textContent = sessionStats.maxClt === null ? '--' : sessionStats.maxClt.toFixed(1);
  sessionMinBattery.textContent = sessionStats.minBattery === null ? '--' : sessionStats.minBattery.toFixed(2);
}

function createLinkMetrics() {
  return {
    rssi: null,
    packetLoss: 0,
    packetRate: 0,
  };
}

function updateLinkHealth() {
  const thresholds = getWarningSettings();
  const hasActiveSource = isConnected || isSimulation || isReplay;
  const ageMs = lastTelemetryAt ? Date.now() - lastTelemetryAt : null;
  const rssi = latestLinkMetrics.rssi;
  const packetLoss = latestLinkMetrics.packetLoss;
  const packetRate = latestLinkMetrics.packetRate;
  let status = 'BEKLEME';
  let state = '';

  if (!hasActiveSource) {
    status = 'BEKLEME';
  } else if (ageMs === null || ageMs >= thresholds.noData.criticalMs) {
    status = 'VERI YOK';
    state = 'state-critical';
  } else if (ageMs >= thresholds.noData.warningMs || packetRate <= 0) {
    status = 'GECIKME';
    state = 'state-warning';
  } else if (
    (rssi !== null && rssi <= thresholds.rssi.criticalLow) ||
    packetLoss >= thresholds.packetLoss.criticalPercent
  ) {
    status = 'KRITIK';
    state = 'state-critical';
  } else if (
    (rssi !== null && rssi <= thresholds.rssi.warningLow) ||
    packetLoss >= thresholds.packetLoss.warningPercent
  ) {
    status = 'ZAYIF';
    state = 'state-warning';
  } else {
    status = 'OK';
    state = 'state-ok';
  }

  cardLinkHealth.className = 'dash-card card-status card-link-health' + (state ? ' ' + state : '');
  valLinkHealth.className = 'card-value link-health-value' + (state === 'state-critical' ? ' val-critical' : state === 'state-warning' ? ' val-warning' : state === 'state-ok' ? ' val-ok' : '');
  valLinkHealth.textContent = status;
  linkRssi.textContent = rssi === null ? '--' : `${Math.round(rssi)}`;
  linkLoss.textContent = `${packetLoss.toFixed(1)}%`;
  linkRate.textContent = Number(packetRate).toFixed(1);
  linkAge.textContent = ageMs === null ? '--' : ageMs < 1000 ? '<1s' : `${Math.floor(ageMs / 1000)}s`;
}

function applyCardState(card, value, warnThreshold, critThreshold, direction) {
  card.className = card.className.replace(/ state-\w+/g, '');
  if (value === null) return;

  if (direction === 'high') {
    if (value >= critThreshold) card.classList.add('state-critical');
    else if (value >= warnThreshold) card.classList.add('state-warning');
  } else {
    if (value <= critThreshold) card.classList.add('state-critical');
    else if (value <= warnThreshold) card.classList.add('state-warning');
  }
}

// ===== Time Series Charts =====
function pushChartSample(packet, packetLoss) {
  const now = Date.now();
  chartHistory.push({
    t: now,
    rpm: numberOrNull(packet.rpm),
    speed: numberOrNull(packet.speed),
    clt: numberOrNull(packet.clt),
    battery: numberOrNull(packet.battery),
    rssi: numberOrNull(packet.rssi),
    loss: numberOrNull(packetLoss) ?? 0,
  });

  const cutoff = now - CHART_WINDOW_MS;
  chartHistory = chartHistory.filter(sample => sample.t >= cutoff);

  chartConfigs.forEach(cfg => {
    const val = chartHistory.length ? chartHistory[chartHistory.length - 1][cfg.key] : null;
    if (cfg.current) cfg.current.textContent = val === null ? '--' : cfg.format(val);
  });
}

function resetCharts() {
  chartHistory = [];
  chartConfigs.forEach(cfg => {
    if (cfg.current) cfg.current.textContent = cfg.key === 'loss' ? '0.0' : '--';
  });
  const rpm = chartConfigs.find(cfg => cfg.key === 'rpm');
  const speed = chartConfigs.find(cfg => cfg.key === 'speed');
  if (rpm && rpm.current) rpm.current.textContent = '0';
  if (speed && speed.current) speed.current.textContent = '0.0';
  drawCharts();
}

function drawCharts() {
  chartConfigs.forEach(drawChart);
}

function drawChart(cfg) {
  const canvas = cfg.canvas;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  const w = rect.width;
  const h = rect.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const styles = getComputedStyle(document.body);
  const gridColor = styles.getPropertyValue('--border-color').trim() || '#e0e0e0';
  const mutedColor = styles.getPropertyValue('--text-muted').trim() || '#999999';
  const now = Date.now();
  const cutoff = now - CHART_WINDOW_MS;
  const pad = 8;
  const plotW = Math.max(1, w - pad * 2);
  const plotH = Math.max(1, h - pad * 2);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const y = pad + (plotH / 2) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  const samples = chartHistory.filter(sample => sample.t >= cutoff && sample[cfg.key] !== null);
  if (samples.length < 2) {
    ctx.fillStyle = mutedColor;
    ctx.font = '11px sans-serif';
    ctx.fillText('Veri bekleniyor', pad, h / 2);
    return;
  }

  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  samples.forEach((sample, index) => {
    const xRatio = Math.max(0, Math.min(1, (sample.t - cutoff) / CHART_WINDOW_MS));
    const yRatio = Math.max(0, Math.min(1, (sample[cfg.key] - cfg.min) / (cfg.max - cfg.min)));
    const x = pad + xRatio * plotW;
    const y = pad + (1 - yRatio) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ===== Warnings =====
let lastWarnings = [];
function updateWarningsList(warnings) {
  // Only update if changed
  const wKey = warnings.map(w => w.code).join(',');
  const lKey = lastWarnings.map(w => w.code).join(',');
  if (wKey === lKey) return;
  lastWarnings = warnings;

  if (warnings.length === 0) {
    warningList.innerHTML = '<div class="no-warnings">Aktif uyarı yok ✅</div>';
    warningCount.classList.remove('active');
    warningCount.textContent = '0';
    return;
  }

  warningCount.classList.add('active');
  warningCount.textContent = warnings.length;

  warningList.innerHTML = warnings.map(w => {
    const time = new Date(w.timestamp).toLocaleTimeString('tr-TR');
    return `<div class="warning-item ${w.level}" role="alert">
      <span class="warning-time">${time}</span>
      <span class="warning-message">${w.message}</span>
    </div>`;
  }).join('');
}

function handleWarning(warning) {
  // Data timeout warning from main process
  if (warning && warning.code === 'NO_DATA') {
    const existing = lastWarnings.filter(w => w.code !== 'NO_DATA');
    existing.push(warning);
    updateWarningsList(existing);
  }
}

// ===== Raw Monitor =====
function handleRawData(line) {
  rawLines.push(line);
  if (rawLines.length > MAX_RAW_LINES) rawLines.shift();

  rawMonitor.innerHTML = '';
  rawLines.forEach(rawLine => {
    const lineEl = document.createElement('div');
    lineEl.className = 'raw-line';
    lineEl.textContent = rawLine;
    rawMonitor.appendChild(lineEl);
  });
}

function clearRawMonitor() {
  rawLines = [];
  rawMonitor.innerHTML = '<div class="raw-line raw-placeholder">Veri bekleniyor...</div>';
}

// ===== Logging Info Update =====
async function updateLoggingInfo() {
  try {
    const status = await window.sett.logging.status();
    if (status.isLogging) {
      logPackets.textContent = status.packetCount.toLocaleString();
      logDuration.textContent = formatDuration(status.duration);
      recTime.textContent = formatDuration(status.duration);
    }
  } catch (e) { /* ignore */ }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ===== Clock =====
function startClock() {
  const update = () => {
    clockEl.textContent = new Date().toLocaleTimeString('tr-TR');
  };
  update();
  setInterval(update, 1000);
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', init);
