// Lógica del mundo explorable (sin DOM): movimiento por casillas con
// interpolación, colisiones, NPC, objetos, puertas, transiciones de mapa,
// encuentros en hierba alta y NPC que retan al verte.

import { MAP_SPECS } from '../data/maps.js';
import { buildMap } from './map-builder.js';
import { T } from './tiles.js';
import { evalCond } from '../systems/script.js';
import { ENCOUNTER } from '../config.js';
import { EVT } from '../core/events.js';
import { setFlag, hasFlag } from '../systems/game-state.js';
import { getPlayerTemplate } from '../systems/database.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const mapCache = new Map();

export function getMap(id) {
  if (!mapCache.has(id)) {
    const spec = MAP_SPECS[id];
    if (!spec) throw new Error(`Mapa desconocido: ${id}`);
    mapCache.set(id, buildMap(spec));
  }
  return mapCache.get(id);
}

export class World {
  constructor(game) {
    this.game = game;
    this.moveTime = 0.16;     // segundos por casilla (andando)
    this.runTime = 0.1;
    this.player = { x: 0, y: 0, px: 0, py: 0, dir: 'down', moving: false, t: 0, fromX: 0, fromY: 0, steps: 0 };
    this.grace = ENCOUNTER.graceSteps;
    this.npcOffsets = new Map();
    this.load(game.state.location.map, game.state.location.x, game.state.location.y, game.state.location.dir);
  }

  get state() { return this.game.state; }

  load(mapId, x, y, dir = 'down') {
    this.map = getMap(mapId);
    const p = this.player;
    // Si la posición no es transitable (p.ej. datos antiguos), usar el spawn.
    if (x === undefined || this.map.isSolid(x, y)) { x = this.map.spawn.x; y = this.map.spawn.y; }
    Object.assign(p, { x, y, px: x, py: y, dir, moving: false, t: 0 });
    this.state.location = { map: mapId, x, y, dir };
    this.npcOffsets.clear();
    if (!hasFlag(this.state, `visited_${mapId}`)) setFlag(this.game, `visited_${mapId}`);
    this.game.bus.emit(EVT.ENTER_MAP, { map: mapId });
  }

  /** NPC visibles en el mapa actual (incluye pistas de ojeador). */
  npcs() {
    const st = this.state;
    const list = this.map.npcs.filter((n) => (!n.showIf || evalCond(st, n.showIf)) && (!n.hideIf || !evalCond(st, n.hideIf)));
    for (const lead of st.scout.leads.filter((l) => l.map === this.map.id)) {
      const t = getPlayerTemplate(lead.templateId);
      list.push({
        id: `lead_${lead.templateId}`, name: `${t.name} ${t.surname}`, x: lead.x, y: lead.y, dir: 'down', templateId: lead.templateId, lead,
        script: [
          { say: `Mis ojeadores me han hablado de ti, entrenador. Veamos si tu equipo está a mi altura.` },
          { open: 'leadChallenge', templateId: lead.templateId, level: lead.level },
        ],
      });
    }
    return list.map((n) => {
      const off = this.npcOffsets.get(n.id);
      return off ? { ...n, x: n.x + off.x, y: n.y + off.y } : n;
    });
  }

  items() {
    return (this.map.items || []).filter((it) => !hasFlag(this.state, it.flag));
  }

  npcAt(x, y) { return this.npcs().find((n) => n.x === x && n.y === y) || null; }

  isBlocked(x, y) {
    if (this.map.isSolid(x, y)) return true;
    const n = this.npcAt(x, y);
    return !!(n && !n.invisible);
  }

  facingTile() {
    const [dx, dy] = DIRS[this.player.dir];
    return { x: this.player.x + dx, y: this.player.y + dy };
  }

