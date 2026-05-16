/**
 * SETT Telemetri - Renderer (UI Kontrol)
 * Dashboard güncellemesi, bağlantı yönetimi, loglama UI kontrolü.
 */

// ===== State =====
let isConnected = false;
let isSimulation = false;
let isRecording = false;
let rawLines = [];
const MAX_RAW_LINES = 200;

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

// Logging
const btnLog = $('btn-log');
const logInfo = $('log-info');
const logFilename = $('log-filename');
const logPackets = $('log-packets');
const logDuration = $('log-duration');

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

// Cards (for state styling)
const cardRpm = $('card-rpm');
const cardClt = $('card-clt');
const cardIat = $('card-iat');
const cardBattery = $('card-battery');
const cardOil = $('card-oil');
const cardAfr = $('card-afr');

// Raw monitor
const rawMonitor = $('raw-monitor');
const rawAutoScroll = $('raw-autoscroll');
const btnRawClear = $('btn-raw-clear');

// ===== Init =====
function init() {
  populateBaudRates();
  refreshPorts();
  startClock();

  // Event listeners
  btnRefresh.addEventListener('click', refreshPorts);
  btnConnect.addEventListener('click', handleConnect);
  btnSim.addEventListener('click', handleSimulation);
  btnLog.addEventListener('click', handleLogging);
  btnRawClear.addEventListener('click', clearRawMonitor);

  // IPC listeners
  window.sett.on.telemetryData(handleTelemetryData);
  window.sett.on.rawData(handleRawData);
  window.sett.on.connectionStatus(handleConnectionStatus);
  window.sett.on.warning(handleWarning);
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

  if (isSimulation) {
    await window.sett.simulation.stop();
  } else {
    await window.sett.simulation.start();
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

// ===== Connection Status =====
function handleConnectionStatus(status) {
  // Reset states
  isConnected = false;
  isSimulation = false;
  connDot.className = 'status-dot ' + status;

  switch (status) {
    case 'online':
      isConnected = true;
      connLabel.textContent = 'Bağlandı';
      btnConnect.textContent = 'Bağlantıyı Kes';
      btnConnect.classList.add('connected');
      btnSim.disabled = true;
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
      simBadge.classList.remove('hidden');
      break;
    case 'error':
      connLabel.textContent = 'Hata';
      btnConnect.textContent = 'Bağlan';
      btnConnect.classList.remove('connected');
      btnSim.disabled = false;
      btnConnect.disabled = false;
      break;
    case 'offline':
    default:
      connLabel.textContent = 'Bağlantı Yok';
      btnConnect.textContent = 'Bağlan';
      btnConnect.classList.remove('connected');
      btnSim.textContent = 'Simülasyon Başlat';
      btnSim.classList.remove('active');
      btnSim.disabled = false;
      btnConnect.disabled = false;
      simBadge.classList.add('hidden');
      break;
  }
}

// ===== Telemetry Data Update =====
function handleTelemetryData(data) {
  const p = data.packet;
  const warnings = data.warnings || [];

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
  
  if (p.data_source) {
    dataSourceContainer.style.display = 'flex';
    dataSourceValueEl.textContent = p.data_source;
  } else {
    dataSourceContainer.style.display = 'none';
  }

  // Card state styling
  applyCardState(cardRpm, p.rpm, 11000, 12500, 'high');
  applyCardState(cardClt, p.clt, 100, 110, 'high');
  applyCardState(cardIat, p.iat, 55, 65, 'high');
  applyCardState(cardBattery, p.battery, 12.0, 11.5, 'low');

  // Oil card
  cardOil.className = 'dash-card card-status';
  if (p.oil_ok === false) { cardOil.classList.add('state-critical'); valOil.className = 'card-value val-critical'; }
  else if (p.oil_ok === true) { valOil.className = 'card-value val-ok'; }
  else { valOil.className = 'card-value'; }

  // Brake styling
  valBrake.className = 'card-value' + (p.brake ? ' val-warning' : '');

  // AFR card
  cardAfr.className = 'dash-card card-sm';
  if (p.afr !== null) {
    if (p.afr >= 16 || p.afr <= 10.5) { cardAfr.classList.add('state-critical'); valAfr.className = 'card-value val-critical'; }
    else if (p.afr >= 15 || p.afr <= 11.5) { cardAfr.classList.add('state-warning'); valAfr.className = 'card-value val-warning'; }
    else { valAfr.className = 'card-value'; }
  }

  // Update warnings panel
  updateWarningsList(warnings);

  // Update logging info
  if (isRecording) {
    updateLoggingInfo();
  }
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
    return `<div class="warning-item ${w.level}">
      <span class="warning-time">${time}</span>
      <span>${w.message}</span>
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

  const lineEl = document.createElement('div');
  lineEl.className = 'raw-line';
  lineEl.textContent = line;

  // Remove placeholder
  const placeholder = rawMonitor.querySelector('.raw-placeholder');
  if (placeholder) placeholder.remove();

  rawMonitor.appendChild(lineEl);

  // Limit DOM children
  while (rawMonitor.children.length > MAX_RAW_LINES) {
    rawMonitor.removeChild(rawMonitor.firstChild);
  }

  if (rawAutoScroll.checked) {
    rawMonitor.scrollTop = rawMonitor.scrollHeight;
  }
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
