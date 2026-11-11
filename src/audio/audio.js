// Audio procedural con Web Audio API: música original generada por
// secuenciador (sin archivos externos) y efectos de sonido sintetizados.
// Si el navegador no soporta audio, todas las llamadas son no-op.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Pistas: tempo, progresión de acordes (raíces MIDI), escala de la melodía y estilo.
const TRACKS = {
  title:    { bpm: 132, chords: [57, 53, 48, 55], scale: [0, 2, 4, 7, 9, 12], lead: 'square', energy: 0.9 },
  town:     { bpm: 112, chords: [60, 57, 53, 55], scale: [0, 2, 4, 7, 9], lead: 'triangle', energy: 0.5 },
  field:    { bpm: 120, chords: [55, 52, 48, 50], scale: [0, 2, 4, 7, 9], lead: 'triangle', energy: 0.6 },
  forest:   { bpm: 96,  chords: [57, 53, 55, 52], scale: [0, 3, 5, 7, 10], lead: 'sine', energy: 0.4 },
  mountain: { bpm: 104, chords: [50, 46, 48, 45], scale: [0, 2, 3, 7, 8], lead: 'triangle', energy: 0.5 },
  city:     { bpm: 126, chords: [53, 55, 57, 52], scale: [0, 2, 4, 5, 7, 9], lead: 'square', energy: 0.7 },
  legend:   { bpm: 100, chords: [50, 53, 48, 55], scale: [0, 3, 5, 7, 10, 12], lead: 'sawtooth', energy: 0.7 },
  match:    { bpm: 148, chords: [57, 53, 55, 52], scale: [0, 2, 3, 5, 7, 10], lead: 'square', energy: 1.0 },
  encounter:{ bpm: 156, chords: [52, 48, 50, 47], scale: [0, 3, 5, 7, 10], lead: 'square', energy: 1.0 },
  victory:  { bpm: 120, chords: [60, 65, 67, 60], scale: [0, 4, 7, 12], lead: 'square', energy: 0.8 },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.music = 0.5;
    this.sfx = 0.7;
    this.current = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  /** Debe llamarse tras una interacción del usuario (política de autoplay). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.setVolumes(this.music, this.sfx);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pending) { const p = this.pending; this.pending = null; this.playMusic(p); }
  }

  setVolumes(music, sfx) {
    this.music = music; this.sfx = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.value = music * 0.35;
    this.sfxBus.gain.value = sfx * 0.6;
  }

  tone(freq, start, dur, { type = 'square', gain = 0.2, bus = 'music', slide = 0, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    o.start(start); o.stop(start + dur + 0.05);
  }

  noiseHit(start, dur, { gain = 0.2, bus = 'music', freq = 1200, type = 'highpass' } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    s.start(start, Math.random() * 0.5); s.stop(start + dur + 0.05);
  }

  playMusic(id) {
    if (!this.ctx) { this.pending = id; return; }
    if (this.current === id) return;
    this.stopMusic();
    const tr = TRACKS[id];
    if (!tr) return;
    this.current = id;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    const tick = () => {
      const spb = 60 / tr.bpm / 2; // corcheas
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        this.scheduleStep(tr, this.step, this.nextTime, spb);
        this.nextTime += spb;
        this.step++;
      }
    };
    tick();
    this.timer = setInterval(tick, 90);
  }

  scheduleStep(tr, step, t, spb) {
    const bar = Math.floor(step / 8) % tr.chords.length;
    const root = tr.chords[bar];
    const s = step % 8;
    // bajo
    if (s % 2 === 0) this.tone(NOTE(root - 24 + (s === 4 ? 7 : 0)), t, spb * 1.6, { type: 'triangle', gain: 0.22 });
    // acorde pad
    if (s === 0) for (const iv of [0, 4, 7]) this.tone(NOTE(root + iv), t, spb * 7, { type: 'sine', gain: 0.045, attack: 0.08 });
    // melodía pseudoaleatoria determinista
    const seed = (step * 7919 + bar * 104729) % 97;
    if (seed % 3 !== 0 || tr.energy > 0.8) {
      const deg = tr.scale[(seed + bar) % tr.scale.length];
      this.tone(NOTE(root + 12 + deg), t, spb * 0.9, { type: tr.lead, gain: 0.06 * tr.energy + 0.02 });
    }
    // batería
    if (tr.energy >= 0.5) {
      if (s === 0 || s === 4) this.tone(110, t, 0.12, { type: 'sine', gain: 0.35, slide: 0.4 });
      if (s === 2 || s === 6) this.noiseHit(t, 0.1, { gain: 0.12, freq: 1800 });
      this.noiseHit(t, 0.03, { gain: 0.04 * tr.energy, freq: 7000 });
    }
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.current = null;
  }

  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = { bus: 'sfx' };
    switch (name) {
      case 'click': this.tone(880, t, 0.05, { ...o, gain: 0.15 }); break;
      case 'select': this.tone(660, t, 0.06, { ...o, gain: 0.15 }); this.tone(990, t + 0.05, 0.08, { ...o, gain: 0.15 }); break;
      case 'error': this.tone(200, t, 0.18, { ...o, type: 'sawtooth', gain: 0.15 }); break;
      case 'kick': this.tone(160, t, 0.08, { ...o, type: 'sine', gain: 0.5, slide: 0.5 }); this.noiseHit(t, 0.05, { ...o, gain: 0.2, freq: 2500 }); break;
      case 'shot': this.tone(220, t, 0.18, { ...o, type: 'sawtooth', gain: 0.25, slide: 0.3 }); this.noiseHit(t, 0.2, { ...o, gain: 0.25, freq: 900 }); break;
      case 'whistle': this.tone(2100, t, 0.35, { ...o, gain: 0.2 }); this.tone(2160, t, 0.35, { ...o, gain: 0.12 }); break;
      case 'tackle': this.noiseHit(t, 0.18, { ...o, gain: 0.35, freq: 400, type: 'lowpass' }); break;
      case 'save': this.tone(330, t, 0.12, { ...o, type: 'square', gain: 0.2 }); this.noiseHit(t, 0.1, { ...o, gain: 0.25, freq: 600, type: 'lowpass' }); break;
      case 'goal':
        this.noiseHit(t, 2.2, { ...o, gain: 0.35, freq: 700, type: 'bandpass' });
        [0, 4, 7, 12].forEach((iv, i) => this.tone(NOTE(72 + iv), t + i * 0.12, 0.4, { ...o, gain: 0.2 }));
        break;
      case 'tech':
        this.tone(200, t, 0.7, { ...o, type: 'sawtooth', gain: 0.22, slide: 6 });
        this.tone(400, t + 0.1, 0.6, { ...o, type: 'square', gain: 0.1, slide: 4 });
        this.noiseHit(t + 0.5, 0.6, { ...o, gain: 0.3, freq: 300, type: 'lowpass' });
        break;
      case 'encounter': [0, 3, 6, 9, 12].forEach((iv, i) => this.tone(NOTE(64 + iv), t + i * 0.06, 0.1, { ...o, gain: 0.2 })); break;
      case 'levelup': [0, 4, 7, 12, 16].forEach((iv, i) => this.tone(NOTE(67 + iv), t + i * 0.08, 0.2, { ...o, type: 'triangle', gain: 0.25 })); break;
      case 'recruit': [0, 7, 12, 16, 19, 24].forEach((iv, i) => this.tone(NOTE(60 + iv), t + i * 0.09, 0.3, { ...o, type: 'square', gain: 0.15 })); break;
      case 'item': this.tone(NOTE(84), t, 0.08, { ...o, gain: 0.15 }); this.tone(NOTE(91), t + 0.08, 0.15, { ...o, gain: 0.15 }); break;
      case 'save_ok': this.tone(NOTE(76), t, 0.1, { ...o, type: 'triangle', gain: 0.2 }); this.tone(NOTE(83), t + 0.1, 0.2, { ...o, type: 'triangle', gain: 0.2 }); break;
      case 'step': this.noiseHit(t, 0.03, { ...o, gain: 0.03, freq: 3000 }); break;
      case 'lightning': this.noiseHit(t, 0.8, { ...o, gain: 0.5, freq: 200, type: 'lowpass' }); this.tone(80, t, 0.6, { ...o, type: 'sawtooth', gain: 0.2, slide: 0.5 }); break;
      default: break;
    }
  }
}

export const audio = new AudioManager();
