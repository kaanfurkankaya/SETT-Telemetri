# SETT Telemetri - AI Development Log

## 1. Proje Özeti

SETT-SAU Formula Student takımı için içten yanmalı (CV/ICE) araç pit telemetri uygulaması. Araç üzerindeki ESP32 verici kart, CAN Bus ve sensör verilerini E220 LoRa modülü ile pit tarafına gönderir. Pit tarafındaki ESP32 alıcı kart, gelen verileri USB seri port üzerinden bu Electron uygulamasına aktarır.

**Mimari:** Electron (Node.js + HTML/CSS/JS)  
**Hedef:** Test günlerinde ve yarışlarda pit ekibinin araç verilerini gerçek zamanlı izlemesi

## 2. Klasör Kuralı

- `Formula-Student-Telemetry-master/` → **SADECE REFERANS**, asla değiştirilmez
- `SETT Telemetri/` → **TÜM GELİŞTİRME BURADA**, tüm kodlar, config, docs burada

## 3. Mevcut Repo Analizi

### Orijinal Repo: Formula-Student-Telemetry-master
- **Kaynak:** FS TUL Racing (Çek takımı), lisans tezi projesi
- **Pit Uygulaması:** Python 3 + PyQt5 + QML (CanReader/)
- **ESP32 Firmware:** C++ / PlatformIO (HwShieldFormula/, HWShieldClient/)
- **Haberleşme:** WiFi + Serial COM, ham CAN binary frame
- **Loglama:** Basit TXT dump
- **UI:** PyQt5 MainWindow.ui + QML OverviewTab

### Değerlendirme
- Haberleşme/UI/veri işleme katman ayrımı iyi
- Ancak veri formatı (ham CAN binary) bizim JSON-line ihtiyacımızla uyuşmuyor
- WiFi haberleşmesi gereksiz (biz LoRa kullanıyoruz)
- UI eski ve karmaşık bağımlılıklar gerektiriyor
- Uyarı sistemi ve simülasyon modu yok
- CSV loglama yok

## 4. Alınan Teknik Kararlar

- **Karar 001:** Orijinal Python/PyQt5 kodu kopyalanmadı, sıfırdan Electron ile yazıldı. Neden: veri formatı, UI framework, tüm servisler farklı.
- **Karar 002:** JSON-line paket formatı ilk MVP için seçildi. ESP32 tarafı her satırda bir JSON nesnesi gönderecek.
- **Karar 003:** Parser katmanı strategy pattern ile ayrıldı. İleride binary packet desteği eklenebilir.
- **Karar 004:** Simülasyon modu eklendi. Donanım hazır olmadan UI, warning logic ve logging test edilebilir.
- **Karar 005:** CSV logging formatı Excel, Python (pandas) ve MATLAB ile uyumlu tasarlandı.
- **Karar 006:** Node.js `serialport` paketi seçildi (pyserial yerine). Electron main process'te çalışır.
- **Karar 007:** Uyarı eşikleri `src/config/defaults.js` dosyasında merkezi olarak tutulur.
- **Karar 008:** contextBridge + IPC ile güvenli renderer-main iletişimi kuruldu.
- **Karar 009:** Varsayılan baud rate 115200 seçildi (ESP32 + LoRa için standart).
- **Karar 010:** Koyu tema, büyük font boyutları - pit ortamında uzaktan okunabilirlik öncelikli.

## 5. Yapılan Değişiklikler

### Change 001 - Proje altyapısı oluşturuldu
- **Tarih:** 2026-05-15
- **Değişen dosyalar:**
  - `SETT Telemetri/package.json`
  - `SETT Telemetri/main.js`
  - `SETT Telemetri/preload.js`
  - `SETT Telemetri/index.html`
  - `SETT Telemetri/index.css`
  - `SETT Telemetri/renderer.js`
