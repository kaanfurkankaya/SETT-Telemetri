/**
 * SETT Telemetri - Uyarı Servisi
 * Eşik tabanlı uyarı kontrolü. UI'dan bağımsız çalışır.
 */
const DEFAULTS = require('../config/defaults');

// Uyarı seviyeleri
const LEVEL = { INFO: 'INFO', WARNING: 'WARNING', CRITICAL: 'CRITICAL' };

class WarningService {
  constructor() {
    this.activeWarnings = [];
    this.warningHistory = [];
    this.lastPacketTime = Date.now();
    this.lastCounter = null;
    this.totalExpected = 0;
    this.totalReceived = 0;
  }

  /**
   * Telemetri paketini değerlendirir ve uyarıları döndürür.
   * @param {import('../models/telemetry')} packet
   * @returns {Array<{level: string, code: string, message: string, timestamp: number}>}
   */
  evaluate(packet) {
    const warnings = [];
    const w = DEFAULTS.warnings;
    const now = Date.now();
    this.lastPacketTime = now;

    // Paket kaybı hesapla
    if (packet.counter !== null && this.lastCounter !== null) {
      const expected = packet.counter - this.lastCounter;
      if (expected > 0) {
        this.totalExpected += expected;
        this.totalReceived++;
      }
    }
    if (packet.counter !== null) this.lastCounter = packet.counter;

    // CLT - Soğutma suyu sıcaklığı
    if (packet.clt !== null) {
      if (packet.clt >= w.clt.criticalHigh)
        warnings.push({ level: LEVEL.CRITICAL, code: 'CLT_CRITICAL', message: `${w.clt.label}: ${packet.clt.toFixed(1)}°C ≥ ${w.clt.criticalHigh}°C` });
      else if (packet.clt >= w.clt.warningHigh)
        warnings.push({ level: LEVEL.WARNING, code: 'CLT_HIGH', message: `${w.clt.label}: ${packet.clt.toFixed(1)}°C ≥ ${w.clt.warningHigh}°C` });
    }

    // IAT - Emme havası sıcaklığı
    if (packet.iat !== null) {
      if (packet.iat >= w.iat.criticalHigh)
        warnings.push({ level: LEVEL.CRITICAL, code: 'IAT_CRITICAL', message: `${w.iat.label}: ${packet.iat.toFixed(1)}°C ≥ ${w.iat.criticalHigh}°C` });
      else if (packet.iat >= w.iat.warningHigh)
        warnings.push({ level: LEVEL.WARNING, code: 'IAT_HIGH', message: `${w.iat.label}: ${packet.iat.toFixed(1)}°C ≥ ${w.iat.warningHigh}°C` });
    }

    // Battery
    if (packet.battery !== null) {
      if (packet.battery <= w.battery.criticalLow)
        warnings.push({ level: LEVEL.CRITICAL, code: 'BATT_CRITICAL', message: `${w.battery.label}: ${packet.battery.toFixed(1)}V ≤ ${w.battery.criticalLow}V` });
      else if (packet.battery <= w.battery.warningLow)
        warnings.push({ level: LEVEL.WARNING, code: 'BATT_LOW', message: `${w.battery.label}: ${packet.battery.toFixed(1)}V ≤ ${w.battery.warningLow}V` });
    }

    // RPM
    if (packet.rpm !== null) {
      if (packet.rpm >= w.rpm.criticalHigh)
        warnings.push({ level: LEVEL.CRITICAL, code: 'RPM_CRITICAL', message: `${w.rpm.label}: ${Math.round(packet.rpm)} ≥ ${w.rpm.criticalHigh}` });
      else if (packet.rpm >= w.rpm.warningHigh)
        warnings.push({ level: LEVEL.WARNING, code: 'RPM_HIGH', message: `${w.rpm.label}: ${Math.round(packet.rpm)} ≥ ${w.rpm.warningHigh}` });
    }

    // Oil pressure
    if (packet.oil_ok === false && packet.rpm !== null && packet.rpm > w.oil.rpmThresholdForCheck)
      warnings.push({ level: LEVEL.CRITICAL, code: 'OIL_FAIL', message: `${w.oil.label}: Motor çalışırken yağ basıncı yok!` });

    // RSSI
    if (packet.rssi !== null) {
      if (packet.rssi <= w.rssi.criticalLow)
        warnings.push({ level: LEVEL.CRITICAL, code: 'RSSI_CRITICAL', message: `${w.rssi.label}: ${packet.rssi} dBm ≤ ${w.rssi.criticalLow} dBm` });
      else if (packet.rssi <= w.rssi.warningLow)
        warnings.push({ level: LEVEL.WARNING, code: 'RSSI_LOW', message: `${w.rssi.label}: ${packet.rssi} dBm ≤ ${w.rssi.warningLow} dBm` });
    }

    // AFR
    if (packet.afr !== null) {
      if (packet.afr >= w.afr.leanCritical)
        warnings.push({ level: LEVEL.CRITICAL, code: 'AFR_LEAN', message: `${w.afr.label}: ${packet.afr.toFixed(1)} - Çok fakir karışım!` });
      else if (packet.afr >= w.afr.leanWarning)
        warnings.push({ level: LEVEL.WARNING, code: 'AFR_LEAN_W', message: `${w.afr.label}: ${packet.afr.toFixed(1)} - Fakir karışım` });
      else if (packet.afr <= w.afr.richCritical)
        warnings.push({ level: LEVEL.CRITICAL, code: 'AFR_RICH', message: `${w.afr.label}: ${packet.afr.toFixed(1)} - Çok zengin karışım!` });
      else if (packet.afr <= w.afr.richWarning)
        warnings.push({ level: LEVEL.WARNING, code: 'AFR_RICH_W', message: `${w.afr.label}: ${packet.afr.toFixed(1)} - Zengin karışım` });
    }

    // Timestamp ekle
    warnings.forEach(w => { w.timestamp = now; });

    this.activeWarnings = warnings;
    if (warnings.length > 0) {
      this.warningHistory.push(...warnings);
      // Geçmişi sınırla
      if (this.warningHistory.length > 500) this.warningHistory = this.warningHistory.slice(-300);
    }

    return warnings;
  }

