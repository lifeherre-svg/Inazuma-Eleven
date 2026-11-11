// Sistema de partículas y efectos visuales de técnicas especiales.

import { ELEMENTS } from '../data/elements.js';

export class Particles {
  constructor(max = 900) { this.list = []; this.max = max; }

  emit(x, y, { count = 10, color = '#fff', colors = null, speed = 80, spread = Math.PI * 2, angle = 0, life = 0.8, size = 3, gravity = 0, shape = 'circle', drag = 1.5, spin = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life, max: life, size: size * (0.6 + Math.random() * 0.8),
        color: colors ? colors[(Math.random() * colors.length) | 0] : color,
        gravity, shape, drag, rot: Math.random() * 6, spin: spin * (Math.random() - 0.5),
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.shape === 'rock') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 1.6);
        ctx.restore();
      } else if (p.shape === 'line') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); ctx.stroke();
      } else if (p.shape === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? p.size * 0.45 : p.size * 1.3;
          const ang = (i / 10) * Math.PI * 2;
          ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Configuración de emisión por tipo de animación. */
export const ANIM_FX = {
  flame:     { colors: ['#ff5a36', '#ffb347', '#ffe066', '#ff2d00'], shape: 'circle', gravity: -120, speed: 70, size: 5 },
  phoenix:   { colors: ['#ff3b1f', '#ffcf33', '#fff1a8', '#ff7b2e'], shape: 'star', gravity: -90, speed: 110, size: 5 },
  leaf:      { colors: ['#3fc35b', '#a6f07a', '#1f8a3a', '#d4ff9a'], shape: 'leaf', gravity: 10, speed: 90, size: 4, spin: 10 },
  rock:      { colors: ['#8d6e63', '#b8834a', '#5d4037', '#f0c987'], shape: 'rock', gravity: 260, speed: 140, size: 4, spin: 8 },
  meteor:    { colors: ['#f0c987', '#b8834a', '#ffcf33', '#5d4037'], shape: 'rock', gravity: 200, speed: 160, size: 5, spin: 8 },
  wind:      { colors: ['#bdf0ff', '#4bb8ff', '#ffffff'], shape: 'line', gravity: 0, speed: 220, size: 4 },
  lightning: { colors: ['#fff59d', '#ffffff', '#80d8ff', '#ffeb3b'], shape: 'line', gravity: 0, speed: 320, size: 4 },
  hand:      { colors: ['#ffcf33', '#fff1a8', '#ffb12b'], shape: 'star', gravity: 0, speed: 60, size: 6 },
  aurora:    { colors: ['#ff6bd6', '#7cf2ff', '#a6f07a', '#fff59d', '#b388ff'], shape: 'star', gravity: -40, speed: 120, size: 5 },
};

export function emitTechnique(particles, x, y, anim, intensity = 1) {
  const fx = ANIM_FX[anim] || ANIM_FX.flame;
  particles.emit(x, y, { count: Math.round(14 * intensity), colors: fx.colors, shape: fx.shape, gravity: fx.gravity, speed: fx.speed, size: fx.size, life: 0.9, spin: fx.spin || 0 });
}

/** Dibuja un rayo zigzagueante (efecto de tormenta). */
export function drawBolt(ctx, x1, y1, x2, y2, color = '#fff59d', width = 3) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    ctx.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 30, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 12);
  }
  ctx.lineTo(x2, y2); ctx.stroke(); ctx.shadowBlur = 0;
}

/**
 * Overlay cinemático de técnica (pantalla completa).
 * t: progreso 0..1, info: { name, element, anim, player, portrait (Image|null), team }
 */
export function drawTechniqueCinematic(ctx, w, h, t, info) {
  const el = ELEMENTS[info.element] || ELEMENTS.wind;
  const inT = Math.min(1, t / 0.18);
  const outT = t > 0.82 ? (t - 0.82) / 0.18 : 0;
  const alpha = Math.min(inT, 1 - outT);
  ctx.save();
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = alpha;
  // líneas de velocidad radiales
  ctx.strokeStyle = el.glow;
  ctx.lineWidth = 2;
  const cx = w * 0.62, cy = h * 0.5;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + t * 2;
    const r1 = 60 + ((i * 37) % 80) + t * 200;
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * (r1 + 220), cy + Math.sin(a) * (r1 + 220));
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  // aura elemental
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, h * 0.6);
  g.addColorStop(0, el.glow);
  g.addColorStop(0.4, el.color + 'aa');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, h * 0.6 * (0.7 + 0.3 * Math.sin(t * Math.PI)), 0, Math.PI * 2); ctx.fill();
  if (info.anim === 'lightning') for (let i = 0; i < 3; i++) drawBolt(ctx, cx + (Math.random() - 0.5) * 300, 0, cx + (Math.random() - 0.5) * 120, cy);
  // retrato deslizándose
  if (info.portrait?.complete) {
    const px = -260 + inT * 300 - outT * 300;
    const size = h * 0.7;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, h * 0.15); ctx.lineTo(px + size, h * 0.1); ctx.lineTo(px + size * 0.9, h * 0.9); ctx.lineTo(px - 40, h * 0.88); ctx.closePath();
    ctx.clip();
    ctx.drawImage(info.portrait, px, h * 0.12, size, size);
    ctx.restore();
  }
  // banda con el nombre
  const bandY = h * 0.68;
  ctx.fillStyle = el.color;
  ctx.beginPath();
  ctx.moveTo(w, bandY - 40); ctx.lineTo(w * 0.25 - (1 - inT) * w, bandY - 30); ctx.lineTo(w * 0.22 - (1 - inT) * w, bandY + 34); ctx.lineTo(w, bandY + 24);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.textAlign = 'right';
  const fs = Math.round(h * 0.075);
  ctx.font = `italic 900 ${fs}px "Russo One", "Arial Black", sans-serif`;
  const tx = w - 30 + (1 - inT) * 400;
  ctx.strokeText(info.name.toUpperCase(), tx, bandY + fs * 0.32);
  ctx.fillText(info.name.toUpperCase(), tx, bandY + fs * 0.32);
  ctx.font = `bold ${Math.round(fs * 0.38)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${el.icon} ${info.player}${info.partners?.length ? ' + ' + info.partners.join(' + ') : ''}`, tx, bandY - 46);
  ctx.restore();
}