- **Açıklama:** Electron proje yapısı, IPC kanalları, koyu temalı dashboard HTML/CSS oluşturuldu.
- **Not:** Formula-Student-Telemetry-master klasörüne dokunulmadı.

### Change 002 - Servis katmanları oluşturuldu
- **Tarih:** 2026-05-15
- **Değişen dosyalar:**
  - `SETT Telemetri/src/models/telemetry.js`
  - `SETT Telemetri/src/services/serialService.js`
  - `SETT Telemetri/src/services/parserService.js`
  - `SETT Telemetri/src/services/simulationService.js`
  - `SETT Telemetri/src/services/warningService.js`
  - `SETT Telemetri/src/services/loggingService.js`
  - `SETT Telemetri/src/config/defaults.js`
- **Açıklama:** Tüm servis modülleri bağımsız olarak oluşturuldu. Telemetri modeli, seri port, parser, simülasyon, uyarı ve loglama servisleri.
- **Not:** Formula-Student-Telemetry-master klasörüne dokunulmadı.

### Change 003 - Dökümantasyon oluşturuldu
- **Tarih:** 2026-05-15
- **Değişen dosyalar:**
  - `SETT Telemetri/README.md`
  - `SETT Telemetri/AI_DEVELOPMENT_LOG.md`
- **Açıklama:** Kullanıcı/geliştirici README ve AI geliştirme günlüğü oluşturuldu.

### Change 004 - E220 LoRa + ESP32 Firmware Alignment
- **Tarih:** 2026-05-16
- **Eklenen dosyalar:**
  - `SETT Telemetri/firmware/esp32_vehicle_tx/esp32_vehicle_tx.ino`
  - `SETT Telemetri/firmware/esp32_vehicle_tx/README.md`
  - `SETT Telemetri/firmware/esp32_pit_rx/esp32_pit_rx.ino`
  - `SETT Telemetri/firmware/esp32_pit_rx/README.md`
- **Değişen dosyalar:**
  - `SETT Telemetri/README.md`
  - `SETT Telemetri/AI_DEVELOPMENT_LOG.md`
- **Açıklama:** E220 LoRa donanımına uygun ESP32 TX ve RX kodları yazıldı. TX kodu UI testleri için simüle sensör verilerini JSON formatında UART'tan E220 modülüne (115200 baud, 8N1) aktarıyor. RX kodu ise gelen verileri line buffer ile okuyup serial üzerinden PC'ye gönderiyor. Packet RSSI, parsing'i bozduğu için E220 ayarlarından kapalı tutuldu. Parser katmanı "N" vites veya 0/1 fren durumlarını destekliyor.
- **Not:** E220 ayarları için M0=1, M1=1 yapılmalı. Çalışma modu için M0=0, M1=0 yapılmalıdır.

### Change 005 - Sequential Telemetry Test Firmware Added
- **Tarih:** 2026-05-16
- **Eklenen dosyalar:**
  - `SETT Telemetri/firmware/esp32_vehicle_tx_sequence_test/esp32_vehicle_tx_sequence_test.ino`
  - `SETT Telemetri/firmware/esp32_vehicle_tx_sequence_test/README.md`
- **Değişen dosyalar:**
  - `SETT Telemetri/README.md`
  - `SETT Telemetri/AI_DEVELOPMENT_LOG.md`
  - `SETT Telemetri/src/models/telemetry.js`
  - `SETT Telemetri/index.html`
  - `SETT Telemetri/renderer.js`
- **Açıklama:** Rastgele (random) simülasyon verisinin paket kayıplarını ve Parser istikrarını test etmeyi zorlaştırması sebebiyle **sıralı telemetri test firmware'i** eklendi. Test verisi kontrollü olarak artar/azalır, counter her seferinde +1 olur. Uyarı senaryolarını tetiklemek için değerler limitleri aşar ve sıfırlanır. Uygulamanın telemetry modeli güncellenerek CAN Bus alanları (`data_source`, `can_online`, `can_rx_count`, `can_error_count`) JSON'a ve CSV header'larına entegre edildi. UI tarafında Data Source ("SEQ_TEST") ibaresi desteklendi.

