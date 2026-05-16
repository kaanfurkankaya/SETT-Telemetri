/*
 * SETT Telemetri - ESP32 Vehicle TX (Sıralı Test - Final)
 * 
 * Son ürün odaklı sıralı test firmware'i.
 * Compact JSON formatı, AUX yönetimi, 10 Hz varsayılan hız.
 * E220 ayarları USB-TTL ile dışarıdan yapılır, bu kodda config yazma yoktur.
 * 
 * Pinleme:
 *   E220 RXD  <- ESP32 GPIO17 (TX)
 *   E220 TXD  -> ESP32 GPIO16 (RX)
 *   E220 M0   <- ESP32 GPIO4  (LOW = normal mod)
 *   E220 M1   <- ESP32 GPIO5  (LOW = normal mod)
 *   E220 AUX  -> ESP32 GPIO34 (modül hazır/meşgul)
 *   E220 VCC  <- 5V (stabil harici veya ESP32 5V)
 *   E220 GND  <- GND
 */

#include <Arduino.h>

// ===================== KONFİGÜRASYON =====================
#define LORA_RX_PIN    16
#define LORA_TX_PIN    17
#define LORA_M0_PIN    4
#define LORA_M1_PIN    5
#define LORA_AUX_PIN   34

#define LORA_BAUD      115200
#define USB_BAUD       115200

// Gönderim hızı: 10 Hz (100 ms) varsayılan
// STRESS_TEST_MODE true yapılırsa 20 Hz (50 ms)
#define STRESS_TEST_MODE false

#if STRESS_TEST_MODE
  #define SEND_INTERVAL_MS 50
#else
  #define SEND_INTERVAL_MS 100
#endif

#define AUX_TIMEOUT_MS     50   // AUX HIGH bekleme süresi (ms)
#define MAX_PACKET_SIZE    200  // E220 packet size limiti

// ===================== GLOBAL DEĞİŞKENLER =====================
HardwareSerial LoRaSerial(1);

unsigned long lastSendTime = 0;
unsigned long packetCounter = 0;

// AUX metrikleri
unsigned long auxWaitCount   = 0;   // AUX için bekleme sayısı
unsigned long auxTimeoutCount = 0;  // AUX timeout (paket atlandı) sayısı
unsigned long loraDropCount   = 0;  // Toplam düşürülen paket
unsigned long lastAuxWaitUs   = 0;  // Son AUX bekleme süresi (us)
bool loraReady = false;

// Sıralı test değişkenleri
int   seq_rpm       = 1000;
float seq_speed     = 0.0;
float seq_tps       = 0.0;
float seq_clt       = 70.0;
float seq_iat       = 25.0;
float seq_map       = 30.0;
float seq_battery   = 14.2;
int   seq_gear      = 0;     // 0=N, 1-6
int   seq_brake     = 0;
int   seq_oil       = 1;     // 1=ok, 0=fault
float seq_afr       = 12.5;

// ===================== FLAGS BITMASK =====================
// bit0: OK           bit1: HIGH_CLT        bit2: LOW_BATTERY
// bit3: OIL_FAULT    bit4: WEAK_RSSI       bit5: SENSOR_INVALID
// bit6: CAN_TIMEOUT  bit7: RESERVED
#define FLAG_OK              0x00
#define FLAG_HIGH_CLT        0x02
#define FLAG_LOW_BATTERY     0x04
#define FLAG_OIL_FAULT       0x08

// ===================== SETUP =====================
void setup() {
  Serial.begin(USB_BAUD);
  delay(500);
  Serial.println("\n# --- SETT Telemetri SEQ Test TX (Final) ---");
  Serial.printf("# Send interval: %d ms (%s)\n", SEND_INTERVAL_MS,
    STRESS_TEST_MODE ? "STRESS 20Hz" : "NORMAL 10Hz");

  // Pin ayarları
  pinMode(LORA_M0_PIN, OUTPUT);
  pinMode(LORA_M1_PIN, OUTPUT);
  pinMode(LORA_AUX_PIN, INPUT);

  // Normal çalışma modu: M0=LOW, M1=LOW
  digitalWrite(LORA_M0_PIN, LOW);
  digitalWrite(LORA_M1_PIN, LOW);

  // E220 UART başlat
  LoRaSerial.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

  // AUX HIGH olana kadar bekle (modül hazır olsun)
  Serial.print("# AUX bekleniyor...");
  unsigned long auxStart = millis();
  while (digitalRead(LORA_AUX_PIN) == LOW) {
    if (millis() - auxStart > 3000) {
      Serial.println(" TIMEOUT (3s)! Devam ediliyor.");
      break;
    }
    delay(10);
  }
  if (digitalRead(LORA_AUX_PIN) == HIGH) {
    Serial.println(" OK");
    loraReady = true;
  }

  Serial.println("# Hazir. Paket gonderimi basliyor.");
}

