/*
 * SETT Telemetri - ESP32 Pit RX (Alıcı - Final)
 * 
 * E220 LoRa modülünden gelen JSON-line paketleri alır,
 * USB Serial üzerinden SETT Telemetri Electron uygulamasına aktarır.
 * E220 ayarları USB-TTL ile dışarıdan yapılır.
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

// Debug modu: true ise "# " ile başlayan debug satırları basılır.
// Parser bunları yok sayar ama production'da kapalı tutulmalıdır.
#define DEBUG_MODE     false

#define BUFFER_SIZE    512

// ===================== GLOBAL DEĞİŞKENLER =====================
HardwareSerial LoRaSerial(1);

char lineBuffer[BUFFER_SIZE];
int bufferIndex = 0;

// İstatistikler (debug modu için)
unsigned long lineCount      = 0;
unsigned long rawByteCount   = 0;
unsigned long overflowCount  = 0;
unsigned long lastReceiveMs  = 0;

// ===================== SETUP =====================
void setup() {
  Serial.begin(USB_BAUD);
  delay(500);

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
  #if DEBUG_MODE
    Serial.print("# AUX bekleniyor...");
  #endif

  unsigned long auxStart = millis();
  while (digitalRead(LORA_AUX_PIN) == LOW) {
    if (millis() - auxStart > 3000) {
      #if DEBUG_MODE
        Serial.println(" TIMEOUT (3s)!");
      #endif
      break;
    }
    delay(10);
  }

  #if DEBUG_MODE
    if (digitalRead(LORA_AUX_PIN) == HIGH) Serial.println(" OK");
    Serial.println("# --- SETT Pit RX Hazir ---");
  #endif
}

// ===================== LOOP =====================
void loop() {
  while (LoRaSerial.available() > 0) {
    char c = LoRaSerial.read();
    rawByteCount++;

    if (c == '\n') {
      // Satır sonu: buffer'ı sonlandır ve PC'ye gönder
      lineBuffer[bufferIndex] = '\0';

      if (bufferIndex > 0) {
        Serial.println(lineBuffer);
        lineCount++;
        lastReceiveMs = millis();
      }

      bufferIndex = 0;
    } else if (c != '\r') {
      // CR yoksay, diğer karakterleri buffer'a ekle
      if (bufferIndex < BUFFER_SIZE - 1) {
        lineBuffer[bufferIndex++] = c;
      } else {
        // Buffer overflow: güvenli sıfırlama
        overflowCount++;
        bufferIndex = 0;
        #if DEBUG_MODE
          Serial.printf("# BUFFER_OVERFLOW count=%lu\n", overflowCount);
        #endif
      }
    }
  }

  // Debug istatistik (her 10 saniyede bir)
  #if DEBUG_MODE
    static unsigned long lastStatMs = 0;
    if (millis() - lastStatMs > 10000) {
      lastStatMs = millis();
      Serial.printf("# RX_STATS lines=%lu bytes=%lu overflow=%lu last_rx=%lums_ago\n",
        lineCount, rawByteCount, overflowCount,
        lastReceiveMs > 0 ? (millis() - lastReceiveMs) : 0);
    }
  #endif
}
