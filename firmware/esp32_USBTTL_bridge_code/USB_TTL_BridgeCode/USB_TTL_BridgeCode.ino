#include <Arduino.h>

#define LORA_RX_PIN 16   // ESP32 RX <- E220 TXD
#define LORA_TX_PIN 17   // ESP32 TX -> E220 RXD

// E220 fabrika ayarı büyük ihtimalle 9600.
// Eğer çalışmazsa bunu 115200 yapıp iki ESP32'ye de yeniden yükle.
#define LORA_BAUD 9600

HardwareSerial LoRaSerial(1);

uint32_t counter = 0;
uint32_t lastSendMs = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  LoRaSerial.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

  Serial.println();
  Serial.println("=== SETT VEHICLE TX TEST ===");
  Serial.print("USB Serial: 115200 | E220 UART: ");
  Serial.println(LORA_BAUD);
  Serial.println("Sending short JSON every 1 second...");
}

void loop() {
  if (millis() - lastSendMs >= 1000) {
    lastSendMs = millis();
    counter++;

    char packet[96];
    snprintf(
      packet,
      sizeof(packet),
      "{\"type\":\"telemetry\",\"counter\":%lu,\"rpm\":%lu}",
      counter,
      1000 + counter * 100
    );

    // E220'ye gönder
    LoRaSerial.println(packet);

    // PC Serial Monitor'a debug bas
    Serial.print("TX -> ");
    Serial.println(packet);
  }
}