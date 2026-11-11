// Generación procedural de personajes con estética anime (retratos y
// sprites chibi). No usa recursos externos: todo se dibuja en canvas, de modo
// que se puede sustituir por arte licenciado más adelante (ver docs).

import { hashString } from '../core/rng.js';
import { ELEMENTS } from '../data/elements.js';

const HAIR_STYLES = ['spiky', 'messy', 'short', 'swept', 'long', 'ponytail', 'mohawk', 'bowl'];
const HAIR_COLORS = ['#2b1d14', '#5a3825', '#1e1e2a', '#d9a441', '#b5402a', '#3b5bdb', '#6d6875', '#e8e8f0', '#2f7d4a', '#8b2d2d'];
const SKINS = ['#f5d0b0', '#f2c9a5', '#e8b48f', '#c98d6a', '#8d5a3c', '#fde0c8'];
const EYE_BY_ELEMENT = { fire: '#e8432e', wood: '#2e9e4f', mountain: '#a0662f', wind: '#2f8fe0' };

/** Aspecto determinista de un jugador a partir de su plantilla. */
export function lookFor(template) {
  const h = hashString(template.id || 'x');
  const base = {
    hair: HAIR_STYLES[h % HAIR_STYLES.length],
    hairColor: HAIR_COLORS[(h >>> 4) % HAIR_COLORS.length],
    skin: SKINS[(h >>> 8) % SKINS.length],
    eyes: EYE_BY_ELEMENT[template.element] || '#444',
    accessory: (h >>> 12) % 7 === 0 ? 'headband' : null,
  };
  return { ...base, ...(template.look || {}) };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------- pelo
function drawHairBack(ctx, look, cx, cy, r) {
  ctx.fillStyle = shade(look.hairColor, -20);
  if (look.hair === 'long') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.45, r * 1.12, r * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.hair === 'ponytail') {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.6, cy - r * 0.4);
    ctx.quadraticCurveTo(cx + r * 1.9, cy + r * 0.2, cx + r * 1.2, cy + r * 1.5);
    ctx.quadraticCurveTo(cx + r * 1.1, cy + r * 0.4, cx + r * 0.5, cy);
    ctx.fill();
  }
}

