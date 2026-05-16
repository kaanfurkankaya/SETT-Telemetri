/**
 * SETT Telemetri - Simülasyon Servisi
 * Race Simulation Mode
 * 
 * Gerçek bir Formula Student CV aracının pist üstündeki davranışını
 * taklit eden state-machine tabanlı simülatör.
 */
const DEFAULTS = require('../config/defaults');

const PHASES = {
  IDLE: 'IDLE',
  LAUNCH: 'LAUNCH',
  LONG_STRAIGHT: 'LONG_STRAIGHT',
  HARD_BRAKE_1: 'HARD_BRAKE_1',
  SLOW_CORNER: 'SLOW_CORNER',
  SHORT_STRAIGHT: 'SHORT_STRAIGHT',
  HARD_BRAKE_2: 'HARD_BRAKE_2',
  COOLDOWN: 'COOLDOWN'
};

const GEAR_MAX_SPEEDS = {
  1: 40,
  2: 60,
  3: 80,
  4: 100,
  5: 110,
  6: 125
};

class SimulationService {
  constructor() {
    this.running = false;
    this.timer = null;
    this.counter = 0;
    this.startTime = 0;
    this.onData = null;
    
    // Aracın anlık durumu
    this.state = {
      rpm: 0,
      speed: 0,
      tps: 0,
      clt: 75,
      iat: 30,
      map: 40,
      battery: 13.8,
      gear: 0, // 0 = N
      brake: 0,
      oil_ok: true,
      afr: 14.5,
      rssi: -70,
      fl: 0 // bitmask flag
    };
    
    this.phase = PHASES.IDLE;
    this.phaseTime = 0;
    this.phaseDuration = 4000;
  }

  start(onData) {
    if (this.running) return;
    this.running = true;
    this.onData = onData;
    this.startTime = Date.now();
    this.counter = 0;
    // Varsayılan simülasyon interval'ı (10 Hz = 100ms)
    const interval = DEFAULTS.simulation?.intervalMs || 100;
    this.timer = setInterval(() => this._tick(), interval);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onData = null;
  }

  isRunning() {
    return this.running;
  }

  _tick() {
    this.counter++;
    const interval = DEFAULTS.simulation?.intervalMs || 100;
    this.phaseTime += interval;
    
    this._checkPhaseTransitions();
    
    this._updatePhaseLogic();
    this._updateVehicleDynamics();
    this._updateTemperaturesAndElectrical();
    this._updateWarnings();
    
    // Compact JSON paketi oluştur (Firmware compact yapısıyla aynı)
    const packet = {
      t: 'tlm',
      c: this.counter,
      ms: Date.now() - this.startTime,
      rpm: Math.round(this.state.rpm),
      spd: +this.state.speed.toFixed(1),
      tps: +this.state.tps.toFixed(1),
      clt: +this.state.clt.toFixed(1),
      iat: +this.state.iat.toFixed(1),
      map: +this.state.map.toFixed(1),
      bat: +this.state.battery.toFixed(2),
      g: this.state.gear,
      brk: this.state.brake,
      oil: this.state.oil_ok ? 1 : 0,
      afr: +this.state.afr.toFixed(1),
      src: 'SIM_RACE',
      fl: this.state.fl
    };
    
    if (this.onData) {
      this.onData(JSON.stringify(packet));
    }
  }

  _checkPhaseTransitions() {
    const s = this.state;
    // Güvenlik için maksimum süre aşımı
    const timeExceeded = this.phaseTime >= this.phaseDuration;

    switch(this.phase) {
      case PHASES.IDLE:
        if (timeExceeded) this._setPhase(PHASES.LAUNCH);
        break;
      case PHASES.LAUNCH:
        if (s.speed > 25 || timeExceeded) this._setPhase(PHASES.LONG_STRAIGHT);
        break;
      case PHASES.LONG_STRAIGHT:
        // 5. vitese ulaştığında ve hız 100'ü geçtiğinde sert fren (veya süre dolunca)
        if ((s.gear >= 5 && s.speed > 105) || timeExceeded) this._setPhase(PHASES.HARD_BRAKE_1);
        break;
      case PHASES.HARD_BRAKE_1:
        // Vites 1'e düştüğünde ve hız 40'ın altındaysa viraja gir
        if ((s.gear <= 1 && s.speed < 45) || timeExceeded) this._setPhase(PHASES.SLOW_CORNER);
        break;
      case PHASES.SLOW_CORNER:
        if (timeExceeded) this._setPhase(PHASES.SHORT_STRAIGHT);
        break;
      case PHASES.SHORT_STRAIGHT:
        // 3. vitese gelip 75'i geçtiğinde tekrar fren
        if ((s.gear >= 3 && s.speed > 75) || timeExceeded) this._setPhase(PHASES.HARD_BRAKE_2);
        break;
      case PHASES.HARD_BRAKE_2:
        if ((s.gear <= 1 && s.speed < 45) || timeExceeded) this._setPhase(PHASES.COOLDOWN);
        break;
      case PHASES.COOLDOWN:
        if (timeExceeded) this._setPhase(PHASES.IDLE);
        break;
    }
  }

