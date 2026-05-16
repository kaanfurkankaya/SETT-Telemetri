# SETT Telemetri - Pit Dashboard Uygulaması

**SETT-SAU Formula Student Takımı** için geliştirilmiş, içten yanmalı (CV/ICE) araç pit telemetri uygulaması.

## 🏎️ Sistem Mimarisi

```
┌─────────────────┐    LoRa E220     ┌─────────────────┐    USB Serial     ┌─────────────────┐
│  Araç ESP32     │ ─────────────▶  │  Pit ESP32      │ ─────────────▶  │  Pit Bilgisayar │
│  (Verici Kart)  │    Kablosuz     │  (Alıcı Kart)   │    COM Port     │  (Bu Uygulama)  │
│                 │                  │                 │                  │                 │
│ • CAN Bus oku   │                  │ • LoRa al       │                  │ • Veri göster   │
│ • ECU verileri  │                  │ • Serial gönder │                  │ • Uyarılar      │
│ • Sensörler     │                  │                 │                  │ • CSV loglama   │
│ • LoRa gönder   │                  │                 │                  │ • Dashboard     │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

## 📦 Kurulum

### Gereksinimler
- **Node.js** v18+ (https://nodejs.org)
- **npm** (Node.js ile gelir)
- Windows 10/11

### Adımlar

```bash
# 1. Proje dizinine git
cd "SETT Telemetri"

# 2. Bağımlılıkları yükle
npm install

