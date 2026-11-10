// Gestión de equipo: formación, titulares, suplentes, capitán, estrategias
// y formaciones guardadas (presets).

import { getFormation } from './database.js';
import { template, overall } from './player.js';
import { OFFENSE_STRATEGIES, DEFENSE_STRATEGIES, PLAY_STYLES } from '../data/formations.js';

const findPlayer = (state, uid) => state.roster.find((p) => p.uid === uid);

/** Penalización por jugar fuera de posición. */
export function positionFit(playerPos, slotRole) {
  if (playerPos === slotRole) return 1;
  if (slotRole === 'GK' || playerPos === 'GK') return 0.6;
  const adj = { DF: ['MF'], MF: ['DF', 'FW'], FW: ['MF'] };
  return adj[playerPos]?.includes(slotRole) ? 0.9 : 0.8;
}

/**
 * Coloca automáticamente a los mejores jugadores en cada slot.
 * keepExisting: respeta los titulares ya colocados.
 */
export function autoLineup(state, { keepExisting = false } = {}) {
  const formation = getFormation(state.team.formationId);
  const lineup = keepExisting ? state.team.lineup.slice(0, 11) : Array(11).fill(null);
  while (lineup.length < 11) lineup.push(null);
  const used = new Set(lineup.filter(Boolean));
  const available = state.roster.filter((p) => !used.has(p.uid));
  const score = (p, role) => overall(p) * positionFit(template(p).position, role) - p.fatigue * 0.2;
  // Primero los slots con posición natural, de más restrictivo (GK) a menos.
  const order = formation.slots.map((s, i) => i).sort((a, b) => (formation.slots[a].role === 'GK' ? -1 : 0) - (formation.slots[b].role === 'GK' ? -1 : 0));
  for (const i of order) {
    if (lineup[i]) continue;
    const role = formation.slots[i].role;
    available.sort((a, b) => score(b, role) - score(a, role));
    const pick = available.shift();
    lineup[i] = pick ? pick.uid : null;
  }
  state.team.lineup = lineup;
  state.team.bench = state.roster.map((p) => p.uid).filter((u) => !lineup.includes(u));
  if (!state.team.captain || !findPlayer(state, state.team.captain)) state.team.captain = lineup.find(Boolean) || null;
  return lineup;
}

/** Coloca a un jugador en un slot; si estaba en otro slot o en el banquillo, intercambia. */
export function assignSlot(state, slotIndex, uid) {
  if (slotIndex < 0 || slotIndex > 10) throw new Error('Slot inválido');
  if (!findPlayer(state, uid)) throw new Error('Jugador no encontrado');
  const lineup = state.team.lineup;
  const current = lineup[slotIndex];
  const from = lineup.indexOf(uid);
  if (from >= 0) {
    lineup[from] = current;
  } else {
    state.team.bench = state.team.bench.filter((u) => u !== uid);
    if (current) state.team.bench.push(current);
  }
  lineup[slotIndex] = uid;
}

export function benchPlayer(state, slotIndex) {
  const uid = state.team.lineup[slotIndex];
  if (!uid) return;
  state.team.lineup[slotIndex] = null;
  state.team.bench.push(uid);
}

export function setFormation(state, formationId) {
  getFormation(formationId);
  state.team.formationId = formationId;
}

export function setCaptain(state, uid) {
  if (!findPlayer(state, uid)) throw new Error('Jugador no encontrado');
  state.team.captain = uid;
}

export function setStrategy(state, { offense, defense, style }) {
  if (offense && OFFENSE_STRATEGIES[offense]) state.team.strategy.offense = offense;
  if (defense && DEFENSE_STRATEGIES[defense]) state.team.strategy.defense = defense;
  if (style && PLAY_STYLES[style]) state.team.strategy.style = style;
}

export function validateLineup(state) {
  const filled = state.team.lineup.filter(Boolean);
  const errors = [];
  if (filled.length < 11) errors.push(`Faltan ${11 - filled.length} titulares (tienes ${state.roster.length} jugadores).`);
  const gkSlot = state.team.lineup[0];
  if (gkSlot && template(findPlayer(state, gkSlot)).position !== 'GK') errors.push('No hay un portero natural en la portería (penalización).');
  return { ok: filled.length === 11, errors };
}

export function savePreset(state, name) {
  const preset = {
    name: String(name || `Táctica ${state.team.presets.length + 1}`).slice(0, 20),
    formationId: state.team.formationId,
    lineup: state.team.lineup.slice(),
    captain: state.team.captain,
    strategy: { ...state.team.strategy },
  };
  state.team.presets = state.team.presets.filter((p) => p.name !== preset.name);
  state.team.presets.push(preset);
  if (state.team.presets.length > 5) state.team.presets.shift();
  return preset;
}

export function loadPreset(state, name) {
  const preset = state.team.presets.find((p) => p.name === name);
  if (!preset) return false;
  state.team.formationId = preset.formationId;
  // Solo jugadores que siguen en la plantilla.
  const valid = new Set(state.roster.map((p) => p.uid));
  state.team.lineup = preset.lineup.map((u) => (u && valid.has(u) ? u : null));
  state.team.captain = valid.has(preset.captain) ? preset.captain : state.team.captain;
  state.team.strategy = { ...preset.strategy };
  autoLineup(state, { keepExisting: true });
  return true;
}
