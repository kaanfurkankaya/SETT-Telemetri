/**
 * SETT Telemetri - CSV Loglama Servisi
 * Test ve yarış oturumları için telemetri verilerini CSV'ye kaydeder.
 */
const fs = require('fs');
const path = require('path');
const TelemetryPacket = require('../models/telemetry');
const DEFAULTS = require('../config/defaults');

class LoggingService {
  constructor(appPath) {
    this.appPath = appPath;
    this.isLogging = false;
    this.filePath = null;
    this.fileStream = null;
    this.packetCount = 0;
    this.startTime = null;
    this.fileName = null;
  }

  /**
   * Loglamayı başlatır. Yeni CSV dosyası oluşturur.
   * @returns {{ success: boolean, filePath: string, error?: string }}
   */
  startLogging() {
    if (this.isLogging) return { success: false, error: 'Loglama zaten aktif' };

    try {
      const logDir = path.join(this.appPath, DEFAULTS.logging.directory);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      this.fileName = `${DEFAULTS.logging.filePrefix}_${dateStr}_${timeStr}.csv`;
      this.filePath = path.join(logDir, this.fileName);

      // CSV header yaz
      const headers = TelemetryPacket.getCsvHeaders();
      this.fileStream = fs.createWriteStream(this.filePath, { flags: 'w', encoding: 'utf8' });
      this.fileStream.write(headers.join(',') + '\n');

      this.isLogging = true;
      this.packetCount = 0;
      this.startTime = Date.now();

      return { success: true, filePath: this.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Loglamayı durdurur ve dosyayı kapatır.
   * @returns {{ success: boolean, packetCount: number, duration: number, filePath: string }}
   */
  stopLogging() {
    if (!this.isLogging) return { success: false, packetCount: 0, duration: 0, filePath: '' };

    const duration = Date.now() - this.startTime;
    const count = this.packetCount;
    const fp = this.filePath;

    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    this.isLogging = false;
    this.filePath = null;
    this.startTime = null;

    return { success: true, packetCount: count, duration, filePath: fp };
  }

  /**
   * Telemetri paketini ve uyarıları CSV satırı olarak yazar.
   * @param {import('../models/telemetry')} packet
   * @param {Array} warnings - Aktif uyarı listesi
   */
  logPacket(packet, warnings = []) {
    if (!this.isLogging || !this.fileStream) return;

    try {
      const flat = packet.toFlatObject();
      const warningStr = warnings.map(w => `${w.level}:${w.code}`).join(';');

      const headers = TelemetryPacket.getCsvHeaders();
      const values = headers.map(h => {
        if (h === 'warnings') return this._escapeCsv(warningStr);
        const val = flat[h];
        if (val === null || val === undefined) return '';
        return this._escapeCsv(String(val));
      });

      this.fileStream.write(values.join(',') + '\n');
      this.packetCount++;
    } catch (err) {
      // Loglama hatası uygulamayı çökertmemeli
      console.error('CSV log yazma hatası:', err.message);
    }
  }

  /**
   * CSV değerini escape eder.
   * @private
   */
  _escapeCsv(str) {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Loglama durumu bilgisi döndürür.
   */
  getStatus() {
    return {
      isLogging: this.isLogging,
      fileName: this.fileName,
      packetCount: this.packetCount,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      filePath: this.filePath,
    };
  }
}

module.exports = LoggingService;
