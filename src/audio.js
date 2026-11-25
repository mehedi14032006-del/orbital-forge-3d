// Procedural Web Audio Synthesizer — Zero External File Latency
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freqStart, freqEnd, duration, type = 'sine', gainPeak = 0.12) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  _noise(duration, gainPeak = 0.16, filterFreq = 800) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sampleCount = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
  }

  playClick() {
    this._tone(640, 920, 0.055, 'triangle', 0.07);
  }

  playBuild() {
    this._tone(210, 420, 0.12, 'sawtooth', 0.08);
    setTimeout(() => this._tone(520, 780, 0.11, 'triangle', 0.08), 55);
  }

  playScrap() {
    this._tone(340, 120, 0.14, 'sawtooth', 0.08);
  }

  playError() {
    this._tone(180, 110, 0.16, 'square', 0.07);
  }

  playLaser() {
    this._tone(1280, 260, 0.09, 'sawtooth', 0.045);
  }

  playMortar() {
    this._tone(240, 62, 0.22, 'triangle', 0.12);
    this._noise(0.18, 0.09, 600);
  }

  playExplosion() {
    this._noise(0.35, 0.18, 950);
    this._tone(110, 32, 0.28, 'sine', 0.14);
  }

  playWaveAlarm() {
    this._tone(420, 560, 0.22, 'sawtooth', 0.07);
    setTimeout(() => this._tone(560, 420, 0.25, 'sawtooth', 0.07), 230);
  }

  playRocketLaunch() {
    this._noise(1.8, 0.22, 1400);
    this._tone(90, 220, 1.5, 'sawtooth', 0.09);
  }
}
