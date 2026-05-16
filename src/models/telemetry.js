/**
 * SETT Telemetri - Telemetri Veri Modeli
 * 
 * Formula Student içten yanmalı araç için telemetri veri modeli.
 * Hem eski uzun JSON formatını hem compact JSON formatını destekler.
 * Eksik alanlar null olarak işaretlenir, uygulama çökmez.
 * Yeni alanlar kolayca eklenebilir.
 */

/**
 * Flags bitmask tanımları (firmware ile senkron)
 * bit0: OK           bit1: HIGH_CLT        bit2: LOW_BATTERY
 * bit3: OIL_FAULT    bit4: WEAK_RSSI       bit5: SENSOR_INVALID
 * bit6: CAN_TIMEOUT  bit7: RESERVED
 */
const FLAGS_MAP = {
  0x02: 'HIGH_CLT',
  0x04: 'LOW_BATTERY',
  0x08: 'OIL_FAULT',
  0x10: 'WEAK_RSSI',
  0x20: 'SENSOR_INVALID',
  0x40: 'CAN_TIMEOUT',
};

class TelemetryPacket {
  /**
   * @param {Object} raw - Parse edilmiş JSON nesnesi (uzun veya compact format)
   */
  constructor(raw = {}) {
    // Zaman bilgisi
    this.timestamp = Date.now();
    this.time_ms = raw.time_ms ?? raw.ms ?? null;

    // Paket sayacı
    this.counter = raw.counter ?? raw.c ?? null;

    // Motor verileri
    this.rpm = TelemetryPacket.sanitizeNumber(raw.rpm);
    this.tps = TelemetryPacket.sanitizeNumber(raw.tps);       // Throttle Position (%)
    this.map = TelemetryPacket.sanitizeNumber(raw.map);       // Manifold Absolute Pressure (kPa)
    this.afr = TelemetryPacket.sanitizeNumber(raw.afr);       // Air-Fuel Ratio

    // Araç verileri
    this.speed = TelemetryPacket.sanitizeNumber(raw.speed ?? raw.spd);
    this.gear = raw.gear ?? raw.g ?? null;                     // Vites (0=N, 1-6)
    this.brake = raw.brake ?? raw.brk ?? null;                 // Fren durumu (0/1)

    // Sıcaklıklar
    this.clt = TelemetryPacket.sanitizeNumber(raw.clt);       // Coolant Temperature (°C)
    this.iat = TelemetryPacket.sanitizeNumber(raw.iat);       // Intake Air Temperature (°C)

    // Elektrik
    this.battery = TelemetryPacket.sanitizeNumber(raw.battery ?? raw.bat);

    // Yağ durumu — compact: oil (1/0), legacy: oil_ok (true/false)
    if (raw.oil_ok !== undefined) {
      this.oil_ok = raw.oil_ok;
    } else if (raw.oil !== undefined) {
      this.oil_ok = raw.oil === 1 || raw.oil === true;
    } else {
      this.oil_ok = null;
    }

    // ECU durumu
    this.ecu_status = raw.ecu_status ?? null;

    // Flags — compact bitmask veya legacy array
    this.flags_bitmask = (typeof raw.fl === 'number') ? raw.fl : null;
    if (Array.isArray(raw.flags)) {
      this.flags = raw.flags;
    } else if (this.flags_bitmask !== null) {
      this.flags = TelemetryPacket.bitmaskToFlags(this.flags_bitmask);
    } else {
      this.flags = [];
    }

    // LoRa / İletişim
    this.rssi = TelemetryPacket.sanitizeNumber(raw.rssi);

    // Veri kaynağı
    this.data_source = raw.data_source ?? raw.src ?? null;
    this.can_online = raw.can_online ?? null;
    this.can_rx_count = TelemetryPacket.sanitizeNumber(raw.can_rx_count);
    this.can_error_count = TelemetryPacket.sanitizeNumber(raw.can_error_count);

    // Paket tipi
    // compact: t == "tlm" → telemetry, legacy: type == "telemetry"
    if (raw.type) {
      this.type = raw.type;
    } else if (raw.t === 'tlm') {
      this.type = 'telemetry';
    } else {
      this.type = 'telemetry';
    }

    // Orijinal ham veri (debug için)
    this._raw = raw;
  }

  /**
   * Sayısal değeri güvenli hale getirir.
   * @param {*} value 
   * @returns {number|null}
   */
  static sanitizeNumber(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return null;
    return num;
  }

  /**
   * Bitmask'ı okunabilir flag listesine çevirir.
   * @param {number} bitmask
   * @returns {string[]}
   */
  static bitmaskToFlags(bitmask) {
    if (bitmask === 0) return ['OK'];
    const result = [];
    for (const [bit, name] of Object.entries(FLAGS_MAP)) {
      if (bitmask & parseInt(bit)) result.push(name);
    }
    return result.length > 0 ? result : ['OK'];
  }

  /**
   * Paketin temel geçerliliğini kontrol eder.
   * @returns {boolean}
   */
  isValid() {
    return this.type === 'telemetry' && (
      this.rpm !== null ||
      this.speed !== null ||
      this.tps !== null
    );
  }

  /**
   * Tüm telemetri alanlarını düz nesne olarak döndürür (CSV için).
   * @returns {Object}
   */
  toFlatObject() {
    return {
      timestamp: this.timestamp,
      time_ms: this.time_ms,
      counter: this.counter,
      rpm: this.rpm,
      speed: this.speed,
      tps: this.tps,
      clt: this.clt,
      iat: this.iat,
      map: this.map,
      battery: this.battery,
      gear: this.gear,
      brake: this.brake,
      oil_ok: this.oil_ok,
      afr: this.afr,
      rssi: this.rssi,
      ecu_status: this.ecu_status,
      data_source: this.data_source,
      flags: this.flags.join(';'),
      flags_bitmask: this.flags_bitmask,
    };
  }

  /**
   * CSV header satırı için alan adları.
   * @returns {string[]}
   */
  static getCsvHeaders() {
    return [
      'timestamp', 'time_ms', 'counter',
      'rpm', 'speed', 'tps', 'clt', 'iat', 'map',
      'battery', 'gear', 'brake', 'oil_ok', 'afr',
      'rssi', 'ecu_status', 'data_source',
      'flags', 'flags_bitmask', 'warnings'
    ];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TelemetryPacket;
}
