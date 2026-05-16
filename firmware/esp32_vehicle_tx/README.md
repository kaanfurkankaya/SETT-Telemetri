# ESP32 Vehicle TX (Verici Kartı)

Araç üzerinde bulunan ve E220 LoRa modülü üzerinden pit tarafına telemetri verisi gönderen firmware.

## Özellikler
- **Simülasyon Modu:** Gerçek sensörler olmadan, motor devri (RPM), hız, sıcaklıklar, vb. değişkenleri mantıklı bir şekilde artırıp azaltarak simüle eder.
- **JSON-Line Formatı:** SETT Telemetri uygulamasının tam olarak beklediği formatta (tek satırda JSON ve sonunda `\n`) veri üretir.
- **E220 Entegrasyonu:** M0/M1 pinlerini kontrol eder ve UART üzerinden şeffaf (transparent) modda veri gönderir. AUX pini ile meşguliyet kontrolü yapar.

## Pin Bağlantıları

| ESP32 Pin | E220 Modül | Açıklama |
|---|---|---|
| GPIO 17 (TX) | RXD | Çapraz bağlantı |
| GPIO 16 (RX) | TXD | Çapraz bağlantı |
| GPIO 4 | M0 | Mod seçimi (Normal: LOW) |
| GPIO 5 | M1 | Mod seçimi (Normal: LOW) |
| GPIO 34 | AUX | Modül durum göstergesi |
| 3.3V | VCC | Mantık seviyesi ve besleme |
| GND | GND | Ortak toprak |

## E220 Ayarları (Config Modu M0=1, M1=1)
Modül ayarları yapılandırılırken aşağıdaki parametreler kullanılmalıdır:
- **Baud Rate:** 115200
- **Parity:** 8N1
- **Air Rate:** 62.5 kbps
- **Packet Size:** 200 bytes
- **Transmission Mode:** Transparent
- **Power:** 30 dBm
- **Channel:** 23
- **Address:** 0
- **Key:** 0
- **LBT:** Off
- **Channel RSSI:** Off
- **Packet RSSI:** Off (Açık olursa son byte'a RSSI değerini ekler ve JSON parsing'i bozar)