  /**
   * Veri zaman aşımı kontrolü (periyodik olarak çağrılır).
   * @returns {Object|null}
   */
  checkDataTimeout() {
    const elapsed = Date.now() - this.lastPacketTime;
    const w = DEFAULTS.warnings.noData;
    if (elapsed >= w.criticalMs)
      return { level: LEVEL.CRITICAL, code: 'NO_DATA', message: `${w.label}: ${(elapsed/1000).toFixed(1)}s boyunca veri gelmedi!`, timestamp: Date.now() };
    if (elapsed >= w.warningMs)
      return { level: LEVEL.WARNING, code: 'NO_DATA', message: `${w.label}: ${(elapsed/1000).toFixed(1)}s boyunca veri gelmedi`, timestamp: Date.now() };
    return null;
  }

  /**
   * Paket kaybı yüzdesini hesaplar.
   * @returns {number}
   */
  getPacketLossPercent() {
    if (this.totalExpected <= 0) return 0;
    const loss = ((this.totalExpected - this.totalReceived) / this.totalExpected) * 100;
    return Math.max(0, Math.min(100, loss));
  }

  getActiveWarnings() { return this.activeWarnings; }
  getWarningHistory() { return this.warningHistory; }

  reset() {
    this.activeWarnings = [];
    this.warningHistory = [];
    this.lastCounter = null;
    this.totalExpected = 0;
    this.totalReceived = 0;
    this.lastPacketTime = Date.now();
  }
}

module.exports = { WarningService, LEVEL };
