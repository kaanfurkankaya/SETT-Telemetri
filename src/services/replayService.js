/**
 * SETT Telemetri - CSV replay service
 *
 * Reads CSV logs written by loggingService and replays them as JSON-line
 * telemetry packets, so the existing parser, warning logic and UI can be
 * exercised without live hardware.
 */
const fs = require('fs');
const path = require('path');
const TelemetryPacket = require('../models/telemetry');

class ReplayService {
  constructor() {
    this.running = false;
    this.timer = null;
    this.rows = [];
    this.index = 0;
    this.speed = 1;
    this.filePath = null;
    this.onData = null;
    this.onDone = null;
    this.packetTimes = [];
  }

  load(filePath) {
    if (!filePath) return { success: false, error: 'CSV dosyasi secilmedi' };
    if (!fs.existsSync(filePath)) return { success: false, error: 'CSV dosyasi bulunamadi' };

    try {
      const text = fs.readFileSync(filePath, 'utf8');
      const parsedRows = this._parseCsv(text);
      if (parsedRows.length === 0) {
        return { success: false, error: 'CSV icinde telemetri satiri yok' };
      }

      this.rows = parsedRows;
      this.filePath = filePath;
      this.index = 0;

      return {
        success: true,
        filePath,
        fileName: path.basename(filePath),
        packetCount: this.rows.length,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  start(filePath, speed, onData, onDone) {
    if (this.running) return { success: false, error: 'Replay zaten aktif' };

    if (!this.filePath || filePath !== this.filePath) {
      const loaded = this.load(filePath);
      if (!loaded.success) return loaded;
    }

    this.running = true;
    this.index = 0;
    this.speed = Number(speed) > 0 ? Number(speed) : 1;
    this.onData = onData;
    this.onDone = onDone;
    this.packetTimes = [];
    this._emitCurrent();

    return {
      success: true,
      filePath: this.filePath,
      fileName: path.basename(this.filePath),
      packetCount: this.rows.length,
    };
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.running = false;
    this.onData = null;
    this.onDone = null;
    this.packetTimes = [];
  }

  isRunning() {
    return this.running;
  }

  getPacketRateHz() {
    const now = Date.now();
    this.packetTimes = this.packetTimes.filter(t => now - t < 2000);
    if (this.packetTimes.length < 2) return 0;
    return (this.packetTimes.length / 2).toFixed(1);
  }

  getStatus() {
    return {
      isRunning: this.running,
      filePath: this.filePath,
      fileName: this.filePath ? path.basename(this.filePath) : null,
      packetCount: this.rows.length,
      currentIndex: this.index,
      speed: this.speed,
    };
  }

  _emitCurrent() {
    if (!this.running || this.index >= this.rows.length) {
      this._finish();
      return;
    }

    const row = this.rows[this.index];
    const packet = this._rowToPacket(row, this.index);
    const now = Date.now();
    this.packetTimes.push(now);
    this.packetTimes = this.packetTimes.filter(t => now - t < 2000);

    if (this.onData) this.onData(JSON.stringify(packet));

    const delay = this._nextDelayMs(this.index);
    this.index++;
    this.timer = setTimeout(() => this._emitCurrent(), delay);
  }

  _finish() {
    const done = this.onDone;
    this.stop();
    if (done) done();
  }

  _nextDelayMs(index) {
    if (index >= this.rows.length - 1) return 100;

    const curTime = this._rowTimeMs(this.rows[index]);
    const nextTime = this._rowTimeMs(this.rows[index + 1]);
    const delta = nextTime !== null && curTime !== null ? nextTime - curTime : 100;
    const normalized = Number.isFinite(delta) && delta > 0 ? delta : 100;
    return Math.max(10, Math.min(1000, normalized / this.speed));
  }

  _rowTimeMs(row) {
    const timeMs = Number(row.time_ms);
    if (Number.isFinite(timeMs)) return timeMs;

    const timestamp = Number(row.timestamp);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  _rowToPacket(row, index) {
    const flags = this._flagsFromRow(row);
    const bitmask = this._numberOrNull(row.flags_bitmask);
    const packet = {
      type: 'telemetry',
      counter: this._numberOr(row.counter, index + 1),
      time_ms: this._numberOr(row.time_ms, index * 100),
      rpm: this._numberOrNull(row.rpm),
      speed: this._numberOrNull(row.speed),
      tps: this._numberOrNull(row.tps),
      clt: this._numberOrNull(row.clt),
      iat: this._numberOrNull(row.iat),
      map: this._numberOrNull(row.map),
      battery: this._numberOrNull(row.battery),
      gear: row.gear === '' ? null : row.gear,
      brake: this._numberOrNull(row.brake),
      oil_ok: this._boolOrNull(row.oil_ok),
      afr: this._numberOrNull(row.afr),
      rssi: this._numberOrNull(row.rssi),
      ecu_status: row.ecu_status || null,
      data_source: 'CSV_REPLAY',
    };

    if (flags.length > 0) packet.flags = flags;
    if (bitmask !== null) packet.fl = bitmask;
    return packet;
  }

  _parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = this._splitCsvLine(lines[0]).map(h => h.trim());
    const supported = TelemetryPacket.getCsvHeaders().filter(h => headers.includes(h));
    if (supported.length < 5) return [];

    return lines.slice(1).map(line => {
      const values = this._splitCsvLine(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] !== undefined ? values[i] : '';
      });
      return row;
    });
  }

  _splitCsvLine(line) {
    const result = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(value);
        value = '';
      } else {
        value += ch;
      }
    }

    result.push(value);
    return result;
  }

  _numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  _numberOr(value, fallback) {
    const n = this._numberOrNull(value);
    return n === null ? fallback : n;
  }

  _boolOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return null;
  }

  _flagsFromRow(row) {
    if (row.flags) return row.flags.split(';').filter(Boolean);
    return [];
  }
}

module.exports = ReplayService;