  _setPhase(newPhase) {
    this.phase = newPhase;
    this.phaseTime = 0;
    // Maksimum süreler (fallback / hedef)
    switch(newPhase) {
      case PHASES.IDLE: this.phaseDuration = 2000 + Math.random() * 1000; break;
      case PHASES.LAUNCH: this.phaseDuration = 3000; break;
      case PHASES.LONG_STRAIGHT: this.phaseDuration = 12000; break; 
      case PHASES.HARD_BRAKE_1: this.phaseDuration = 5000; break;
      case PHASES.SLOW_CORNER: this.phaseDuration = 4000 + Math.random() * 2000; break;
      case PHASES.SHORT_STRAIGHT: this.phaseDuration = 7000; break;
      case PHASES.HARD_BRAKE_2: this.phaseDuration = 4000; break;
      case PHASES.COOLDOWN: this.phaseDuration = 6000 + Math.random() * 2000; break;
    }
  }

  _updatePhaseLogic() {
    const s = this.state;
    const n = this._noise.bind(this);
    const approach = this._approach.bind(this);
    
    switch(this.phase) {
      case PHASES.IDLE:
        s.tps = approach(s.tps, 0, 10);
        s.brake = 1; // Dururken frene basılı
        s.gear = 0; // N
        break;
        
      case PHASES.LAUNCH:
        s.tps = approach(s.tps, 100, 20); // Tam gaz kalkış
        s.brake = 0;
        if (s.gear === 0) s.gear = 1;
        break;
        
      case PHASES.LONG_STRAIGHT:
      case PHASES.SHORT_STRAIGHT:
        s.tps = approach(s.tps, 100, 15); // Tam gaz hızlan
        s.brake = 0;
        break;
        
      case PHASES.HARD_BRAKE_1:
      case PHASES.HARD_BRAKE_2:
        s.tps = approach(s.tps, 0, 30); // Gazı anında kes
        s.brake = 1; // Sert fren
        break;
        
      case PHASES.SLOW_CORNER:
        s.tps = approach(s.tps, 40 + n(10), 10); // Viraj içi yarım gaz
        s.brake = (s.speed > 45) ? 1 : 0; // Çok hızlanırsa hafif fren
        break;
        
      case PHASES.COOLDOWN:
        s.tps = approach(s.tps, 15 + n(5), 5);
        s.brake = (s.speed > 30) ? 1 : 0; // Yavaşlamaya çalış
        break;
    }
  }

  _updateVehicleDynamics() {
    const s = this.state;
    
    // TPS'e göre ivme ve hız hesapla
    let accel = 0;
    if (s.tps > 0) {
      accel = (s.tps / 100) * 0.8; 
      // Vites yükseldikçe ivme düşer
      if (s.gear > 0) accel /= (1 + (s.gear * 0.2));
    }
    
    // Frenleme (Sert fren yaparsa ivme çok daha fazla düşer)
    if (s.brake === 1) {
      accel = -3.5 - (s.speed * 0.04); // Yüksek hızda sert fren
    }
    
    // Sürtünme ve hava direnci
    accel -= (0.05 + (s.speed * s.speed * 0.0001));
    
    // Hız güncelle
    s.speed += accel;
    if (s.speed < 0) s.speed = 0;
    
    // Vites ve RPM ilişkisi
    if (s.gear === 0) {
      // Boşta devir çevirme (Hız 0 iken gaz verilirse devir artar)
      let targetRpm = s.tps * 105; // 100 tps = 10500 rpm
      s.rpm = this._approach(s.rpm, targetRpm, 500);
      s.speed = this._approach(s.speed, 0, 1);
    } else {
      // Viteste
      let maxSpeedForGear = GEAR_MAX_SPEEDS[s.gear] || 125;
      
      // Hız - devir ilişkisi: speed = (rpm / 10000) * maxSpeedForGear
      // Buradan rpm hesapla: rpm = (speed / maxSpeedForGear) * 10000
      let baseRpm = (s.speed / maxSpeedForGear) * 10500;
      
      // Kullanıcının talebi: Alt limit olmasın, hız 0 ise rpm 0 olsun
      if (s.speed < 1) baseRpm = 0;
      
      s.rpm = this._approach(s.rpm, baseRpm, 500) + (baseRpm > 0 ? this._noise(20) : 0);
      
      // Vites atma mantığı (Up shift)
      if (s.rpm > 9500 && s.gear < 6 && s.tps > 50) {
        s.gear++;
        s.rpm *= 0.7; // %30 devir düşüşü
      }
      
      // Vites küçültme (Down shift) - Sert frenlemede çok agresif vites düşür
      if (s.brake === 1) {
        if (s.rpm < 6500 && s.gear > 1 && s.speed > 5) {
          s.gear--;
          s.rpm *= 1.4; // Devir yükselir (Engine braking)
        }
      } else {
        // Normal yavaşlama
        if (s.rpm < 4000 && s.gear > 1 && s.speed > 5) {
          s.gear--;
          s.rpm *= 1.3;
        }
      }
      
      // Çok yavaşlarsa boşa veya 1'e al
      if (s.speed < 5 && s.brake === 1) {
        s.gear = (this.phase === PHASES.IDLE) ? 0 : 1;
      }
    }
    
    // MAP
    let targetMap = 35; // idle map
    if (s.tps > 0) targetMap = 35 + (s.tps * 0.65);
    s.map = this._approach(s.map, targetMap, 5) + this._noise(2);
    
    // AFR
    if (s.tps > 80) s.afr = this._approach(s.afr, 12.8, 0.2) + this._noise(0.1);
    else if (s.tps === 0 && s.rpm > 2000) s.afr = this._approach(s.afr, 16.0, 0.5); // cut-off
    else s.afr = this._approach(s.afr, 14.7, 0.1) + this._noise(0.2); // cruise
  }

