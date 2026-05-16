# ESP32 Vehicle TX - Sıralı Test Firmware (Final)

Gerçek CAN verisi gelmeden önce **LoRa hattını, Pit uygulamasını ve CSV kayıt sistemini** doğrulamak için hazırlanmış kontrollü test firmware'i.

## Özellikler
- **Compact JSON formatı:** `{"t":"tlm","c":1,"rpm":1000,"spd":0,...,"fl":0}` — 200 byte altında.
- **10 Hz varsayılan hız** (100ms). `STRESS_TEST_MODE true` ile 20 Hz (50ms).
- **AUX pin yönetimi:** Veri göndermeden önce E220 hazır mı kontrol eder. Timeout olursa paketi atlar ve `lora_drop_count` artırır.
- **Bitmask flags:** `fl` alanında bitmask olarak uyarı kodları gönderilir.
- **Sıralı veri:** Random değil, kontrollü artış/azalış ile tahmin edilebilir davranış.
- **Debug istatistikleri:** Her 100 pakette AUX bekleme, timeout ve drop sayıları yazdırılır.

## Sıralı Veri Davranışı

| Alan | Başlangıç | Bitiş | Artış | Davranış |
|------|-----------|-------|-------|----------|
| RPM | 1000 | 9500 | +250 | Artar, sıfırlanır |
| Speed | 0.0 | 120.0 | +5.0 | Artar, sıfırlanır |
| TPS | 0.0 | 100.0 | +5.0 | Artar, sıfırlanır |
| CLT | 70.0 | 110.0 | +1.0 | Artar, sıfırlanır (100'de uyarı) |
| IAT | 25.0 | 45.0 | +1.0 | Artar, sıfırlanır |
| MAP | 30.0 | 100.0 | +5.0 | Artar, sıfırlanır |
| Battery | 14.2 | 11.0 | -0.1 | Azalır, sıfırlanır (11.5'te uyarı) |
| AFR | 12.5 | 15.5 | +0.1 | Artar, sıfırlanır |
| Gear | 0(N) | 6 | +1 | Döngü |
| Brake | 0 | 1 | - | Her 10 pakette bir aktif |
| Oil | 1 | 0 | - | Her 50 pakette bir fault |

## Pin Bağlantıları
| ESP32 Pin | E220 Modül |
|-----------|------------|
| GPIO 17 (TX) | RXD |
| GPIO 16 (RX) | TXD |
| GPIO 4 | M0 (LOW) |
| GPIO 5 | M1 (LOW) |
| GPIO 34 | AUX (zorunlu) |
| 5V | VCC |
| GND | GND |

## Stress Test
Firmware'de `STRESS_TEST_MODE` define'ını `true` yaparak 20 Hz'e çıkarabilirsiniz:
```cpp
#define STRESS_TEST_MODE true
```