  /**
   * Avanza el mundo. input: { dir: 'up'|'down'|'left'|'right'|null, run }
   * Devuelve un evento de mundo o null:
   *  { type: 'warp', warp } | { type: 'locked', text } | { type: 'encounter' }
   *  { type: 'item', item } | { type: 'sight', npc }
   */
  update(dt, input) {
    const p = this.player;
    if (p.moving) {
      p.t += dt / (input?.run ? this.runTime : this.moveTime);
      if (p.t >= 1) {
        p.moving = false;
        p.px = p.x; p.py = p.y;
        this.state.location = { map: this.map.id, x: p.x, y: p.y, dir: p.dir };
        return this.onArrive();
      }
      p.px = p.fromX + (p.x - p.fromX) * p.t;
      p.py = p.fromY + (p.y - p.fromY) * p.t;
      return null;
    }
    if (input?.dir) {
      p.dir = input.dir;
      const [dx, dy] = DIRS[input.dir];
      const nx = p.x + dx, ny = p.y + dy;
      const warp = this.warpAt(nx, ny);
      if (warp) {
        if (warp.requires && !evalCond(this.state, warp.requires)) return { type: 'locked', text: warp.locked || 'No puedes pasar todavía.' };
        return { type: 'warp', warp };
      }
      if (!this.isBlocked(nx, ny) && nx >= 0 && ny >= 0 && nx < this.map.w && ny < this.map.h) {
        p.fromX = p.x; p.fromY = p.y;
        p.x = nx; p.y = ny;
        p.moving = true; p.t = 0;
      }
    }
    return null;
  }

  warpAt(x, y) {
    return (this.map.warps || []).find((w) => x >= w.x && x < w.x + (w.w || 1) && y >= w.y && y < w.y + (w.h || 1)) || null;
  }

  onArrive() {
    const p = this.player;
    p.steps++;
    this.grace = Math.max(0, this.grace - 1);
    // Objetos en el suelo
    const item = this.items().find((it) => it.x === p.x && it.y === p.y);
    if (item) return { type: 'item', item };
    // NPC que te ven
    const sight = this.checkSight();
    if (sight) return { type: 'sight', npc: sight };
    // Hierba alta
    if (this.map.get(p.x, p.y) === T.TALL && this.grace <= 0 && this.game.rng.chance(ENCOUNTER.stepChance)) {
      const pick = this.rollEncounter();
      if (pick) { this.grace = ENCOUNTER.graceSteps; return { type: 'encounter', ...pick }; }
    }
    return null;
  }

  rollEncounter() {
    const pool = (this.map.encounters?.pool || []).filter((e) => !e.requires || evalCond(this.state, e.requires));
    if (!pool.length) return null;
    const e = this.game.rng.weighted(pool, (x) => x.w);
    return { templateId: e.id, level: this.game.rng.int(e.min, e.max) };
  }

  checkSight() {
    const p = this.player;
    for (const n of this.npcs()) {
      if (!n.sight || (n.sightFlag && hasFlag(this.state, n.sightFlag))) continue;
      if (hasFlag(this.state, `seen_${n.id}`)) continue;
      const [dx, dy] = DIRS[n.dir || 'down'];
      for (let i = 1; i <= n.sight; i++) {
        const tx = n.x + dx * i, ty = n.y + dy * i;
        if (this.map.isSolid(tx, ty)) break;
        if (tx === p.x && ty === p.y) return n;
      }
    }
    return null;
  }

  /** Interacción con lo que hay delante. Devuelve el NPC o null. */
  interact() {
    const f = this.facingTile();
    const n = this.npcAt(f.x, f.y);
    if (n && !n.invisible) {
      // El NPC se gira hacia el jugador.
      const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
      n.dir = opposite[this.player.dir];
    }
    return n;
  }

  pickItem(item) {
    setFlag(this.game, item.flag);
  }

  /** Movimiento cinemático de un NPC (offsets acumulados). */
  moveNpc(id, path) {
    const cur = this.npcOffsets.get(id) || { x: 0, y: 0 };
    for (const [dx, dy] of path) { cur.x += dx; cur.y += dy; }
    this.npcOffsets.set(id, cur);
  }
}

/** Mapas visitados (viaje rápido). */
export function visitedMaps(state) {
  return Object.values(MAP_SPECS).filter((m) => state.flags[`visited_${m.id}`]);
}

export { DIRS };