### Change 006 - Final E220 Telemetry Firmware Alignment
- **Tarih:** 2026-05-16
- **Değişen dosyalar:**
  - `firmware/esp32_vehicle_tx_sequence_test/esp32_vehicle_tx_sequence_test.ino` (tam yeniden yazım)
  - `firmware/esp32_pit_rx/esp32_pit_rx.ino` (tam yeniden yazım)
  - `src/models/telemetry.js` (compact alias + bitmask flags desteği)
  - `src/services/parserService.js` (dual format: compact + legacy)
  - `renderer.js` (gear "N" string fix, data_source gösterimi)
  - `README.md` (tam yeniden yazım)
  - `AI_DEVELOPMENT_LOG.md`
- **Kararlar:**
  - **USB-TTL ile E220 ayarı:** ESP32 firmware içinde E220 config yazma kodu artık kullanılmıyor. Modüller USB-TTL adaptörü ile dışarıdan ayarlanacak.
  - **Pinleme kesinleştirildi:** M0=GPIO4, M1=GPIO5, AUX=GPIO34 (zorunlu), VCC=5V (3.3V yeterli değil).
  - **AUX zorunlu hale geldi:** Firmware veri göndermeden önce AUX HIGH kontrolü yapıyor. Timeout olursa paket atlanıyor ve `lora_drop_count` artırılıyor. Her 100 pakette istatistik basılıyor.
  - **10 Hz varsayılan:** `SEND_INTERVAL_MS = 100`. `STRESS_TEST_MODE true` ile 20 Hz (50ms) seçilebilir.
  - **Compact JSON:** `{"t":"tlm","c":1,"rpm":2500,"spd":12.4,"bat":13.2,...}` — 200 byte sınırının altında kalır.
  - **Dual format parser:** Electron parser hem compact (`t="tlm"`) hem legacy (`type="telemetry"`) formatını otomatik tanır.
  - **Bitmask flags:** `fl` alanı integer bitmask olarak gönderilir. Electron tarafında `FLAGS_MAP` ile okunabilir uyarı listesine çevrilir. CSV'de hem `flags` (text) hem `flags_bitmask` (sayı) yazılır.
  - **Packet RSSI off:** E220'de Packet RSSI açık olursa son byte'a RSSI ekleniyor ve JSON parser bozuluyor. Kapalı tutuldu.
  - **LBT off:** Listen Before Talk gecikme yaratabileceği için kapalı.
  - **Pit RX debug modu:** `DEBUG_MODE false` varsayılan. true yapılırsa `# ` ile başlayan debug satırları basılır, parser bunları yok sayar.
