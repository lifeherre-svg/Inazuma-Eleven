// Modelo de instancia de jugador (lo que se guarda en la partida) y todas
// las reglas de progresión: estadísticas efectivas, experiencia, niveles,
// aprendizaje y mejora de técnicas, equipamiento y fatiga.

import { STATS, RARITY, PROGRESSION, FATIGUE } from '../config.js';
import { PERSONALITIES } from '../data/personalities.js';
import { getPlayerTemplate, getTechnique, getItem } from './database.js';

let uidCounter = 0;
export function makeUid(prefix = 'p') {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** XP total necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level) {
  return Math.round(PROGRESSION.xpBase * Math.pow(level, PROGRESSION.xpExponent));
}

/** Crea una instancia de jugador a partir de una plantilla. */
export function createPlayer(templateId, level = 1, opts = {}) {
  const t = getPlayerTemplate(templateId);
  const lvl = Math.max(1, Math.min(PROGRESSION.maxLevel, Math.round(level)));
  const player = {
    uid: opts.uid || makeUid(),
    templateId,
    level: lvl,
    xp: 0,
    trained: Object.fromEntries(STATS.map((s) => [s, 0])),
    techniques: [],
    equipment: { boots: null, gloves: null, accessory: null },
    fatigue: 0,
    friendship: 0,
    nickname: null,
    joinedAt: opts.joinedAt ?? null,
    matches: 0,
    goals: 0,
  };
  for (const entry of t.learnset) {
    if (entry.level <= lvl) addTechnique(player, entry.tech);
  }
  return player;
}

export function template(player) { return getPlayerTemplate(player.templateId); }
export function displayName(player) {
  const t = template(player);
  return player.nickname || `${t.name} ${t.surname}`;
}
export function shortName(player) { return template(player).surname; }

/** Estadística sin equipamiento: base * rareza * crecimiento por nivel + entrenamiento. */
export function rawStat(player, stat) {
  const t = template(player);
  const r = RARITY[t.rarity];
  const growth = 1 + (player.level - 1) * PROGRESSION.growthPerLevel * r.growthMul;
  const pers = PERSONALITIES[t.personality]?.bonus?.[stat] ?? 1;
  return Math.round(t.base[stat] * r.statMul * growth * pers) + (player.trained[stat] || 0);
}

export function equipmentBonus(player, stat) {
  let bonus = 0;
  for (const itemId of Object.values(player.equipment || {})) {
    if (!itemId) continue;
    bonus += getItem(itemId).bonus?.[stat] ?? 0;
  }
  return bonus;
}

/** Estadísticas efectivas (incluye equipamiento y penalización por fatiga). */
export function effectiveStats(player, { applyFatigue = true } = {}) {
  const fatigueMul = applyFatigue && player.fatigue > FATIGUE.penaltyThreshold
    ? 1 - (player.fatigue - FATIGUE.penaltyThreshold) / 250
    : 1;
  const out = {};
  for (const s of STATS) out[s] = Math.max(1, Math.round((rawStat(player, s) + equipmentBonus(player, s)) * fatigueMul));
  return out;
}

export function overall(player) {
  const s = effectiveStats(player, { applyFatigue: false });
  const pos = template(player).position;
  const w = {
    GK: { defense: 3, physical: 2, technique: 1, control: 1 },
    DF: { defense: 3, physical: 2, speed: 1, control: 1 },
    MF: { control: 2, dribble: 2, technique: 2, speed: 1, shoot: 1 },
    FW: { shoot: 3, dribble: 2, speed: 2, technique: 1 },
  }[pos];
  let sum = 0, tw = 0;
  for (const [k, v] of Object.entries(w)) { sum += s[k] * v; tw += v; }
  return Math.round(sum / tw);
}

export function maxTp(player) {
  const s = effectiveStats(player, { applyFatigue: false });
  return Math.round(40 + s.technique * 0.6 + player.level * 1.2);
}

// ---------------------------------------------------------------- Experiencia

/** Añade experiencia y procesa subidas de nivel. Devuelve un informe. */
export function gainXp(player, amount) {
  const t = template(player);
  const report = { levelsGained: 0, learned: [], fromLevel: player.level };
  if (player.level >= PROGRESSION.maxLevel) return report;
  player.xp += Math.max(0, Math.round(amount * RARITY[t.rarity].xpMul));
  while (player.level < PROGRESSION.maxLevel && player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    report.levelsGained++;
    for (const entry of t.learnset) {
      if (entry.level === player.level && !hasTechnique(player, entry.tech)) {
        if (addTechnique(player, entry.tech)) report.learned.push(entry.tech);
      }
    }
  }
  if (player.level >= PROGRESSION.maxLevel) player.xp = 0;
  return report;
}

