/**
 * SETT Telemetri - Seri Port Haberleşme Servisi
 * ESP32 alıcı karttan USB seri port üzerinden veri okur.
 * Node.js serialport paketi kullanır (Electron main process).
 */
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('serialport');
const DEFAULTS = require('../config/defaults');

class SerialService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.status = 'offline'; // offline, connecting, online, error
    this.portPath = null;
    this.baudRate = DEFAULTS.serial.baudRate;

    // Callbacks
    this.onData = null;       // (line: string) => void
    this.onStatus = null;     // (status: string) => void
    this.onError = null;      // (error: string) => void

    // Paket istatistikleri
    this.packetTimes = [];
    this.lastPacketTime = null;
    this.totalPackets = 0;
  }

  /**
   * Mevcut COM portları listeler.
   * @returns {Promise<Array<{path: string, manufacturer: string}>>}
   */
  static async listPorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Bilinmiyor',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
      }));
    } catch (err) {
      console.error('Port listesi alınamadı:', err.message);
      return [];
    }
  }

  /**
   * Belirtilen porta bağlanır.
   * @param {string} portPath - COM port yolu (örn: COM3)
   * @param {number} baudRate - Baud rate
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async connect(portPath, baudRate) {
    if (this.status === 'online') {
      await this.disconnect();
    }

    this.portPath = portPath;
    this.baudRate = baudRate || this.baudRate;
    this._setStatus('connecting');

    return new Promise((resolve) => {
      try {
        this.port = new SerialPort({
          path: portPath,
          baudRate: this.baudRate,
          dataBits: DEFAULTS.serial.dataBits,
          stopBits: DEFAULTS.serial.stopBits,
          parity: DEFAULTS.serial.parity,
          autoOpen: false,
        });

        // Satır satır okuma
        this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

        this.parser.on('data', (line) => {
          this.totalPackets++;
          const now = Date.now();
          this.packetTimes.push(now);
          this.lastPacketTime = now;
          // Son N saniye dışındaki kayıtları temizle
          const window = DEFAULTS.ui.packetRateWindowMs;
          this.packetTimes = this.packetTimes.filter(t => now - t < window);

          if (this.onData) this.onData(line);
        });

        this.port.on('error', (err) => {
          this._setStatus('error');
          if (this.onError) this.onError(err.message);
        });

        this.port.on('close', () => {
          this._setStatus('offline');
        });

        this.port.open((err) => {
          if (err) {
            this._setStatus('error');
            resolve({ success: false, error: err.message });
          } else {
            this._setStatus('online');
            this.packetTimes = [];
            this.totalPackets = 0;
            resolve({ success: true });
          }
        });
      } catch (err) {
        this._setStatus('error');
        resolve({ success: false, error: err.message });
      }
    });
  }

  /**
   * Bağlantıyı keser.
   * @returns {Promise<void>}
   */
  async disconnect() {
    return new Promise((resolve) => {
      if (this.port && this.port.isOpen) {
        this.port.close((err) => {
          this.port = null;
          this.parser = null;
          this._setStatus('offline');
          resolve();
        });
      } else {
        this.port = null;
        this.parser = null;
        this._setStatus('offline');
        resolve();
      }
    });
  }

  /**
   * Paket geliş hızını Hz cinsinden hesaplar.
   * @returns {number}
   */
  getPacketRateHz() {
    if (this.packetTimes.length < 2) return 0;
    const window = DEFAULTS.ui.packetRateWindowMs;
    const now = Date.now();
    const recent = this.packetTimes.filter(t => now - t < window);
    if (recent.length < 2) return 0;
    return (recent.length / (window / 1000)).toFixed(1);
  }

  /**
   * Son paket zamanından bu yana geçen süre (ms).
   * @returns {number}
   */
  getTimeSinceLastPacket() {
    if (!this.lastPacketTime) return Infinity;
    return Date.now() - this.lastPacketTime;
  }

  getStatus() { return this.status; }
  isConnected() { return this.status === 'online'; }

  _setStatus(status) {
    this.status = status;
    if (this.onStatus) this.onStatus(status);
  }
}

module.exports = SerialService;
