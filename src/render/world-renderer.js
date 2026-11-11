// Renderizado del mundo explorable. La capa estática del mapa se pre-dibuja
// en un canvas fuera de pantalla (optimización); cada frame solo se dibujan
// los elementos animados (agua, hierba, NPC, objetos, jugador).

import { TILE } from '../config.js';
import { T } from '../world/tiles.js';
import { drawChibi, lookFor, shade } from './sprites.js';
import { getPlayerTemplate } from '../systems/database.js';
import { hashString } from '../core/rng.js';

const THEMES = {
  town:     { grass: '#5cc06a', grass2: '#53b361', path: '#d9c39a', tree: '#2f8f46', trunk: '#6d4c41' },
  river:    { grass: '#62c46e', grass2: '#58b864', path: '#d6bf91', tree: '#2e8b57', trunk: '#6d4c41' },
  school:   { grass: '#68c072', grass2: '#5db467', path: '#cfc3ad', tree: '#33945a', trunk: '#6d4c41' },
  forest:   { grass: '#3f9e52', grass2: '#378f49', path: '#b99a6b', tree: '#1f6b35', trunk: '#4e342e' },
  mountain: { grass: '#8fae7a', grass2: '#83a06f', path: '#b8a88a', tree: '#4f7a4f', trunk: '#5d4037' },
  city:     { grass: '#6cc07a', grass2: '#63b470', path: '#8e98a8', tree: '#2f8f46', trunk: '#6d4c41' },
  island:   { grass: '#6fcf7a', grass2: '#64c070', path: '#e8d4a0', tree: '#2a9d5c', trunk: '#795548' },
};

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = null;
    this.layerMap = null;
    this.time = 0;
    this.looks = new Map();
  }

  buildLayer(map) {
    const th = THEMES[map.theme] || THEMES.town;
    const c = document.createElement('canvas');
    c.width = map.w * TILE; c.height = map.h * TILE;
    const g = c.getContext('2d');
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) this.drawTile(g, map, x, y, map.get(x, y), th);
    }
    for (const f of map.fields) this.drawField(g, f);
    for (const b of map.buildings) this.drawBuilding(g, b);
    this.layer = c;
    this.layerMap = map;
    this.theme = th;
  }

  drawTile(g, map, x, y, t, th) {
    const px = x * TILE, py = y * TILE;
    const h = hashString(`${x},${y}`);
    const base = (x + y) % 2 ? th.grass : th.grass2;
    g.fillStyle = map.base === 'PLAZA' ? '#c9c2b8' : map.base === 'SAND' ? '#ead9a6' : base;
    g.fillRect(px, py, TILE, TILE);
    switch (t) {
      case T.GRASS:
        g.fillStyle = (x + y) % 2 ? th.grass : th.grass2; g.fillRect(px, py, TILE, TILE);
        if (h % 5 === 0) { g.fillStyle = shade(th.grass, 25); g.fillRect(px + (h % 20), py + ((h >> 5) % 20), 3, 6); }
        break;
      case T.TALL:
        g.fillStyle = shade(th.grass, -25); g.fillRect(px, py, TILE, TILE);
        g.fillStyle = shade(th.grass, -45);
        for (let i = 0; i < 4; i++) {
          const bx = px + 4 + i * 7, by = py + 26;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 3, by - 18 - (h >> i) % 6); g.lineTo(bx + 6, by); g.fill();
        }
        break;
      case T.PATH: g.fillStyle = th.path; g.fillRect(px, py, TILE, TILE);
        if (h % 4 === 0) { g.fillStyle = shade(th.path, -20); g.fillRect(px + (h % 24), py + ((h >> 4) % 24), 4, 3); }
        break;
      case T.PLAZA: g.fillStyle = '#c9c2b8'; g.fillRect(px, py, TILE, TILE); g.strokeStyle = '#b3aba0'; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1); break;
      case T.SAND: g.fillStyle = '#ead9a6'; g.fillRect(px, py, TILE, TILE); if (h % 3 === 0) { g.fillStyle = '#d8c48d'; g.fillRect(px + (h % 26), py + ((h >> 3) % 26), 3, 3); } break;
      case T.WATER: g.fillStyle = '#2f80d1'; g.fillRect(px, py, TILE, TILE); break;
      case T.BRIDGE: g.fillStyle = '#2f80d1'; g.fillRect(px, py, TILE, TILE); g.fillStyle = '#a1764a'; g.fillRect(px, py + 2, TILE, TILE - 4); g.fillStyle = '#7a5532'; for (let i = 0; i < 4; i++) g.fillRect(px + i * 8, py + 2, 1.5, TILE - 4); break;
      case T.TREE:
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(px + 16, py + 28, 12, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = th.trunk; g.fillRect(px + 13, py + 18, 6, 10);
        g.fillStyle = th.tree; g.beginPath(); g.arc(px + 16, py + 13, 13, 0, Math.PI * 2); g.fill();
        g.fillStyle = shade(th.tree, 25); g.beginPath(); g.arc(px + 12, py + 9, 6, 0, Math.PI * 2); g.fill();
        break;
      case T.ROCK:
        g.fillStyle = '#7d7d86'; g.beginPath(); g.moveTo(px + 3, py + 28); g.lineTo(px + 8, py + 6); g.lineTo(px + 22, py + 3); g.lineTo(px + 30, py + 28); g.fill();
        g.fillStyle = '#a2a2ac'; g.beginPath(); g.moveTo(px + 8, py + 6); g.lineTo(px + 22, py + 3); g.lineTo(px + 18, py + 16); g.fill();
        break;
      case T.FENCE: g.fillStyle = '#8d6e63'; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px + 4, py + 6, 4, 22); g.fillRect(px + 22, py + 6, 4, 22); break;
      case T.FLOWER:
        for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff6b9d', '#ffd166', '#ffffff'][(h + i) % 3]; g.beginPath(); g.arc(px + 6 + i * 10, py + 10 + ((h >> i) % 14), 3, 0, Math.PI * 2); g.fill(); }
        break;
      case T.PITCH: g.fillStyle = (x % 2) ? '#3aa955' : '#35a050'; g.fillRect(px, py, TILE, TILE); break;
      case T.WALL: case T.ROOF: case T.DOOR: break; // los dibuja drawBuilding
      default: break;
    }
  }

  drawField(g, f) {
    const x = f.x * TILE, y = f.y * TILE, w = f.w * TILE, h = f.h * TILE;
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.beginPath(); g.moveTo(x + w / 2, y + 4); g.lineTo(x + w / 2, y + h - 4); g.stroke();
    g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.18, 0, Math.PI * 2); g.stroke();
    g.strokeRect(x + 4, y + h / 2 - h * 0.25, w * 0.12, h * 0.5);
    g.strokeRect(x + w - 4 - w * 0.12, y + h / 2 - h * 0.25, w * 0.12, h * 0.5);
    g.fillStyle = '#fff'; g.fillRect(x, y + h / 2 - 16, 6, 32); g.fillRect(x + w - 6, y + h / 2 - 16, 6, 32);
  }

  drawBuilding(g, b) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 6, y + 6, w, h);
    const wallH = 2 * TILE;
    const wallY = b.side === 'bottom' ? y + h - wallH : y;
    const roofY = b.side === 'bottom' ? y : y + wallH;
    // tejado
    g.fillStyle = b.roof; g.fillRect(x, roofY, w, h - wallH);
    g.fillStyle = shade(b.roof, -30);
    for (let i = 0; i < (h - wallH) / 8; i++) g.fillRect(x, roofY + i * 8 + 6, w, 2);
    g.fillStyle = shade(b.roof, 30); g.fillRect(x, roofY, w, 4);
    // pared
    g.fillStyle = '#f1e9da'; g.fillRect(x, wallY, w, wallH);
    g.fillStyle = '#d9cdb6'; g.fillRect(x, wallY + wallH - 4, w, 4);
    // ventanas
    for (let i = 1; i < b.w - 1; i += 2) {
      if (b.x + i === b.door.x) continue;
      g.fillStyle = '#8fd3ff'; g.fillRect(x + i * TILE + 6, wallY + 10, TILE - 12, 18);
      g.fillStyle = '#ffffff88'; g.fillRect(x + i * TILE + 8, wallY + 12, 6, 6);
    }
    // puerta
    const dx = b.door.x * TILE, dy = b.door.y * TILE;
    g.fillStyle = '#6d4c41'; g.fillRect(dx + 6, dy + 2, TILE - 12, TILE - 2);
    g.fillStyle = '#ffd400'; g.fillRect(dx + TILE - 12, dy + 16, 3, 3);
    // rótulo
    if (b.label) {
      g.font = 'bold 13px "Russo One", sans-serif';
      const tw = g.measureText(b.label).width + 14;
      const lx = x + w / 2 - tw / 2, ly = roofY + (h - wallH) / 2 - 10;
      g.fillStyle = 'rgba(10,20,40,0.8)'; g.fillRect(lx, ly, tw, 20);
      g.strokeStyle = '#ffd400'; g.lineWidth = 1.5; g.strokeRect(lx, ly, tw, 20);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(b.label, x + w / 2, ly + 15);
    }
  }

  lookOfNpc(n) {
    if (!this.looks.has(n.id)) {
      if (n.templateId) {
        try { this.looks.set(n.id, { ...lookFor(getPlayerTemplate(n.templateId)), shirt: null }); } catch { this.looks.set(n.id, n.look); }
      } else this.looks.set(n.id, { eyes: '#333', ...n.look });
    }
    return this.looks.get(n.id);
  }

  draw(world, avatarLook, dt) {
    this.time += dt;
    const { ctx, canvas } = this;
    const map = world.map;
    if (this.layerMap !== map) this.buildLayer(map);
    // Zoom adaptativo: muestra ~200 casillas en cualquier proporción de pantalla
    // (vertical, horizontal, tablet o escritorio), con un mínimo legible.
    const scale = Math.max(1, Math.sqrt((canvas.width * canvas.height) / (TILE * TILE * 200)));
    const p = world.player;
    const vw = canvas.width / scale, vh = canvas.height / scale;
    let camX = (p.px + 0.5) * TILE - vw / 2;
    let camY = (p.py + 0.5) * TILE - vh / 2;
    camX = Math.max(0, Math.min(map.w * TILE - vw, camX));
    camY = Math.max(0, Math.min(map.h * TILE - vh, camY));
    if (map.w * TILE < vw) camX = (map.w * TILE - vw) / 2;
    if (map.h * TILE < vh) camY = (map.h * TILE - vh) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, -Math.round(camX * scale), -Math.round(camY * scale));
    ctx.drawImage(this.layer, 0, 0);
    // agua animada (solo casillas visibles)
    const x0 = Math.max(0, Math.floor(camX / TILE)), y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(map.w, Math.ceil((camX + vw) / TILE) + 1), y1 = Math.min(map.h, Math.ceil((camY + vh) / TILE) + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (map.get(x, y) === T.WATER) {
        const o = Math.sin(this.time * 2 + x * 0.7 + y) * 6;
        ctx.fillRect(x * TILE + 8 + o, y * TILE + 10 + ((x * 7) % 12), 10, 2);
      }
    }
    // objetos
    for (const it of world.items()) {
      const s = 4 + Math.sin(this.time * 5) * 1.5;
      ctx.fillStyle = '#ffd400';
      ctx.beginPath(); ctx.arc(it.x * TILE + 16, it.y * TILE + 18, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(it.x * TILE + 14, it.y * TILE + 16, s * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // entidades ordenadas por y
    const ents = world.npcs().filter((n) => !n.invisible).map((n) => ({ n, y: n.y }));
    ents.push({ player: true, y: p.py });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.player) {
        const frame = p.moving ? (p.t % 1) : 0;
        drawChibi(ctx, (p.px + 0.5) * TILE, (p.py + 1) * TILE - 3, avatarLook, { dir: p.dir, frame, jersey: avatarLook.shirt || '#1565ff', jersey2: '#ffd400' });
      } else {
        const n = e.n;
        const look = this.lookOfNpc(n);
        drawChibi(ctx, (n.x + 0.5) * TILE, (n.y + 1) * TILE - 3, look, { dir: n.dir || 'down', jersey: look.shirt || (n.templateId ? '#455a64' : '#607d8b'), jersey2: '#eceff1' });
        if (n.lead || (n.templateId && n.script?.some?.((c) => c.challenge || c.quest))) {
          ctx.fillStyle = n.lead ? '#3fc35b' : '#ffd400';
          const by = n.y * TILE - 22 + Math.sin(this.time * 4) * 2;
          ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(n.lead ? '★' : '!', (n.x + 0.5) * TILE, by);
        }
      }
    }
    // hierba alta delante de los pies del jugador
    if (map.get(p.x, p.y) === T.TALL && !p.moving) {
      ctx.fillStyle = shade(this.theme.grass, -45);
      for (let i = 0; i < 4; i++) {
        const bx = p.x * TILE + 4 + i * 7, by = p.y * TILE + 32;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 3, by - 12 + Math.sin(this.time * 4 + i) * 2); ctx.lineTo(bx + 6, by); ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