  _updateTemperaturesAndElectrical() {
    const s = this.state;
    const load = (s.rpm * s.tps) / 1000000; // 0.0 ile ~1.0 arası yük çarpanı
    
    // CLT (Soğutma Suyu)
    if (load > 0.4) {
      s.clt += (load * 0.05); // Isınma
    } else {
      s.clt -= 0.02; // Soğuma
      // Rölantide yavaş ısınır
      if (s.speed === 0 && s.clt < 85) s.clt += 0.01; 
    }
    
    // IAT
    if (s.speed > 50) s.iat = this._approach(s.iat, 30, 0.1); // Rüzgarla soğuma
    else if (load > 0.6) s.iat += 0.05; // Isınma
    
    // Battery
    let targetBatt = 13.8;
    if (s.rpm > 3000) targetBatt = 14.2;
    if (s.clt > 95) targetBatt -= 0.4; // Fan açıldı
    s.battery = this._approach(s.battery, targetBatt, 0.02) + this._noise(0.05);
    
    // RSSI (Yavaş değişim)
    s.rssi = this._approach(s.rssi, -75 + (Math.sin(this.counter * 0.01) * 15), 1) + this._noise(2);
  }

  _updateWarnings() {
    const s = this.state;
    s.fl = 0; // FLAG_OK
    s.oil_ok = true;

    // Özel test senaryoları (Nadiren tetiklenir)
    // 1. Çok zorlanınca yüksek hararet (clt > 100)
    if (s.clt >= 100) {
      s.fl |= 0x02; // FLAG_HIGH_CLT
    }
    
    // 2. Akü düşüşü testi
    if (this.counter % 2000 > 1800) { 
      s.battery = this._approach(s.battery, 11.2, 0.1);
      if (s.battery <= 11.5) s.fl |= 0x04; // FLAG_LOW_BATTERY
    }
    
    // 3. Yağ basıncı kaybı (Kısa süreli, sadece devir varken)
    if (this.counter % 1500 > 1480 && s.rpm > 3000) {
      s.oil_ok = false;
      s.fl |= 0x08; // FLAG_OIL_FAULT
    }
    
    // 4. RSSI zayıflaması
    if (s.rssi < -95) {
      s.fl |= 0x10; // FLAG_WEAK_RSSI
    }

    // Değerleri limitlerde tut (Clamp)
    s.tps = Math.max(0, Math.min(100, s.tps));
    s.rpm = Math.max(0, Math.min(13000, s.rpm));
    s.clt = Math.max(20, Math.min(115, s.clt));
    s.iat = Math.max(10, Math.min(70, s.iat));
    s.map = Math.max(10, Math.min(110, s.map));
    s.afr = Math.max(10, Math.min(20, s.afr));
    s.speed = Math.max(0, Math.min(140, s.speed));
    s.battery = Math.max(9, Math.min(15, s.battery));
  }

  // Yardımcı matematik fonksiyonları
  _approach(cur, target, rate) {
    if (cur < target) return Math.min(cur + rate, target);
    if (cur > target) return Math.max(cur - rate, target);
    return cur;
  }

  _noise(range) {
    return (Math.random() - 0.5) * range;
  }
}

module.exports = SimulationService;