function drawHairFront(ctx, look, cx, cy, r) {
  const c = look.hairColor;
  ctx.fillStyle = c;
  ctx.strokeStyle = shade(c, -45);
  ctx.lineWidth = Math.max(1, r * 0.05);
  const style = look.hair;
  ctx.beginPath();
  if (style === 'bald') return;
  if (style === 'spiky' || style === 'messy') {
    const spikes = style === 'spiky' ? 7 : 9;
    ctx.moveTo(cx - r * 1.05, cy + r * 0.1);
    for (let i = 0; i <= spikes; i++) {
      const a = Math.PI + (i / spikes) * Math.PI;
      const len = style === 'spiky' ? 1.55 + (i % 2) * 0.25 : 1.3 + ((i * 7) % 3) * 0.1;
      const mid = Math.PI + ((i + 0.5) / spikes) * Math.PI;
      ctx.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02 - r * 0.05);
      if (i < spikes) ctx.lineTo(cx + Math.cos(mid) * r * len, cy + Math.sin(mid) * r * len - r * 0.1);
    }
    ctx.lineTo(cx + r * 1.05, cy + r * 0.1);
    // flequillo
    ctx.lineTo(cx + r * 0.7, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.45, cy + r * 0.15);
    ctx.lineTo(cx + r * 0.2, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.2);
    ctx.lineTo(cx - r * 0.35, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.65, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.85, cy - r * 0.1);
    ctx.closePath();
  } else if (style === 'mohawk') {
    ctx.moveTo(cx - r * 0.25, cy - r * 0.6);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(cx - r * 0.25 + i * r * 0.12, cy - r * (1.5 + (i % 2) * 0.2));
      ctx.lineTo(cx - r * 0.19 + i * r * 0.12, cy - r * 0.9);
    }
    ctx.lineTo(cx + r * 0.3, cy - r * 0.6);
    ctx.closePath();
  } else if (style === 'bowl') {
    ctx.arc(cx, cy - r * 0.05, r * 1.08, Math.PI, 0);
    ctx.lineTo(cx + r * 1.08, cy - r * 0.05);
    ctx.lineTo(cx - r * 1.08, cy - r * 0.05);
    ctx.closePath();
  } else {
    // short / swept / long / ponytail: casco + flequillo
    ctx.arc(cx, cy - r * 0.05, r * 1.06, Math.PI * 1.02, Math.PI * 1.98);
    const sweep = style === 'swept' ? 1 : 0;
    ctx.lineTo(cx + r * 1.05, cy + r * 0.25);
    ctx.quadraticCurveTo(cx + r * (0.5 + sweep * 0.3), cy - r * 0.3, cx + r * 0.15, cy + r * 0.05);
    ctx.quadraticCurveTo(cx - r * (0.2 - sweep * 0.4), cy - r * 0.4, cx - r * 0.55, cy + r * 0.1);
    ctx.quadraticCurveTo(cx - r * 0.85, cy - r * 0.2, cx - r * 1.05, cy + r * (style === 'long' ? 0.6 : 0.25));
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  // brillo
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(cx - r * 0.1, cy - r * 0.35, r * 0.6, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
}

function drawAccessory(ctx, look, cx, cy, r) {
  const a = look.accessory;
  if (!a) return;
  if (a === 'headband' || a === 'bandana') {
    ctx.fillStyle = a === 'headband' ? '#ff8a00' : '#c62828';
    ctx.fillRect(cx - r * 1.02, cy - r * 0.42, r * 2.04, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx + r * 1.0, cy - r * 0.35);
    ctx.lineTo(cx + r * 1.6, cy - r * 0.1);
    ctx.lineTo(cx + r * 1.45, cy + r * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (a === 'goggles') {
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - r * 1.0, cy - r * 0.62, r * 2.0, r * 0.14);
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#9ef0ff';
      ctx.beginPath(); ctx.arc(cx + s * r * 0.4, cy - r * 0.62, r * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.06; ctx.stroke();
    }
  } else if (a === 'glasses') {
    ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.06;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(cx + s * r * 0.42 - r * 0.24, cy + r * 0.12, r * 0.48, r * 0.3); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - r * 0.18, cy + r * 0.24); ctx.lineTo(cx + r * 0.18, cy + r * 0.24); ctx.stroke();
  } else if (a === 'beard') {
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.8, r * 0.6, r * 0.45, 0, 0, Math.PI); ctx.fill();
  } else if (a === 'beads') {
    ctx.fillStyle = '#6d4c41';
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx + i * r * 0.22, cy + r * 1.35 + Math.abs(i) * -r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawFace(ctx, look, cx, cy, r, mood = 'determined') {
  // cara
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.2);
  ctx.quadraticCurveTo(cx - r * 1.0, cy + r * 0.7, cx, cy + r * 1.05);
  ctx.quadraticCurveTo(cx + r * 1.0, cy + r * 0.7, cx + r, cy - r * 0.2);
  ctx.arc(cx, cy - r * 0.2, r, 0, Math.PI, true);
  ctx.fill();
  // orejas
  ctx.beginPath(); ctx.ellipse(cx - r * 0.98, cy + r * 0.15, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.98, cy + r * 0.15, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  // ojos anime
  for (const s of [-1, 1]) {
    const ex = cx + s * r * 0.42, ey = cy + r * 0.22;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.22, r * 0.27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.eyes || '#333';
    ctx.beginPath(); ctx.ellipse(ex + s * r * 0.02, ey + r * 0.03, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(ex + s * r * 0.02, ey + r * 0.05, r * 0.08, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex - r * 0.05, ey - r * 0.06, r * 0.06, 0, Math.PI * 2); ctx.fill();
    // párpado superior
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.23, r * 0.28, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // ceja
    ctx.strokeStyle = shade(look.hairColor, -30); ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    const tilt = mood === 'determined' ? 0.12 : -0.05;
    ctx.moveTo(ex - s * r * 0.2, ey - r * (0.38 - tilt));
    ctx.lineTo(ex + s * r * 0.22, ey - r * (0.42 + tilt * 0.5));
    ctx.stroke();
  }
  // nariz y boca
  ctx.strokeStyle = shade(look.skin, -60); ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.moveTo(cx + r * 0.02, cy + r * 0.45); ctx.lineTo(cx - r * 0.04, cy + r * 0.55); ctx.stroke();
  ctx.strokeStyle = '#6b2b2b'; ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  if (mood === 'happy') ctx.arc(cx, cy + r * 0.62, r * 0.18, 0.1 * Math.PI, 0.9 * Math.PI);
  else { ctx.moveTo(cx - r * 0.15, cy + r * 0.72); ctx.quadraticCurveTo(cx, cy + r * 0.78, cx + r * 0.17, cy + r * 0.68); }
  ctx.stroke();
  // rubor
  ctx.fillStyle = 'rgba(255,120,120,0.25)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.55, cy + r * 0.55, r * 0.15, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.55, cy + r * 0.55, r * 0.15, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
}

/** Dibuja un retrato (busto) en un contexto. */
export function drawPortrait(ctx, size, look, { element = null, jersey = '#1565ff', jersey2 = '#ffd400', mood = 'determined', bg = true } = {}) {
  const el = ELEMENTS[element];
  if (bg) {
    const g = ctx.createRadialGradient(size / 2, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, el ? el.glow : '#ffffff');
    g.addColorStop(1, el ? el.color : '#5b6b8c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // líneas de velocidad
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = size * 0.02;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(size / 2 + Math.cos(a) * size * 0.35, size * 0.45 + Math.sin(a) * size * 0.35);
      ctx.lineTo(size / 2 + Math.cos(a) * size * 0.8, size * 0.45 + Math.sin(a) * size * 0.8);
      ctx.stroke();
    }
  }
  const cx = size / 2, cy = size * 0.42, r = size * 0.24;
  if (look.accessory === 'cape') {
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath(); ctx.moveTo(cx - r * 1.8, size); ctx.lineTo(cx - r * 1.2, cy + r * 1.1); ctx.lineTo(cx + r * 1.2, cy + r * 1.1); ctx.lineTo(cx + r * 1.8, size); ctx.fill();
  }
  drawHairBack(ctx, look, cx, cy, r);
  // hombros / camiseta
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.6, size);
  ctx.quadraticCurveTo(cx - r * 1.5, cy + r * 1.25, cx - r * 0.4, cy + r * 1.15);
  ctx.lineTo(cx + r * 0.4, cy + r * 1.15);
  ctx.quadraticCurveTo(cx + r * 1.5, cy + r * 1.25, cx + r * 1.6, size);
  ctx.fill();
  ctx.fillStyle = jersey2;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 1.15); ctx.lineTo(cx, cy + r * 1.6); ctx.lineTo(cx + r * 0.45, cy + r * 1.15); ctx.fill();
  // cuello
  ctx.fillStyle = shade(look.skin, -20);
  ctx.fillRect(cx - r * 0.28, cy + r * 0.8, r * 0.56, r * 0.42);
  drawFace(ctx, look, cx, cy, r, mood);
  drawHairFront(ctx, look, cx, cy, r);
  drawAccessory(ctx, look, cx, cy, r);
}

const portraitCache = new Map();

/** URL de imagen (data URL) de un retrato, cacheada. Solo en navegador. */
export function portraitURL(key, look, opts = {}, size = 128) {
  const k = `${key}|${size}|${opts.element}|${opts.jersey}|${opts.mood}`;
  if (portraitCache.has(k)) return portraitCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPortrait(c.getContext('2d'), size, look, opts);
  const url = c.toDataURL();
  portraitCache.set(k, url);
  return url;
}

/**
 * Sprite chibi visto desde arriba/frente (mundo y partidos).
 * (x, y) = posición de los pies.
 */
export function drawChibi(ctx, x, y, look, { scale = 1, dir = 'down', frame = 0, jersey = '#1565ff', jersey2 = '#ffffff', number = null, shadow = true, highlight = null } = {}) {
  const s = scale;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (highlight) {
    ctx.strokeStyle = highlight; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.ellipse(x, y, 12 * s, 5 * s, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const bob = Math.sin(frame * Math.PI) * 1.5 * s;
  // piernas
  ctx.fillStyle = '#222';
  const legSwing = Math.sin(frame * Math.PI * 2) * 2.5 * s;
  ctx.fillRect(x - 4 * s, y - 7 * s + Math.max(0, legSwing) * 0.3, 3 * s, 6 * s);
  ctx.fillRect(x + 1 * s, y - 7 * s + Math.max(0, -legSwing) * 0.3, 3 * s, 6 * s);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(x - 4.5 * s, y - 2 * s, 4 * s, 2 * s);
  ctx.fillRect(x + 0.5 * s, y - 2 * s, 4 * s, 2 * s);
  // cuerpo
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 7 * s - bob);
  ctx.lineTo(x - 7 * s, y - 16 * s - bob);
  ctx.quadraticCurveTo(x, y - 19 * s - bob, x + 7 * s, y - 16 * s - bob);
  ctx.lineTo(x + 6 * s, y - 7 * s - bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = jersey2;
  ctx.fillRect(x - 6 * s, y - 9 * s - bob, 12 * s, 2 * s);
  if (number !== null && dir !== 'up') {
    ctx.fillStyle = jersey2;
    ctx.font = `bold ${6 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(number), x, y - 10.5 * s - bob);
  }
  // cabeza
  const hx = x, hy = y - 25 * s - bob, r = 8 * s;
  drawHairBack(ctx, look, hx, hy, r);
  if (dir === 'up') {
    ctx.fillStyle = look.hairColor;
    ctx.beginPath(); ctx.arc(hx, hy, r * 1.05, 0, Math.PI * 2); ctx.fill();
    drawHairFront(ctx, look, hx, hy, r);
    return;
  }
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(hx, hy + r * 0.1, r, 0, Math.PI * 2); ctx.fill();
  const ox = dir === 'left' ? -r * 0.35 : dir === 'right' ? r * 0.35 : 0;
  ctx.fillStyle = '#1a1a1a';
  for (const sd of dir === 'down' ? [-1, 1] : [dir === 'left' ? -1 : 1]) {
    const ex = hx + sd * r * 0.38 + (dir === 'down' ? 0 : ox * 0.6);
    ctx.beginPath(); ctx.ellipse(ex, hy + r * 0.25, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.eyes || '#333';
    ctx.beginPath(); ctx.ellipse(ex, hy + r * 0.3, r * 0.09, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
  }
  drawHairFront(ctx, look, hx, hy, r);
  drawAccessory(ctx, look, hx, hy, r);
}

export { shade };