- **Kalan TODO:**
  - Gerçek CAN Bus entegrasyonu (Vehicle TX'te simülasyon yerine gerçek sensör okuma)
  - Gerçek E220 Packet RSSI desteği (custom byte parser gerekli)
  - Zaman serisi grafikleri
  - Electron .exe paketleme

### Change 007 - Race Simulation Mode Improved
- **Tarih:** 2026-05-16
- **Değişen dosyalar:**
  - `src/services/simulationService.js` (tam yeniden yazım)
  - `README.md`
  - `AI_DEVELOPMENT_LOG.md`
- **Açıklama:** Simülasyon modunun testlerde yetersiz kalması (değerlerin birbirini etkilememesi ve random zıplamalar) nedeniyle **Race Simulation Mode** (Yarış Simülasyon Modu) geliştirildi. Simülasyon artık bir state-machine olarak çalışıyor (IDLE, LAUNCH, ACCELERATION, BRAKING, vb.). Araç davranışları fiziksel bir ilişkiyle bağlandı: TPS artınca ivme artar, ivme hızı artırır, hız ve vites rpm'i belirler, rpm ve tps yükü belirler, yük harareti (CLT) belirler. Uyarı senaryoları test edilebilmesi için aşırı yükte hararet yükselir veya akü voltajı düşer. Data source olarak `SIM_RACE` gönderiliyor. Mod 10 Hz (100ms) interval ile çalışıyor. Kalan TODO'lar aynı (Gerçek CAN entegrasyonu, grafikler, ayarlar paneli, paketleme).

### Change 008 - Açık Tema Tasarımı, Logolar ve Stres Testi Profilinin Eklenmesi
- **Tarih:** 2026-05-23
- **Değişen dosyalar:**
  - `index.css`: Koyu temadan #ff9500 (turuncu) ve #ffffff (beyaz/açık gri) tabanlı açık temaya geçildi. CSS değişkenleri ile Açık/Koyu tema (`body.dark-mode`) desteği eklendi. Üniversite logosu eklendi ve boyutu 110px'e çıkarıldı.
  - `index.html`: Sağ altta üniversite logosu (`saülogo.png`) ve SETT logosu yan yana konuldu. Üst barda tema değiştirme butonu ve sol panele "Simülasyon Profili" seçici (dropdown) eklendi. Nunito fontu projeye entegre edildi.
  - `renderer.js`: `localStorage` kullanan tema değiştirme (karanlık/aydınlık) mantığı eklendi. Simülasyon durduğunda (`offline` veya `error` state) ekrandaki verileri sıfırlayan (0 veya -- yapan) `resetDashboard()` fonksiyonu yazıldı. Simülasyon profili seçimi backend'e bağlandı.
  - `preload.js`: `simulation.start(profile)` parametrik hale getirildi.
  - `main.js`: `simulation:start` kanalından gelen profil bilgisi `simulationService`'e aktarıldı.
  - `src/services/simulationService.js`: Sınıfa `profile` desteği eklendi. Tüm veri aralıklarını minimumdan maksimuma bir sinüs dalgası (`Math.sin`) ile sweep eden ve uyarı mekanizmalarının tamamını tetikleyen yeni `_updateStressLogic()` stres testi eklendi.

### Change 009 - Canlı Grafikler ve CSV Replay Altyapısı
- **Tarih:** 2026-05-23
- **Değişen dosyalar:**
  - `index.html`: Dashboard'a "Canlı Grafikler" bölümü eklendi. RPM, hız, CLT, akü, RSSI ve paket kaybı için son 60 saniyeyi gösteren canvas tabanlı mini grafikler yerleştirildi. Sol panele CSV replay seçimi, replay hızı ve başlat/durdur kontrolleri eklendi.
  - `index.css`: Grafik grid'i, chart kartları, replay paneli ve `replay` bağlantı durumu görsel stilleri eklendi.
  - `renderer.js`: Telemetri paketleri için 60 saniyelik geçmiş buffer'ı, canvas çizim fonksiyonları, dashboard reset'inde grafik temizleme ve CSV replay UI akışı eklendi.
  - `preload.js`: `sett.replay` IPC köprüsü eklendi.
  - `main.js`: `ReplayService` bağlandı. CSV seçme, replay başlatma/durdurma/durum IPC kanalları eklendi. Veri zaman aşımı uyarısı sadece aktif seri bağlantı, simülasyon veya replay varken çalışacak şekilde düzeltildi.
  - `src/services/replayService.js`: CSV log dosyasını okuyup satırları mevcut JSON-line telemetri hattına yeniden veren servis eklendi. Replay hızları 0.5x, 1x, 2x ve 5x üzerinden UI'dan seçiliyor.
  - `src/services/simulationService.js`: Simülasyon başlangıcında state sıfırlama eklendi ve stres profilinde veri kaynağı `SIM_STRESS` olarak ayrıldı.
- **Not:** CSV replay özelliği ileride yarış videosu üzerine telemetri bindirme (video overlay) için veri kaynağı olarak kullanılabilir.

### Change 010 - Alt Dashboard Alanı ve 320 km/h Yarış Simülasyonu
- **Tarih:** 2026-05-23
- **Değişen dosyalar:**
  - `index.html`: Ham veri monitörü satırına "Oturum Özeti" paneli eklendi. Kaynak, paket, max hız, max RPM, max CLT ve min akü değerleri gösteriliyor.
  - `index.css`: Ham veri monitörü daha dengeli genişlikte tutuldu, özet paneli için kompakt kart stili eklendi.
  - `renderer.js`: Oturum istatistikleri canlı telemetriyle güncellenecek ve bağlantı resetinde sıfırlanacak şekilde eklendi. Hız grafiği 320 km/h ölçeğine çıkarıldı.
  - `src/services/simulationService.js`: Yarış simülasyonundaki vites oranları 6. viteste yaklaşık 320 km/h tepe hıza göre yeniden ayarlandı. Hız-devir ilişkisi `speed / gearMaxSpeed * REDLINE_RPM` mantığına bağlandı. Simülasyon paketine `rssi` alanı da eklendi.
- **Test:** 120 saniyelik hızlı simülasyon smoke testinde max hız yaklaşık 319.5 km/h, max RPM yaklaşık 12,499 ve max vites 6 görüldü.

### Change 011 - Uyarı Görünümü, Eşik Ayarları ve README Görsel Güncellemesi
- **Tarih:** 2026-05-24
- **Değişen dosyalar:**
  - `index.html`: Üst bara ayarlar butonu ve uyarı eşiklerini düzenleyen modal eklendi. README görseli `YeniFoto.png` ile güncellendi.
  - `index.css`: Uyarı kartları daha okunur, kompakt ve scrollsuz olacak şekilde yeniden düzenlendi. Ayarlar modalı için stiller eklendi.
  - `renderer.js`: Uyarı eşik ayarları formu, doğrulama, kaydetme/varsayılan akışı ve dashboard kartlarının dinamik eşiklere göre renklendirilmesi eklendi.
  - `main.js`, `preload.js`: Uyarı eşiklerini okuma, kaydetme ve sıfırlama IPC uçları eklendi.
  - `src/services/warningService.js`: Uyarı servisi varsayılan eşikleri kopyalayıp runtime ayarlarıyla güncelleyebilir hale getirildi. Paket kaybı eşikleri de aktif uyarı değerlendirmesine bağlandı.

### Change 012 - Link Health ve Windows Paketleme
- **Tarih:** 2026-05-24
- **Değişen dosyalar:**
  - `index.html`: Durum kartları satırına `LINK HEALTH` kartı eklendi.
  - `index.css`: Link health kartı için kompakt metrik grid'i ve durum renkleri eklendi.
  - `renderer.js`: RSSI, paket kaybı, paket hızı ve son veri yaşını izleyen bağlantı sağlığı hesabı eklendi. Veri gecikmesi/kesilmesi ayarlar panelindeki `noData` eşiklerini kullanıyor.
  - `package.json`, `package-lock.json`: `electron-builder` eklendi. `npm run pack` ve `npm run dist` komutları tanımlandı.
  - `.gitignore`: `dist/` çıktı klasörü ignore edildi.


## 6. Dosya Haritası

| Dosya | Görev |
|-------|-------|
| `main.js` | Electron ana süreç, IPC yönetimi, servis orkestrasyonu |
| `preload.js` | Güvenli IPC köprüsü (contextBridge) |
| `index.html` | Dashboard HTML yapısı |
| `index.css` | Koyu tema, kart bazlı layout, uyarı animasyonları |
| `renderer.js` | UI güncellemeleri ve kullanıcı etkileşimleri |
| `src/models/telemetry.js` | TelemetryPacket veri modeli |
| `src/services/serialService.js` | COM port haberleşme (Node.js serialport) |
| `src/services/parserService.js` | JSON-line parser (strategy pattern) |
| `src/services/simulationService.js` | Sahte telemetri üretimi (test modu) |
| `src/services/replayService.js` | CSV log dosyalarını tekrar oynatma |
| `src/services/warningService.js` | Eşik tabanlı uyarı/hata mantığı |
| `src/services/loggingService.js` | CSV dosya loglama |
| `src/config/defaults.js` | Tüm eşikler, ayarlar, varsayılan değerler |
| `firmware/esp32_vehicle_tx/` | Araç verici ESP32 kodları (Random veri üretir ve E220'ye atar) |
| `firmware/esp32_vehicle_tx_sequence_test/`| Araç verici ESP32 kodları (Kontrollü/Sıralı test verisi üretir) |
| `firmware/esp32_pit_rx/` | Pit alıcı ESP32 kodları (E220'den okur ve USB Serial ile PC'ye atar) |

## 7. Veri Formatı

### JSON-Line Telemetri Paketi
```json
{
  "type": "telemetry",
  "counter": 1521,
  "time_ms": 834220,
  "rpm": 6500,
  "speed": 72.4,
  "tps": 38.2,
  "clt": 86.5,
  "iat": 34.1,
  "map": 78.3,
  "battery": 13.7,
  "gear": 3,
  "brake": 0,
  "oil_ok": true,
  "afr": 13.2,
  "rssi": -84,
  "flags": ["OK"]
}
```

**Alanlar:**
- `type`: Paket tipi (şimdilik sadece "telemetry")
- `counter`: Monoton artan paket sayacı (kayıp tespiti için)
- `time_ms`: Araç tarafı ms cinsinden zaman
- `rpm`-`afr`: Motor/araç sensör verileri
- `rssi`: LoRa alıcı sinyal gücü
- `flags`: Durum bayrakları dizisi

## 8. Çalıştırma Notları

```bash
# Kurulum (ilk seferlik)
cd "SETT Telemetri"
npm install

# Uygulamayı başlat
npm start
```

## 9. Test Notları

- [ ] `npm install` başarılı mı?
- [ ] `npm start` ile uygulama açılıyor mu?
- [ ] Simülasyon modu çalışıyor mu?
- [ ] Dashboard değerleri güncelleniyor mu?
- [ ] COM port listesi geliyor mu?
- [ ] CSV log dosyası oluşuyor mu?
- [ ] Uyarılar doğru tetikleniyor mu?
- [ ] Ham veri monitörü çalışıyor mu?

## 10. Bilinen Eksikler ve TODO

1. [ ] `npm install` ve ilk çalıştırma testi yapılacak
2. [x] Grafik görünümleri (zaman serisi grafikleri)
3. [x] Ayarlar paneli (UI üzerinden eşik düzenleme)
4. [x] Veri replay modu (CSV'den playback)
5. [ ] Electron packaging (EXE oluşturma)
6. [ ] Otomatik yeniden bağlanma mekanizması
7. [ ] Binary packet parser desteği
8. [ ] Birden fazla ESP32 alıcı desteği

## 11. Sonraki AI veya Geliştirici İçin Notlar

1. **Klasör kuralı kesindir:** `Formula-Student-Telemetry-master/` klasörüne asla dokunmayın.
2. **Servisler bağımsızdır:** Her servis tek sorumluluk prensibine göre tasarlanmıştır.
3. **Eşik değerlerini `defaults.js`'den değiştirin**, kodun içine hard-coded yazmayın.
4. **Parser genişletilebilir:** `createParser('binary')` ile yeni parser tipi eklenebilir.
5. **CSV formatı değişirse** `TelemetryPacket.getCsvHeaders()` ve `toFlatObject()` güncelleyin.
6. **Electron güvenlik modeli:** `nodeIntegration: false`, `contextIsolation: true`. Tüm Node.js işlemleri main process'te yapılır.
7. **Simülasyon modu gerçek veri akışını taklit eder:** JSON-line string üretir, parser'dan geçer.
