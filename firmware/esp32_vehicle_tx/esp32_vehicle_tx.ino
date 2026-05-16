/*
 * SETT Telemetri - ESP32 Vehicle TX (Verici)
 * 
 * Amaç: Araç sensörlerinden (veya CAN bus üzerinden) gelen verileri okuyup,
 * E220 LoRa modülü üzerinden Pit tarafına iletmek.
 * 
 * Not: Bu kod ilk MVP aşaması için gerçek sensörler yerine simüle edilmiş
 * (fakat gerçekçi şekilde değişen) veriler üretir.
 */

#include <Arduino.h>

// E220 LoRa Bağlantı Pinleri
#define LORA_RX_PIN 16
#define LORA_TX_PIN 17
#define LORA_M0_PIN 4
#define LORA_M1_PIN 5
#define LORA_AUX_PIN 34

HardwareSerial LoRaSerial(1); // UART1

unsigned long lastSendTime = 0;
const int SEND_INTERVAL_MS = 200; // 5 Hz

unsigned long packetCounter = 0;

// Simülasyon Değişkenleri
int sim_rpm = 1200;
float sim_speed = 0.0;
float sim_tps = 0.0;
float sim_clt = 75.0;
float sim_iat = 25.0;
float sim_map = 30.0;
float sim_battery = 13.8;
int sim_gear = 0;
int sim_brake = 0;
bool sim_oil_ok = true;
float sim_afr = 14.7;
int sim_rssi = -65;

bool increasing_rpm = true;
bool increasing_speed = true;
bool increasing_clt = true;

void setup() {
  // Debug Serial
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- SETT Telemetri Vehicle TX Baslatildi ---");

  // E220 Pin Ayarları
  pinMode(LORA_M0_PIN, OUTPUT);
  pinMode(LORA_M1_PIN, OUTPUT);
  pinMode(LORA_AUX_PIN, INPUT);

  // Normal çalışma modu (M0=0, M1=0)
  digitalWrite(LORA_M0_PIN, LOW);
  digitalWrite(LORA_M1_PIN, LOW);

  // E220 Serial Başlatma (RX:16, TX:17)
  // Dikkat: ESP32 TX(17) -> E220 RXD, ESP32 RX(16) -> E220 TXD
  LoRaSerial.begin(115200, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
  Serial.println("LoRa UART (HardwareSerial) 115200 baud ile baslatildi.");
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    packetCounter++;

    // 1. Simülasyon Değerlerini Güncelle
    updateSimulation();

    // 2. JSON-Line Paketini Oluştur
    // snprintf için yeterince büyük bir buffer (max 256 byte)
    char jsonBuffer[256];
    
    // JSON yapısı
    const char* oilStr = sim_oil_ok ? "true" : "false";

    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{\"type\":\"telemetry\",\"counter\":%lu,\"time_ms\":%lu,\"rpm\":%d,\"speed\":%.1f,\"tps\":%.1f,\"clt\":%.1f,\"iat\":%.1f,\"map\":%.1f,\"battery\":%.1f,\"gear\":%d,\"brake\":%d,\"oil_ok\":%s,\"afr\":%.1f,\"rssi\":%d,\"flags\":[\"OK\"]}\n",
      packetCounter, currentMillis, sim_rpm, sim_speed, sim_tps, sim_clt, sim_iat, sim_map, sim_battery, sim_gear, sim_brake, oilStr, sim_afr, sim_rssi
    );

    // 3. E220 Modülünün Hazır Olmasını Bekle (AUX Pin)
    // AUX pin LOW ise modül meşguldür, HIGH ise hazırdır.
    int auxTimeout = 100; // max 100ms bekle
    while (digitalRead(LORA_AUX_PIN) == LOW && auxTimeout > 0) {
      delay(1);
      auxTimeout--;
    }

    // 4. Paketi Gönder
    LoRaSerial.print(jsonBuffer);

    // Debug için bilgisayara da yazdır
    Serial.print(jsonBuffer);
  }
}

void updateSimulation() {
  // RPM
  if (increasing_rpm) {
    sim_rpm += random(50, 200);
    if (sim_rpm >= 9500) increasing_rpm = false;
  } else {
    sim_rpm -= random(50, 150);
    if (sim_rpm <= 1200) increasing_rpm = true;
  }

  // Speed
  if (increasing_speed) {
    sim_speed += random(1, 5) * 0.1;
    if (sim_speed >= 120.0) increasing_speed = false;
  } else {
    sim_speed -= random(1, 5) * 0.1;
    if (sim_speed <= 0.0) {
      sim_speed = 0.0;
      increasing_speed = true;
    }
  }

  // TPS
  sim_tps = (sim_rpm / 9500.0) * 100.0;
  if (sim_tps > 100.0) sim_tps = 100.0;

  // CLT
  if (increasing_clt) {
    sim_clt += 0.05;
    if (sim_clt >= 105.0) increasing_clt = false;
  } else {
    sim_clt -= 0.05;
    if (sim_clt <= 75.0) increasing_clt = true;
  }

  // Diğerleri
  sim_iat = 25.0 + random(0, 5);
  sim_map = 30.0 + (sim_tps * 0.7);
  sim_battery = 13.8 + (random(-2, 3) * 0.1);
  
  // Gear
  if (sim_speed == 0.0) sim_gear = 0; // 0 = N
  else if (sim_speed < 20.0) sim_gear = 1;
  else if (sim_speed < 40.0) sim_gear = 2;
  else if (sim_speed < 60.0) sim_gear = 3;
  else if (sim_speed < 80.0) sim_gear = 4;
  else if (sim_speed < 100.0) sim_gear = 5;
  else sim_gear = 6;

  // Brake
  if (!increasing_speed && sim_speed > 0) sim_brake = 1;
  else sim_brake = 0;

  // AFR
  sim_afr = 14.7 + (random(-5, 5) * 0.1);

  // RSSI
  sim_rssi = -65 - random(0, 30);
}
