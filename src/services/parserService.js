/**
 * SETT Telemetri - Paket Parser Servisi
 * 
 * Seri porttan gelen ham veriyi TelemetryPacket nesnesine dönüştürür.
 * İki JSON formatını destekler:
 *   1. Legacy (uzun):   {"type":"telemetry","counter":1,"rpm":2500,...}
 *   2. Compact (kısa):  {"t":"tlm","c":1,"rpm":2500,"spd":12.4,...}
 * 
 * Compact alias eşleşmeleri TelemetryPacket constructor'ında yapılır.
 * Parser sadece JSON geçerliliğini ve paket tipini kontrol eder.
 */

const TelemetryPacket = require('../models/telemetry');

/**
 * JSON-Line parser - her satır bir JSON nesnesi
 */
class JsonLineParser {
  constructor() {
    this.parseErrors = 0;
    this.parseSuccess = 0;
  }

  /**
   * Ham satırı parse eder.
   * @param {string} line - Seri porttan gelen bir satır
   * @returns {TelemetryPacket|null} - Parse edilmiş paket veya null
   */
  parse(line) {
    if (!line || typeof line !== 'string') return null;

    const trimmed = line.trim();
    if (trimmed.length === 0) return null;

    // JSON ile başlamayan satırları atla (debug mesajları "# " ile başlar)
    if (!trimmed.startsWith('{')) {
      return null;
    }

    try {
      const obj = JSON.parse(trimmed);

      // Paket tipi kontrolü:
      // Legacy: type === 'telemetry'
      // Compact: t === 'tlm'
      // Tip belirtilmemişse de kabul et (backward compat)
      if (obj.type && obj.type !== 'telemetry') return null;
      if (obj.t && obj.t !== 'tlm') return null;

      this.parseSuccess++;
      return new TelemetryPacket(obj);
    } catch (err) {
      this.parseErrors++;
      return null;
    }
  }

  /**
   * Parser istatistiklerini döndürür.
   * @returns {{ success: number, errors: number, errorRate: number }}
   */
  getStats() {
    const total = this.parseSuccess + this.parseErrors;
    return {
      success: this.parseSuccess,
      errors: this.parseErrors,
      errorRate: total > 0 ? (this.parseErrors / total * 100).toFixed(1) : 0,
    };
  }

  /**
   * İstatistikleri sıfırlar.
   */
  reset() {
    this.parseErrors = 0;
    this.parseSuccess = 0;
  }
}

/**
 * Parser Factory - ileride binary parser eklenebilir
 * @param {string} type - 'json-line' veya 'binary' (gelecek)
 * @returns {JsonLineParser}
 */
function createParser(type = 'json-line') {
  switch (type) {
    case 'json-line':
      return new JsonLineParser();
    // İleride: case 'binary': return new BinaryParser();
    default:
      return new JsonLineParser();
  }
}

module.exports = { JsonLineParser, createParser };
