// Sistema de guardado fiable.
//  - 3 ranuras manuales + 1 de autoguardado.
//  - Cada escritura guarda una copia de seguridad de la versión anterior.
//  - Suma de verificación (checksum) para detectar corrupción; si la ranura
//    está dañada se recupera automáticamente la copia de seguridad.
//  - Migraciones entre versiones del formato.
//  - Exportación / importación a JSON.
//  - El almacenamiento es inyectable (localStorage en el navegador, memoria en tests).

import { GAME, DEFAULT_SETTINGS, STATS } from '../config.js';
import { hashString } from '../core/rng.js';
import { hasPlayerTemplate } from './database.js';

export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
const PREFIX = 'ul_save_';

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

export function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const k = '__ul_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return localStorage;
    }
  } catch { /* almacenamiento bloqueado */ }
  return new MemoryStorage();
}

function checksum(str) { return hashString(str).toString(36); }

/** Migraciones: cada función recibe el estado de la versión N y devuelve N+1. */
const MIGRATIONS = {
  // 0 -> 1: partidas antiguas sin ajustes completos ni enciclopedia.
  0: (s) => ({ ...s, version: 1, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) }, encyclopedia: s.encyclopedia || { seen: [], recruited: [] } }),
};

export function migrate(state) {
  let s = state;
  let v = s.version ?? 0;
  while (v < GAME.saveVersion) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No hay migración desde la versión ${v}`);
    s = m(s);
    v = s.version;
  }
  return s;
}

/** Valida la estructura mínima y repara campos ausentes. Lanza error si es irrecuperable. */
export function validateState(state) {
  if (!state || typeof state !== 'object') throw new Error('Partida vacía');
  for (const key of ['profile', 'roster', 'team', 'inventory', 'quests', 'flags', 'location']) {
    if (!(key in state)) throw new Error(`Falta el campo "${key}"`);
  }
  if (!Array.isArray(state.roster)) throw new Error('Plantilla inválida');
  // Eliminar jugadores cuyo id ya no existe en la base de datos (contenido retirado).
  state.roster = state.roster.filter((p) => p && hasPlayerTemplate(p.templateId));
  for (const p of state.roster) {
    p.trained = { ...Object.fromEntries(STATS.map((s) => [s, 0])), ...(p.trained || {}) };
    p.techniques = Array.isArray(p.techniques) ? p.techniques : [];
    p.equipment = { boots: null, gloves: null, accessory: null, ...(p.equipment || {}) };
    p.fatigue = Number.isFinite(p.fatigue) ? p.fatigue : 0;
  }
  const uids = new Set(state.roster.map((p) => p.uid));
  state.team.lineup = (state.team.lineup || []).slice(0, 11).map((u) => (uids.has(u) ? u : null));
  while (state.team.lineup.length < 11) state.team.lineup.push(null);
  state.team.bench = [...uids].filter((u) => !state.team.lineup.includes(u));
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  state.scout = state.scout || { leads: [] };
  state.tournaments = state.tournaments || {};
  state.defeatedTeams = state.defeatedTeams || {};
  state.story = state.story || { chapter: 0 };
  state.log = state.log || [];
  return state;
}

export class SaveManager {
  constructor(storage = defaultStorage()) { this.storage = storage; }

  key(slot) {
    if (!SLOTS.includes(slot)) throw new Error(`Ranura inválida: ${slot}`);
    return PREFIX + slot;
  }

  save(slot, state) {
    const data = JSON.stringify(state);
    const envelope = JSON.stringify({
      version: GAME.saveVersion,
      savedAt: Date.now(),
      checksum: checksum(data),
      meta: {
        name: state.profile?.name,
        chapter: state.story?.chapter ?? 0,
        playtime: Math.round(state.playtime || 0),
        players: state.roster?.length || 0,
        map: state.location?.map,
        money: state.money,
      },
      data,
    });
    const k = this.key(slot);
    const prev = this.storage.getItem(k);
    try {
      if (prev) this.storage.setItem(k + '_bak', prev);
      this.storage.setItem(k, envelope);
    } catch (err) {
      return { ok: false, error: `No se pudo guardar: ${err.message}` };
    }
    return { ok: true };
  }

  parseEnvelope(raw) {
    const env = JSON.parse(raw);
    if (checksum(env.data) !== env.checksum) throw new Error('Checksum inválido (partida dañada)');
    const state = validateState(migrate(JSON.parse(env.data)));
    return { env, state };
  }

  /** Carga una ranura; si está dañada intenta la copia de seguridad. */
  load(slot) {
    const k = this.key(slot);
    const raw = this.storage.getItem(k);
    if (!raw) return { ok: false, error: 'Ranura vacía' };
    try {
      return { ok: true, ...this.parseEnvelope(raw), recovered: false };
    } catch (err) {
      const bak = this.storage.getItem(k + '_bak');
      if (bak) {
        try {
          const r = this.parseEnvelope(bak);
          this.storage.setItem(k, bak);
          return { ok: true, ...r, recovered: true, warning: `Partida dañada (${err.message}); se ha recuperado la copia de seguridad.` };
        } catch { /* sin recuperación */ }
      }
      return { ok: false, error: `No se pudo cargar: ${err.message}` };
    }
  }

  meta(slot) {
    const raw = this.storage.getItem(this.key(slot));
    if (!raw) return null;
    try {
      const env = JSON.parse(raw);
      return { slot, savedAt: env.savedAt, ...env.meta, corrupt: checksum(env.data) !== env.checksum };
    } catch {
      return { slot, corrupt: true };
    }
  }

  listSlots() { return SLOTS.map((s) => ({ slot: s, meta: this.meta(s) })); }

  remove(slot) {
    this.storage.removeItem(this.key(slot));
    this.storage.removeItem(this.key(slot) + '_bak');
  }

  hasAnySave() { return SLOTS.some((s) => this.meta(s)); }

  latestSlot() {
    return SLOTS.map((s) => this.meta(s)).filter((m) => m && !m.corrupt).sort((a, b) => b.savedAt - a.savedAt)[0]?.slot || null;
  }

  exportSlot(slot) {
    const raw = this.storage.getItem(this.key(slot));
    if (!raw) throw new Error('Ranura vacía');
    return raw;
  }

  importToSlot(slot, raw) {
    const { state } = this.parseEnvelope(raw);
    return this.save(slot, state);
  }
}