# 3. Uygulamayı başlat
npm start
```

## 🚀 Kullanım

### Simülasyon Modu (Race Simulation)
1. Uygulamayı başlatın
2. Sol panelde **"Simülasyon Başlat"** butonuna tıklayın
3. Dashboard'da gerçek bir Formula Student CV aracının pist üzerindeki davranışlarını taklit eden akıcı veriler gösterilecektir.
4. Üst barda **"📦 SIM_RACE"** etiketi görünecektir.
5. Bu modda; araç kalkar, hızlanır, vites atar, viraja girer ve yavaşlar. TPS, RPM, Hız, AFR, Hararet (CLT) gibi değerler fiziksel olarak birbirine bağlı çalışır. Zaman zaman batarya düşüşü veya yüksek hararet gibi uyarı senaryoları otomatik test edilir. Hız varsayılan olarak 10 Hz'dir.

### Gerçek ESP32 ile Kullanım
1. ESP32 alıcı kartı USB ile pit bilgisayarına bağlayın
2. Uygulamayı başlatın
3. Sol panelde **COM Port** seçin (🔄 ile listeyi yenileyebilirsiniz)
4. **Baud Rate** seçin (varsayılan: 115200)
5. **"Bağlan"** butonuna tıklayın
6. Dashboard'da canlı veriler görüntülenecektir

### CSV Veri Kaydı
1. Bağlantı veya simülasyon aktifken **"Kayda Başla"** butonuna tıklayın
2. Veriler `logs/` klasörüne CSV olarak kaydedilir
3. **"Kaydı Durdur"** ile loglama sonlandırılır
4. CSV dosyaları Excel, Python (pandas), MATLAB ile analiz edilebilir

### Sıralı Telemetri Testi (Sequence Test)
Sistemin güvenilirliğini, paket kayıplarını ve CSV log bütünlüğünü test etmek için özel bir test modu mevcuttur.
1. Araç tarafındaki ESP32'ye `firmware/esp32_vehicle_tx_sequence_test` klasöründeki kodu yükleyin.
2. Pit tarafındaki ESP32'ye `firmware/esp32_pit_rx` kodunu yükleyin.
3. E220 modüllerini USB-TTL ile ayarlayın (aşağıdaki E220 bölümüne bakın).
4. Normal çalışma: `M0=0`, `M1=0` yapın.
5. Uygulamadan COM Port'u seçerek **Bağlan** deyin.

**Beklenen Davranış:** 
- Üst menüde `📦 SEQ` ibaresi belirecektir.
- Veriler rastgele oynamaz; RPM 1000→9500, Hız 0→120, Vites N-1-2-3-4-5-6 döner.
- Uyarılar (CLT>100, Akü<11.5, Oil fault) doğru zamanda tetiklenir.
- Counter ardışık artmalıdır — CSV'de kopukluk yoksa LoRa hattı sağlıklıdır.

**Varsayılan hız:** 10 Hz (100ms aralık). Firmware'de `STRESS_TEST_MODE true` yapılırsa 20 Hz'e çıkar.

## 📡 E220 LoRa Donanım Ayarları

### USB-TTL ile E220 Konfigürasyonu
E220 modül ayarları **USB-TTL adaptörü** ile dışarıdan yapılır. ESP32 firmware içinde config yazma kodu yoktur.

**USB-TTL Bağlantısı (Config Modu):**
| USB-TTL | E220 Modül |
|---------|------------|
| TX      | RXD        |
| RX      | TXD        |
| GND     | GND        |
| 5V      | VCC        |

Config modunda **M0=1, M1=1** yapılmalıdır. Ayar yapıldıktan sonra **M0=0, M1=0** ile normal moda geçilir.

### E220 Modül Ayarları
| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| Baud Rate | 115200 | UART haberleşme hızı |
| Parity | 8N1 | Standart |
| Air Rate | 62.5 kbps | LoRa kablosuz hız |
| Packet Size | 200 bytes | **Paketler bu sınırın altında tutulmalı** |
| Transmission Mode | Transparent | Şeffaf iletim |
| Power | 30 dBm | Maksimum güç |
| Channel | 23 | İki modül aynı kanal |
| Address | 0 | Broadcast |
| Key | 0 | Şifresiz |
| LBT | **Off** | Listen Before Talk kapalı (gecikme önlenir) |
| Channel RSSI | **Off** | Kapalı |
| Packet RSSI | **Off** | Açık olursa son byte'a RSSI eklenir ve JSON parser bozulur |

### ESP32 ↔ E220 Pin Bağlantıları
| ESP32 Pin | E220 Modül | Açıklama |
|-----------|------------|----------|
| GPIO 17 (TX) | RXD | Çapraz bağlantı |
| GPIO 16 (RX) | TXD | Çapraz bağlantı |
| GPIO 4 | M0 | Mod seçimi (Normal: LOW) |
| GPIO 5 | M1 | Mod seçimi (Normal: LOW) |
| GPIO 34 | AUX | **Zorunlu.** Modül hazır/meşgul durumu |
| **5V** | VCC | Stabil 5V (ESP32 5V veya harici regülatör) |
| GND | GND | Ortak toprak |

> ⚠️ **VCC için 5V kullanılmalıdır.** 3.3V yeterli olmayabilir, özellikle 30 dBm gücünde.

### AUX Pin Kullanımı
- AUX **zorunlu** olarak GPIO34'e bağlanmalıdır.
- **AUX HIGH** = modül hazır, veri gönderilebilir.
- **AUX LOW** = modül meşgul, veri gönderme.
- Firmware, veri göndermeden önce AUX'u kontrol eder.
- AUX uzun süre LOW kalırsa paket atlanır ve `lora_drop_count` artar.

## 📡 Veri Formatı

Parser iki formatı da destekler: **Compact JSON** (yeni, önerilen) ve **Legacy JSON** (geriye uyumluluk).

### Compact JSON (Varsayılan)
Paket boyutunu minimumda tutmak için kısa alan adları kullanılır. **200 byte sınırının** altında kalır.
```json
{"t":"tlm","c":1521,"ms":834220,"rpm":6500,"spd":72.4,"tps":38.2,"clt":86.5,"iat":34.1,"map":78.3,"bat":13.7,"g":3,"brk":0,"oil":1,"afr":13.2,"src":"SEQ","fl":0}
```

### Legacy JSON (Geriye Uyumlu)
Daha önce kullanılan uzun alan adlı format hâlâ desteklenir.
```json
{"type":"telemetry","counter":1521,"time_ms":834220,"rpm":6500,"speed":72.4,"tps":38.2,"clt":86.5,"iat":34.1,"map":78.3,"battery":13.7,"gear":3,"brake":0,"oil_ok":true,"afr":13.2,"flags":["OK"]}
```

### Alan Eşleşmeleri

| Compact | Legacy | Tip | Açıklama |
|---------|--------|-----|----------|
| `t` | `type` | string | "tlm" veya "telemetry" |
| `c` | `counter` | int | Paket sayacı |
| `ms` | `time_ms` | int | Araç tarafı zaman (ms) |
| `rpm` | `rpm` | int | Motor devri |
| `spd` | `speed` | float | Hız (km/h) |
| `tps` | `tps` | float | Gaz kelebeği (%) |
| `clt` | `clt` | float | Soğutma suyu (°C) |
| `iat` | `iat` | float | Emme havası (°C) |
| `map` | `map` | float | Manifold basıncı (kPa) |
| `bat` | `battery` | float | Akü voltajı (V) |
| `g` | `gear` | int/str | Vites (0=N, 1-6) |
| `brk` | `brake` | int | Fren (0/1) |
| `oil` | `oil_ok` | int/bool | Yağ basıncı (1=OK, 0=fault) |
| `afr` | `afr` | float | Hava-yakıt oranı |
| `src` | `data_source` | string | Kaynak ("SEQ", "CAN", "MIX") |
| `fl` | `flags` | int/array | Bitmask veya flag dizisi |

### Flags Bitmask

| Bit | Değer | Anlamı |
|-----|-------|--------|
| 0 | 0x00 | OK / Hata yok |
| 1 | 0x02 | HIGH_CLT |
| 2 | 0x04 | LOW_BATTERY |
| 3 | 0x08 | OIL_FAULT |
| 4 | 0x10 | WEAK_RSSI |
| 5 | 0x20 | SENSOR_INVALID |
| 6 | 0x40 | CAN_TIMEOUT |
| 7 | 0x80 | RESERVED |

`fl=0` → sorun yok, `fl=6` → HIGH_CLT + LOW_BATTERY

## 📊 CSV Log Formatı

```csv
timestamp,time_ms,counter,rpm,speed,tps,clt,iat,map,battery,gear,brake,oil_ok,afr,rssi,ecu_status,data_source,flags,flags_bitmask,warnings
1716825022000,834220,1521,6500,72.4,38.2,86.5,34.1,78.3,13.7,3,0,true,13.2,-84,,SEQ,OK,0,
```

## ⚠️ Uyarı Sistemi

| Koşul | Seviye |
|-------|--------|
| CLT ≥ 110°C | KRİTİK |
| CLT ≥ 100°C | UYARI |
| Akü ≤ 11.5V | KRİTİK |
| Akü ≤ 12.0V | UYARI |
| RPM ≥ 12500 | KRİTİK |
| Yağ basıncı yok (RPM>2000) | KRİTİK |
| RSSI ≤ -100 dBm | KRİTİK |
| 5 saniye veri yok | KRİTİK |
| AFR ≥ 16.0 (fakir) | KRİTİK |
| AFR ≤ 10.5 (zengin) | KRİTİK |

Uyarılar hem eşik tabanlı (warningService) hem de firmware `fl` bitmask üzerinden tetiklenir.

## 🛠️ Proje Yapısı

```
SETT Telemetri/
├── main.js                            # Electron ana süreç
├── preload.js                         # IPC güvenlik köprüsü
├── index.html                         # Dashboard HTML
├── index.css                          # Koyu tema stiller
├── renderer.js                        # UI kontrol scripti
├── package.json                       # Proje bağımlılıkları
├── src/
│   ├── models/
│   │   └── telemetry.js               # Telemetri veri modeli (compact + legacy)
│   ├── services/
│   │   ├── serialService.js           # Seri port haberleşme
│   │   ├── parserService.js           # JSON-line parser (dual format)
│   │   ├── simulationService.js       # Simülasyon modu
│   │   ├── warningService.js          # Uyarı mantığı
│   │   └── loggingService.js          # CSV loglama
│   └── config/
│       └── defaults.js                # Varsayılan ayarlar ve eşikler
├── firmware/
│   ├── esp32_vehicle_tx/              # Araç verici (Random simülasyon)
│   ├── esp32_vehicle_tx_sequence_test/# Araç verici (Sıralı test, 10Hz)
│   └── esp32_pit_rx/                  # Pit alıcı (JSON-line köprü)
├── logs/                              # CSV log dosyaları
├── AI_DEVELOPMENT_LOG.md              # AI geliştirme günlüğü
└── README.md                          # Bu dosya
```

## 📋 Bilinen Eksikler

- [ ] Grafik görünümleri (zaman serisi grafikleri)
- [ ] Gerçek CAN Bus entegrasyonu (Vehicle TX)
- [ ] Ayarlar paneli (UI üzerinden eşik düzenleme)
- [ ] Veri replay modu (CSV'den playback)
- [ ] Electron packaging (EXE oluşturma)
- [ ] Otomatik yeniden bağlanma
- [ ] Gerçek E220 Packet RSSI desteği (custom parser gerekli)
- [ ] Binary packet parser desteği

## 📝 Lisans

SETT-SAU Formula Student Takımı - İç kullanım
