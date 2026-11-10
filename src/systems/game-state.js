// Estado global de la partida y contexto de juego.
//
// `game` = { state, bus, rng } es el contexto que reciben todos los sistemas.
// `state` es un objeto JSON puro (serializable) que el sistema de guardado
// persiste tal cual.

import { GAME, DEFAULT_SETTINGS } from '../config.js';
import { EventBus, EVT } from '../core/events.js';
import { RNG } from '../core/rng.js';
import { INITIAL_CLUB_IDS, STARTER_IDS } from '../data/players.js';
import { COACH_MAP, AVATAR_PRESETS } from '../data/coaches.js';
import { createPlayer, template } from './player.js';
import { autoLineup } from './team.js';
import { addItem } from './inventory.js';

export function createGameContext(state, { seed } = {}) {
  return { state, bus: new EventBus(), rng: new RNG(seed ?? Date.now()) };
}

/** Crea el estado inicial de una nueva partida. */
export function createNewState({ name = 'Entrenador', coachId = 'estratega', avatar = 0, starterId = STARTER_IDS[0] } = {}) {
  if (!COACH_MAP[coachId]) throw new Error(`Entrenador desconocido: ${coachId}`);
  if (!STARTER_IDS.includes(starterId)) throw new Error(`Jugador inicial no válido: ${starterId}`);
  const state = {
    version: GAME.saveVersion,
    createdAt: Date.now(),
    profile: { name: String(name).slice(0, 16) || 'Entrenador', coachId, avatar: AVATAR_PRESETS[avatar] ? avatar : 0 },
    money: GAME.startingMoney,
    playtime: 0,
    day: 1,
    flags: {},
    location: { map: 'villa_rayo', x: 12, y: 15, dir: 'down' },
    roster: [],
    team: {
      formationId: 'f442',
      lineup: Array(11).fill(null),
      bench: [],
      captain: null,
      strategy: { offense: 'posesion', defense: 'bloque', style: 'equilibrado' },
      presets: [],
    },
    inventory: { items: {} },
    quests: { active: {}, completed: [] },
    tournaments: {},
    story: { chapter: 0 },
    scout: { leads: [] },
    encyclopedia: { seen: [], recruited: [] },
    defeatedTeams: {},
    stats: { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, recruited: 0, trainings: 0, encounters: 0 },
    settings: { ...DEFAULT_SETTINGS },
    log: [],
  };
  for (const id of INITIAL_CLUB_IDS) state.roster.push(createPlayer(id, 3, { joinedAt: 0 }));
  const starter = createPlayer(starterId, 5, { joinedAt: 0 });
  state.roster.push(starter);
  state.team.captain = starter.uid;
  state.encyclopedia.seen.push(...INITIAL_CLUB_IDS, starterId);
  state.encyclopedia.recruited.push(...INITIAL_CLUB_IDS, starterId);
  autoLineup(state);
  addItem(state, 'carta_invitacion', 5);
  addItem(state, 'bebida_isotonica', 3);
  return state;
}

export function getPlayer(state, uid) {
  return state.roster.find((p) => p.uid === uid) || null;
}

export function ownsTemplate(state, templateId) {
  return state.roster.some((p) => p.templateId === templateId);
}

export function setFlag(game, flag, value = true) {
  game.state.flags[flag] = value;
  game.bus.emit(EVT.FLAG_SET, { flag, value });
}

export function hasFlag(state, flag) { return !!state.flags[flag]; }

export function addMoney(game, amount) {
  game.state.money = Math.max(0, game.state.money + Math.round(amount));
  game.bus.emit(EVT.MONEY, { amount, total: game.state.money });
}

export function spendMoney(game, amount) {
  if (game.state.money < amount) return false;
  addMoney(game, -amount);
  return true;
}

export function markSeen(game, templateId) {
  const enc = game.state.encyclopedia;
  if (!enc.seen.includes(templateId)) {
    enc.seen.push(templateId);
    game.bus.emit(EVT.SEEN, { templateId });
  }
}

/** Añade un jugador a la plantilla (reclutamiento, recompensas...). */
export function addPlayerToRoster(game, templateId, level, source = 'recruit') {
  const { state } = game;
  if (ownsTemplate(state, templateId)) return { ok: false, reason: 'Ya está en tu equipo.' };
  if (state.roster.length >= GAME.maxRoster) return { ok: false, reason: 'La plantilla está llena.' };
  const p = createPlayer(templateId, level, { joinedAt: state.day });
  state.roster.push(p);
  state.team.bench.push(p.uid);
  markSeen(game, templateId);
  if (!state.encyclopedia.recruited.includes(templateId)) state.encyclopedia.recruited.push(templateId);
  state.stats.recruited++;
  // Si faltan titulares, el nuevo entra directamente al once.
  const empty = state.team.lineup.indexOf(null);
  if (empty >= 0) autoLineup(state);
  pushLog(state, `${template(p).name} ${template(p).surname} se une al equipo (${source}).`);
  game.bus.emit(EVT.RECRUITED, { templateId, uid: p.uid, source });
  return { ok: true, player: p };
}

export function releasePlayer(game, uid) {
  const { state } = game;
  if (state.roster.length <= 11) return { ok: false, reason: 'Necesitas al menos 11 jugadores.' };
  if (state.team.captain === uid) return { ok: false, reason: 'No puedes despedir al capitán.' };
  state.roster = state.roster.filter((p) => p.uid !== uid);
  state.team.lineup = state.team.lineup.map((u) => (u === uid ? null : u));
  state.team.bench = state.team.bench.filter((u) => u !== uid);
  autoLineup(state, { keepExisting: true });
  return { ok: true };
}

export function pushLog(state, text) {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 60) state.log.length = 60;
}

export function teamAverageLevel(state) {
  const ids = state.team.lineup.filter(Boolean);
  if (!ids.length) return 1;
  return Math.round(ids.reduce((s, u) => s + (getPlayer(state, u)?.level || 1), 0) / ids.length);
}
