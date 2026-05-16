# ESP32 Pit RX - Alıcı Kartı (Final)

Pit bilgisayarına bağlı olan ve araçtan E220 LoRa modülü üzerinden gelen telemetri verilerini okuyan firmware.

## Özellikler
- **JSON-Line İletimi:** E220'den UART ile okuduğu verileri satır satır USB Serial üzerinden bilgisayara gönderir.
- **AUX Başlangıç Kontrolü:** Setup'ta AUX HIGH olana kadar bekler (max 3 saniye timeout).
- **Buffer Yönetimi:** 512 byte line buffer. Overflow anında güvenle boşaltır.
- **Debug Modu:** `DEBUG_MODE true` yapılırsa `# ` ile başlayan istatistik satırları basılır. Parser bunları yok sayar.
- **Şeffaf İletişim:** Veriler üzerinde oynama veya parsing yapmaz.

## Pin Bağlantıları

| ESP32 Pin | E220 Modül | Açıklama |
|-----------|------------|----------|
| GPIO 17 (TX) | RXD | Çapraz bağlantı |
| GPIO 16 (RX) | TXD | Çapraz bağlantı |
| GPIO 4 | M0 | Mod seçimi (Normal: LOW) |
| GPIO 5 | M1 | Mod seçimi (Normal: LOW) |
| GPIO 34 | AUX | Zorunlu. Modül hazır/meşgul |
| **5V** | VCC | Stabil 5V gerekli |
| GND | GND | Ortak toprak |

## Debug Modu
Firmware'de `DEBUG_MODE` define'ını `true` yaparak debug çıktılarını aktif edebilirsiniz:
```cpp
#define DEBUG_MODE true
```
Debug açıkken her 10 saniyede bir istatistik basılır:
```
# RX_STATS lines=1523 bytes=245000 overflow=0 last_rx=52ms_ago
```
Bu satırlar `# ` ile başladığı için Electron parser'ı bozmaz.
