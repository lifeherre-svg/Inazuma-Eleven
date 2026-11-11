// Renderizado del partido en canvas: campo, gradas, jugadores, balón,
// efectos, textos flotantes, minimapa y cinemáticas de técnicas.

import { MATCH } from '../config.js';
import { ELEMENTS } from '../data/elements.js';
import { getPlayerTemplate } from '../systems/database.js';
import { drawChibi, lookFor, portraitURL } from './sprites.js';
import { Particles, emitTechnique, drawTechniqueCinematic, ANIM_FX } from './vfx.js';

const L = MATCH.fieldW, W = MATCH.fieldH;

export class MatchRenderer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.e = engine;
    this.cam = { x: L / 2, y: W / 2 };
    this.particles = new Particles();
    this.floaters = [];
    this.cinematic = null;
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.trail = [];
    this.looks = new Map();
    this.portraitImgs = new Map();
    this.crowd = Array.from({ length: 420 }, (_, i) => ({ i, c: ['#ff5a36', '#1565ff', '#ffd400', '#fff', '#3fc35b', '#b25cff'][i % 6], ph: Math.random() * 6 }));
  }

  lookOf(p) {
    if (!this.looks.has(p.id)) {
      let look;
      try { look = lookFor(getPlayerTemplate(p.templateId)); } catch { look = { hair: 'short', hairColor: '#333', skin: '#f2c9a5' }; }
      this.looks.set(p.id, look);
    }
    return this.looks.get(p.id);
  }

  portraitOf(p, team) {
    const key = p.id;
    if (!this.portraitImgs.has(key)) {
      const img = new Image();
      const colors = this.e.teams[team].spec.colors;
      img.src = portraitURL(p.templateId, this.lookOf(p), { element: p.element, jersey: colors.primary, jersey2: colors.secondary }, 256);
      this.portraitImgs.set(key, img);
    }
    return this.portraitImgs.get(key);
  }

  findPlayer(name, team) {
    return this.e.teams[team]?.players.find((p) => p.name === name) || this.e.teams[team]?.bench.find((p) => p.name === name);
  }

  /** Procesa eventos del motor para generar efectos. */
  onEvent(ev, shakeEnabled = true) {
    const b = this.e.ball;
    switch (ev.type) {
      case 'tech': {
        const p = this.findPlayer(ev.player, ev.team);
        this.cinematic = {
          t: 0, dur: ev.short ? MATCH.cinematicTime * 0.75 : MATCH.cinematicTime * (ev.tech.combo ? 1.3 : 1),
          info: { name: ev.tech.name, element: ev.tech.element, anim: ev.tech.anim, player: ev.player, partners: ev.partners, portrait: p ? this.portraitOf(p, ev.team) : null },
        };
        emitTechnique(this.particles, ev.x, ev.y, ev.tech.anim, 3);
        if (shakeEnabled) this.shake = 0.4;
        break;
      }
      case 'goal':
        this.floater('¡¡GOOOL!!', b.x, b.y - 30, '#ffd400', 2.2, 46);
        this.particles.emit(ev.team === 0 ? L : 0, W / 2, { count: 120, colors: ['#ffd400', '#fff', '#ff5a36', '#1565ff'], speed: 320, life: 1.6, size: 4, shape: 'star', gravity: 120 });
        this.flash = 0.5;
        if (shakeEnabled) this.shake = 0.6;
        break;
      case 'save': this.floater(ev.caught ? '¡ATRAPADA!' : '¡DESPEJE!', b.x, b.y - 26, '#7cf2ff', 1.2, 26); break;
      case 'block':
        if (ev.tech) { this.floater(ev.tech.name, ev.x, ev.y - 50, ELEMENTS[ev.tech.element].glow, 1.4, 20); emitTechnique(this.particles, ev.x, ev.y, ev.tech.anim, 2); }
        if (ev.success) this.floater('¡BLOQUEO!', ev.x, ev.y - 26, '#f0c987', 1.1, 24);
        break;
      case 'tackle': this.floater('¡ROBO!', b.x, b.y - 26, '#ff8a80', 1.0, 22); this.particles.emit(b.x, b.y, { count: 12, color: '#e0e0e0', speed: 90, life: 0.5 }); break;
      case 'dribble': this.floater('¡REGATE!', b.x, b.y - 26, '#a6f07a', 1.0, 22); break;
      case 'intercept': this.floater('¡INTERCEPTADO!', b.x, b.y - 26, '#ffb347', 1.0, 20); break;
      case 'keeperBeaten': this.particles.emit(b.x, b.y, { count: 30, colors: ['#fff', '#ffd400'], speed: 200, life: 0.6 }); break;
      case 'shot':
        if (shakeEnabled && ev.tech) this.shake = 0.3;
        this.particles.emit(b.x, b.y, { count: 10, color: '#fff', speed: 120, life: 0.4 });
        break;
      case 'aiAdapt': this.floater(ev.text, this.cam.x, this.cam.y - 150, '#ffffff', 2.4, 18); break;
      case 'noTp': this.floater('¡Sin PT!', b.x, b.y - 30, '#ff4d6d', 1.0, 20); break;
      default: break;
    }
  }

  floater(text, x, y, color, life = 1.2, size = 22) {
    this.floaters.push({ text, x, y, color, life, max: life, size });
  }

  update(dt) {
    this.time += dt;
    const b = this.e.ball;
    // cámara: sigue al balón con anticipación
    const tx = Math.max(this.viewW() / 2 - 60, Math.min(L - this.viewW() / 2 + 60, b.x + b.vx * 0.15));
    const ty = Math.max(this.viewH() / 2 - 60, Math.min(W - this.viewH() / 2 + 60, b.y + b.vy * 0.1));
    const k = Math.min(1, dt * 4);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.particles.update(dt);
    for (const f of this.floaters) { f.life -= dt; f.y -= 20 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.cinematic) { this.cinematic.t += dt / this.cinematic.dur; if (this.cinematic.t >= 1) this.cinematic = null; }
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    // estela del balón
    if (b.kind === 'shot' && b.shot) {
      this.trail.push({ x: b.x, y: b.y - b.z, life: 0.35, el: b.element });
      const fx = ANIM_FX[b.shot.techAnim];
      if (fx) this.particles.emit(b.x, b.y - b.z, { count: 3, colors: fx.colors, shape: fx.shape, speed: 40, life: 0.5, size: fx.size * 0.8, spin: fx.spin || 0 });
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
  }

  /** Zoom: ~470 unidades de alto en horizontal; en vertical garantiza ≥600 de ancho. */
  scale() { return Math.min(this.canvas.height / 470, this.canvas.width / 600); }
  viewW() { return this.canvas.width / this.scale(); }
  viewH() { return this.canvas.height / this.scale(); }

  draw() {
    const { ctx, canvas } = this;
    const s = this.scale();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
    ctx.setTransform(s, 0, 0, s, canvas.width / 2 - this.cam.x * s + shx, canvas.height / 2 - this.cam.y * s + shy);
    this.drawStands();
    this.drawPitch();
    this.drawEntities();
    this.particles.draw(ctx);
    this.drawFloaters();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawMinimap();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (this.cinematic) drawTechniqueCinematic(ctx, canvas.width, canvas.height, this.cinematic.t, this.cinematic.info);
  }

  drawStands() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1b2a40';
    ctx.fillRect(-160, -160, L + 320, 120);
    ctx.fillRect(-160, W + 40, L + 320, 120);
    ctx.fillRect(-160, -40, 120, W + 80);
    ctx.fillRect(L + 40, -40, 120, W + 80);
    const t = this.time;
    for (const c of this.crowd) {
      const i = c.i;
      let x, y;
      if (i < 200) { x = -150 + (i % 100) * ((L + 300) / 100); y = i < 100 ? -150 + ((i * 7) % 90) : W + 50 + ((i * 7) % 90); }
      else { const j = i - 200; x = j < 110 ? -150 + ((j * 13) % 100) : L + 50 + ((j * 13) % 100); y = -30 + (j % 110) * ((W + 60) / 110); }
      ctx.fillStyle = c.c;
      ctx.fillRect(x, y + Math.sin(t * 6 + c.ph) * 2, 5, 5);
    }
  }

  drawPitch() {
    const ctx = this.ctx;
    // franjas
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#2e9e4f' : '#34ad57';
      ctx.fillRect((i * L) / 14, 0, L / 14 + 1, W);
    }
    ctx.fillStyle = '#287f43';
    ctx.fillRect(-40, -40, L + 80, 40); ctx.fillRect(-40, W, L + 80, 40);
    ctx.fillRect(-40, 0, 40, W); ctx.fillRect(L, 0, 40, W);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, L, W);
    ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.lineTo(L / 2, W); ctx.stroke();
    ctx.beginPath(); ctx.arc(L / 2, W / 2, 92, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(L / 2, W / 2, 4, 0, Math.PI * 2); ctx.fill();
    for (const side of [0, 1]) {
      const x0 = side ? L : 0, d = side ? -1 : 1;
      ctx.strokeRect(side ? L - 165 : 0, W / 2 - 200, 165, 400);
      ctx.strokeRect(side ? L - 55 : 0, W / 2 - 92, 55, 184);
      ctx.beginPath(); ctx.arc(x0 + d * 110, W / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x0 + d * 110, W / 2, 92, side ? Math.PI * 0.7 : -Math.PI * 0.3, side ? Math.PI * 1.3 : Math.PI * 0.3); ctx.stroke();
      // portería
      const gx = side ? L : -MATCH.goalDepth;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(gx, W / 2 - MATCH.goalWidth / 2, MATCH.goalDepth, MATCH.goalWidth);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      for (let k = 0; k < MATCH.goalWidth; k += 10) { ctx.beginPath(); ctx.moveTo(gx, W / 2 - MATCH.goalWidth / 2 + k); ctx.lineTo(gx + MATCH.goalDepth, W / 2 - MATCH.goalWidth / 2 + k); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.strokeRect(gx, W / 2 - MATCH.goalWidth / 2, MATCH.goalDepth, MATCH.goalWidth);
      ctx.lineWidth = 3;
    }
  }

  drawEntities() {
    const ctx = this.ctx;
    const e = this.e;
    const list = e.allPlayers().slice().sort((a, b) => a.y - b.y);
    // estela
    for (const t of this.trail) {
      const el = ELEMENTS[t.el];
      ctx.globalAlpha = t.life / 0.35 * 0.8;
      ctx.fillStyle = el ? el.color : '#ffffff';
      ctx.beginPath(); ctx.arc(t.x, t.y, MATCH.ballRadius * 1.6 * (t.life / 0.35), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const b = e.ball;
    for (const p of list) {
      const colors = e.teams[p.team].spec.colors;
      const moving = Math.hypot(p.vx, p.vy) > 15;
      const dir = Math.abs(p.face.x) > Math.abs(p.face.y) ? (p.face.x > 0 ? 'right' : 'left') : p.face.y < 0 ? 'up' : 'down';
      const controlled = p === e.controlled;
      const gkColors = p.role === 'GK' ? { jersey: p.team === 0 ? '#ff8a00' : '#7cf2ff', jersey2: '#222' } : { jersey: colors.primary, jersey2: colors.secondary };
      drawChibi(ctx, p.x, p.y, this.lookOf(p), {
        scale: 1.25, dir, frame: moving ? (this.time * 3 + p.idx * 0.3) % 1 : 0, ...gkColors,
        number: p.idx < 100 ? p.idx + 1 : null,
        highlight: controlled ? '#ffd400' : b.owner === p ? '#ffffff' : null,
      });
      if (p.stun > 0) {
        ctx.fillStyle = '#fff59d';
        for (let i = 0; i < 3; i++) { const a = this.time * 6 + i * 2.1; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 10, p.y - 44 + Math.sin(a) * 3, 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
      if (controlled) {
        ctx.fillStyle = '#ffd400';
        const yy = p.y - 52 + Math.sin(this.time * 6) * 2;
        ctx.beginPath(); ctx.moveTo(p.x - 7, yy - 8); ctx.lineTo(p.x + 7, yy - 8); ctx.lineTo(p.x, yy); ctx.fill();
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.strokeText(p.short, p.x, yy - 12); ctx.fillStyle = '#fff'; ctx.fillText(p.short, p.x, yy - 12);
      }
    }
    // balón
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, MATCH.ballRadius, MATCH.ballRadius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    const by = b.y - b.z - 3;
    if (b.element && b.kind === 'shot') {
      const el = ELEMENTS[b.element];
      const g = ctx.createRadialGradient(b.x, by, 1, b.x, by, 22);
      g.addColorStop(0, el.glow); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, by, 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x, by, MATCH.ballRadius + 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#222';
    const rot = this.time * Math.hypot(b.vx, b.vy) * 0.05;
    for (let i = 0; i < 3; i++) { const a = rot + i * 2.1; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 3, by + Math.sin(a) * 3, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }

  drawFloaters() {
    const ctx = this.ctx;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      ctx.font = `italic 900 ${f.size}px "Russo One", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#000';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawMinimap() {
    const ctx = this.ctx;
    const mw = Math.min(this.canvas.width * 0.24, this.canvas.height * 0.32, 220 * (window.devicePixelRatio > 1 ? 1.5 : 1)), mh = mw * (W / L);
    const x0 = this.canvas.width / 2 - mw / 2, y0 = this.canvas.height - mh - 10;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#1e6b36'; ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, mw, mh);
    ctx.beginPath(); ctx.moveTo(x0 + mw / 2, y0); ctx.lineTo(x0 + mw / 2, y0 + mh); ctx.stroke();
    for (const p of this.e.allPlayers()) {
      ctx.fillStyle = p === this.e.controlled ? '#ffd400' : this.e.teams[p.team].spec.colors.primary;
      ctx.beginPath(); ctx.arc(x0 + (p.x / L) * mw, y0 + (p.y / W) * mh, p === this.e.controlled ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x0 + (this.e.ball.x / L) * mw, y0 + (this.e.ball.y / W) * mh, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