// ---------------------------------------------------------------- Técnicas

export function hasTechnique(player, techId) {
  return player.techniques.some((t) => t.id === techId);
}

export function getPlayerTech(player, techId) {
  return player.techniques.find((t) => t.id === techId) || null;
}

/** Comprueba requisitos para aprender una técnica. Devuelve {ok, reason}. */
export function canLearn(player, techId) {
  const tech = getTechnique(techId);
  const t = template(player);
  if (hasTechnique(player, techId)) return { ok: false, reason: 'Ya conoce esta técnica.' };
  const req = tech.requires || {};
  if (req.level && player.level < req.level) return { ok: false, reason: `Requiere nivel ${req.level}.` };
  if (req.positions && !req.positions.includes(t.position)) return { ok: false, reason: 'Posición incompatible.' };
  if (req.element && req.element !== t.element) return { ok: false, reason: 'Elemento incompatible.' };
  if (tech.category === 'keeper' && t.position !== 'GK') return { ok: false, reason: 'Solo para porteros.' };
  if (req.stats) {
    const s = effectiveStats(player, { applyFatigue: false });
    for (const [k, v] of Object.entries(req.stats)) {
      if (s[k] < v) return { ok: false, reason: `Requiere ${k === 'shoot' ? 'Tiro' : k} ${v}.` };
    }
  }
  return { ok: true, reason: '' };
}

/** Añade una técnica (sin comprobar requisitos de stats: lo usa el learnset). */
export function addTechnique(player, techId) {
  getTechnique(techId); // valida
  if (hasTechnique(player, techId)) return false;
  player.techniques.push({ id: techId, level: 1, xp: 0, equipped: equippedCount(player) < PROGRESSION.maxTechniques });
  return true;
}

export function equippedCount(player) {
  return player.techniques.filter((t) => t.equipped).length;
}

export function toggleEquipTechnique(player, techId) {
  const pt = getPlayerTech(player, techId);
  if (!pt) return false;
  if (!pt.equipped && equippedCount(player) >= PROGRESSION.maxTechniques) return false;
  pt.equipped = !pt.equipped;
  return true;
}

export function equippedTechniques(player) {
  return player.techniques.filter((t) => t.equipped);
}

/** Experiencia de técnica; sube de nivel (máx. 5). Devuelve niveles ganados. */
export function gainTechXp(player, techId, amount) {
  const pt = getPlayerTech(player, techId);
  if (!pt || pt.level >= PROGRESSION.techMaxLevel) return 0;
  pt.xp += amount;
  let gained = 0;
  while (pt.level < PROGRESSION.techMaxLevel && pt.xp >= PROGRESSION.techXpPerLevel * pt.level) {
    pt.xp -= PROGRESSION.techXpPerLevel * pt.level;
    pt.level++;
    gained++;
  }
  if (pt.level >= PROGRESSION.techMaxLevel) pt.xp = 0;
  return gained;
}

/** Potencia real de una técnica según su nivel de mejora. */
export function techPower(techId, techLevel = 1) {
  const t = getTechnique(techId);
  return Math.round(t.power * (1 + PROGRESSION.techPowerPerLevel * (techLevel - 1)));
}

export const TECH_LEVEL_LABEL = ['', 'Nv.1', 'Nv.2', 'Nv.3', 'Nv.4', 'MAX'];

// ---------------------------------------------------------------- Equipamiento

export function equipItem(player, itemId) {
  const item = getItem(itemId);
  if (item.type !== 'equipment') throw new Error('No es equipamiento');
  const previous = player.equipment[item.slot] || null;
  player.equipment[item.slot] = itemId;
  return previous;
}

export function unequipSlot(player, slot) {
  const prev = player.equipment[slot] || null;
  player.equipment[slot] = null;
  return prev;
}

// ---------------------------------------------------------------- Fatiga

export function addFatigue(player, amount) {
  player.fatigue = Math.max(0, Math.min(FATIGUE.max, player.fatigue + amount));
}

export function fatigueLabel(f) {
  if (f < 25) return { label: 'En forma', color: '#4cc96b' };
  if (f < 50) return { label: 'Cansado', color: '#f2c94c' };
  if (f < 80) return { label: 'Agotado', color: '#ff9f43' };
  return { label: 'Exhausto', color: '#ff4d6d' };
}
