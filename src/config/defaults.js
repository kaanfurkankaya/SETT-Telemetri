/**
 * SETT Telemetri - Varsayılan Konfigürasyon
 * 
 * Tüm eşik değerleri, varsayılan ayarlar ve konfigürasyonlar burada tanımlanır.
 * Değiştirmek istediğiniz değeri burada güncelleyin.
 */

const DEFAULTS = {
  // ========================
  // Seri Port Ayarları
  // ========================
  serial: {
    baudRate: 115200,
    baudRateOptions: [9600, 19200, 38400, 57600, 115200, 230400, 256000, 460800, 921600],
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    // Bağlantı kopması için zaman aşımı (ms)
    connectionTimeoutMs: 5000,
  },

  // ========================
  // Uyarı Eşik Değerleri
  // ========================
  warnings: {
    // Soğutma suyu sıcaklığı (°C)
    clt: {
      warningHigh: 100,
      criticalHigh: 110,
      label: 'Soğutma Suyu Sıcaklığı',
    },
    // Emme havası sıcaklığı (°C)
    iat: {
      warningHigh: 55,
      criticalHigh: 65,
      label: 'Emme Havası Sıcaklığı',
    },
    // Akü voltajı (V)
    battery: {
      warningLow: 12.0,
      criticalLow: 11.5,
      label: 'Akü Voltajı',
    },
    // Motor devri (RPM)
    rpm: {
      warningHigh: 11000,
      criticalHigh: 12500,
      label: 'Motor Devri',
    },
    // Yağ basıncı - motor çalışıyorken kontrol
    oil: {
      rpmThresholdForCheck: 2000,
      label: 'Yağ Basıncı',
    },
    // LoRa RSSI (dBm)
    rssi: {
      warningLow: -90,
      criticalLow: -100,
      label: 'LoRa Sinyal Seviyesi',
    },
    // Hava-yakıt oranı (AFR)
    afr: {
      leanWarning: 15.0,
      leanCritical: 16.0,
      richWarning: 11.5,
      richCritical: 10.5,
      label: 'Hava-Yakıt Oranı',
    },
    // Paket kaybı (%)
    packetLoss: {
      warningPercent: 5,
      criticalPercent: 15,
      label: 'Paket Kaybı',
    },
    // Telemetri zaman aşımı (ms) - bu süre boyunca paket gelmezse uyarı
    noData: {
      warningMs: 3000,
      criticalMs: 5000,
      label: 'Veri Zaman Aşımı',
    },
  },

  // ========================
  // Simülasyon Ayarları
  // ========================
  simulation: {
    // Simülasyon paket gönderim aralığı (ms)
    intervalMs: 100,
    // Başlangıç değerleri
    initialRpm: 850,
    initialSpeed: 0,
    initialClt: 45,
    initialIat: 28,
    initialMap: 35,
    initialBattery: 13.8,
    initialAfr: 14.7,
    initialRssi: -65,
  },

  // ========================
  // UI Ayarları
  // ========================
  ui: {
    // Dashboard güncelleme aralığı (ms)
    updateIntervalMs: 100,
    // Ham veri monitöründe gösterilecek maksimum satır
    rawMonitorMaxLines: 200,
    // Paket hızı hesaplama penceresi (ms)
    packetRateWindowMs: 2000,
  },

  // ========================
  // Loglama Ayarları
  // ========================
  logging: {
    // Log dosyaları dizini (uygulama dizinine göre)
    directory: 'logs',
    // Dosya adı öneki
    filePrefix: 'sett_telemetry_log',
  },
};

// Node.js modülü olarak da, tarayıcı tarafında da kullanılabilir
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DEFAULTS;
}