// ===================== LOOP =====================
void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    packetCounter++;

    // 1. Sıralı değerleri güncelle
    updateSequence();

    // 2. Flags bitmask hesapla
    uint8_t fl = FLAG_OK;
    if (seq_clt > 100.0)      fl |= FLAG_HIGH_CLT;
    if (seq_battery < 11.5)   fl |= FLAG_LOW_BATTERY;
    if (seq_oil == 0)         fl |= FLAG_OIL_FAULT;

    // 3. Compact JSON oluştur
    char pkt[256];
    int len = snprintf(pkt, sizeof(pkt),
      "{\"t\":\"tlm\",\"c\":%lu,\"ms\":%lu,\"rpm\":%d,\"spd\":%.1f,"
      "\"tps\":%.1f,\"clt\":%.1f,\"iat\":%.1f,\"map\":%.1f,"
      "\"bat\":%.1f,\"g\":%d,\"brk\":%d,\"oil\":%d,"
      "\"afr\":%.1f,\"src\":\"SEQ\",\"fl\":%d}\n",
      packetCounter, now, seq_rpm, seq_speed,
      seq_tps, seq_clt, seq_iat, seq_map,
      seq_battery, seq_gear, seq_brake, seq_oil,
      seq_afr, fl
    );

    // 4. Paket boyutu kontrolü
    if (len >= MAX_PACKET_SIZE) {
      Serial.printf("# WARN: Paket %d byte >= %d limit!\n", len, MAX_PACKET_SIZE);
    }

    // 5. AUX kontrolü: modül hazır mı?
    bool auxOk = true;
    if (digitalRead(LORA_AUX_PIN) == LOW) {
      auxWaitCount++;
      unsigned long waitStart = micros();
      unsigned long waitDeadline = millis() + AUX_TIMEOUT_MS;

      while (digitalRead(LORA_AUX_PIN) == LOW) {
        if (millis() >= waitDeadline) {
          auxOk = false;
          auxTimeoutCount++;
          break;
        }
        delayMicroseconds(100);
      }
      lastAuxWaitUs = micros() - waitStart;
    }

    // 6. Gönder veya düşür
    if (auxOk) {
      LoRaSerial.print(pkt);
      loraReady = true;
    } else {
      loraDropCount++;
      loraReady = false;
      Serial.printf("# DROP c=%lu aux_timeout=%lu total_drop=%lu\n",
        packetCounter, auxTimeoutCount, loraDropCount);
    }

    // 7. USB Debug çıktısı (her zaman)
    Serial.print(pkt);

    // 8. Her 100 pakette AUX istatistik
    if (packetCounter % 100 == 0) {
      Serial.printf("# STATS c=%lu aux_wait=%lu aux_to=%lu drop=%lu last_wait_us=%lu\n",
        packetCounter, auxWaitCount, auxTimeoutCount, loraDropCount, lastAuxWaitUs);
    }
  }
}

// ===================== SIRALI VERİ GÜNCELLEMESİ =====================
void updateSequence() {
  // RPM: 1000 -> 9500 (artış 250)
  seq_rpm += 250;
  if (seq_rpm > 9500) seq_rpm = 1000;

  // Speed: 0 -> 120 (artış 5)
  seq_speed += 5.0;
  if (seq_speed > 120.0) seq_speed = 0.0;

  // TPS: 0 -> 100 (artış 5)
  seq_tps += 5.0;
  if (seq_tps > 100.0) seq_tps = 0.0;

  // Gear: 0(N), 1, 2, 3, 4, 5, 6
  seq_gear++;
  if (seq_gear > 6) seq_gear = 0;

  // Brake: Her 10 pakette bir aktif
  seq_brake = (packetCounter % 10 == 0) ? 1 : 0;

  // CLT: 70 -> 110 (artış 1)
  seq_clt += 1.0;
  if (seq_clt > 110.0) seq_clt = 70.0;

  // IAT: 25 -> 45 (artış 1)
  seq_iat += 1.0;
  if (seq_iat > 45.0) seq_iat = 25.0;

  // MAP: 30 -> 100 (artış 5)
  seq_map += 5.0;
  if (seq_map > 100.0) seq_map = 30.0;

  // Battery: 14.2 -> 11.0 (azalış 0.1)
  seq_battery -= 0.1;
  if (seq_battery < 11.0) seq_battery = 14.2;

  // AFR: 12.5 -> 15.5 (artış 0.1)
  seq_afr += 0.1;
  if (seq_afr > 15.5) seq_afr = 12.5;

  // Oil: Her 50 pakette bir fault (0)
  seq_oil = (packetCounter % 50 == 0) ? 0 : 1;
}
