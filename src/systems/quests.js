// Sistema de misiones dirigido por eventos.
// Las misiones se definen en data/quests.js; su progreso se actualiza
// escuchando el EventBus, de modo que ningún sistema necesita conocerlas.

import { QUESTS, QUEST_MAP } from '../data/quests.js';
import { EVT } from '../core/events.js';
import { itemCount, giveItem } from './inventory.js';
import { addMoney, addPlayerToRoster, setFlag, hasFlag, getPlayer, pushLog } from './game-state.js';
import { gainXp } from './player.js';

export function getQuest(id) {
  const q = QUEST_MAP[id];
  if (!q) throw new Error(`Misión desconocida: ${id}`);
  return q;
}

export function isQuestActive(state, id) { return !!state.quests.active[id]; }
export function isQuestDone(state, id) { return state.quests.completed.includes(id); }

export function startQuest(game, id) {
  const { state } = game;
  getQuest(id);
  if (isQuestActive(state, id) || isQuestDone(state, id)) return false;
  state.quests.active[id] = { progress: getQuest(id).objectives.map(() => 0) };
  game.bus.emit(EVT.QUEST_STARTED, { id });
  checkQuest(game, id);
  return true;
}

/** Objetivos de estado (no basados en eventos) se evalúan al comprobar. */
function stateProgress(state, obj) {
  switch (obj.type) {
    case 'rosterSize': return state.roster.length;
    case 'item': return itemCount(state, obj.item);
    case 'level': return Math.max(0, ...state.roster.map((p) => p.level));
    case 'flag': return hasFlag(state, obj.flag) ? 1 : 0;
    case 'seen': return state.encyclopedia.seen.length;
    case 'recruitTotal': return state.encyclopedia.recruited.length;
    case 'own': return state.roster.some((p) => p.templateId === obj.player) ? 1 : 0;
    default: return null;
  }
}

export function objectiveTarget(obj) { return obj.count ?? 1; }

export function questProgress(state, id) {
  const q = getQuest(id);
  const entry = state.quests.active[id];
  return q.objectives.map((obj, i) => {
    const sp = stateProgress(state, obj);
    const value = sp !== null ? sp : entry ? entry.progress[i] : isQuestDone(state, id) ? objectiveTarget(obj) : 0;
    return { obj, value: Math.min(value, objectiveTarget(obj)), target: objectiveTarget(obj), done: value >= objectiveTarget(obj) };
  });
}

export function checkQuest(game, id) {
  const { state } = game;
  if (!isQuestActive(state, id)) return false;
  const prog = questProgress(state, id);
  if (prog.every((p) => p.done)) {
    completeQuest(game, id);
    return true;
  }
  return false;
}

export function completeQuest(game, id) {
  const { state } = game;
  const q = getQuest(id);
  delete state.quests.active[id];
  if (!state.quests.completed.includes(id)) state.quests.completed.push(id);
  const r = q.rewards || {};
  if (r.money) addMoney(game, r.money);
  for (const [item, qty] of Object.entries(r.items || {})) giveItem(game, item, qty);
  if (r.xp) for (const uid of state.team.lineup.filter(Boolean)) gainXp(getPlayer(state, uid), r.xp);
  if (r.player) addPlayerToRoster(game, r.player.id, r.player.level, 'misión');
  for (const f of r.flags || []) setFlag(game, f);
  pushLog(state, `Misión completada: ${q.name}`);
  game.bus.emit(EVT.QUEST_COMPLETED, { id, name: q.name, rewards: r });
  for (const next of r.startQuests || []) startQuest(game, next);
}

function bump(game, predicate, amount = 1) {
  const { state } = game;
  for (const id of Object.keys(state.quests.active)) {
    const q = getQuest(id);
    const entry = state.quests.active[id];
    q.objectives.forEach((obj, i) => { if (predicate(obj)) entry.progress[i] += amount; });
    checkQuest(game, id);
  }
}

/** Conecta el sistema de misiones al bus de eventos. Devuelve función de desconexión. */
export function attachQuestSystem(game) {
  const offs = [
    game.bus.on(EVT.MATCH_END, ({ opponentId, outcome }) => {
      if (outcome === 'win') bump(game, (o) => (o.type === 'defeat' && (o.team === opponentId || o.team === '*')));
      bump(game, (o) => o.type === 'play');
    }),
    game.bus.on(EVT.RECRUITED, ({ templateId }) => bump(game, (o) => o.type === 'recruit' || (o.type === 'recruitId' && o.player === templateId))),
    game.bus.on(EVT.TRAINED, () => bump(game, (o) => o.type === 'train')),
    game.bus.on(EVT.TALKED, ({ npc }) => bump(game, (o) => o.type === 'talk' && o.npc === npc)),
    game.bus.on(EVT.ENTER_MAP, ({ map }) => bump(game, (o) => o.type === 'visit' && o.map === map)),
    game.bus.on(EVT.ENCOUNTER_WON, () => bump(game, (o) => o.type === 'encounters')),
    game.bus.on(EVT.TOURNAMENT_WON, ({ id }) => bump(game, (o) => o.type === 'tournament' && o.id === id)),
    game.bus.on(EVT.TECH_LEARNED, () => bump(game, (o) => o.type === 'learnTech')),
    // Objetivos de estado: revisar ante cualquier cambio relevante.
    game.bus.on(EVT.FLAG_SET, () => bump(game, () => false)),
    game.bus.on(EVT.ITEM_GAINED, () => bump(game, () => false)),
    game.bus.on(EVT.LEVEL_UP, ({ report }) => bump(game, (o) => o.type === 'learnTech', report?.learned?.length || 0)),
    game.bus.on(EVT.SEEN, () => bump(game, () => false)),
  ];
  // Misiones que empiezan automáticamente cuando se cumplen sus requisitos.
  const autoStart = () => {
    for (const q of QUESTS) {
      if (!q.autoStart || isQuestActive(game.state, q.id) || isQuestDone(game.state, q.id)) continue;
      if (q.requires?.flag && !hasFlag(game.state, q.requires.flag)) continue;
      startQuest(game, q.id);
    }
  };
  offs.push(game.bus.on(EVT.FLAG_SET, autoStart));
  autoStart();
  return () => offs.forEach((off) => off());
}

export function activeQuests(state) {
  return Object.keys(state.quests.active).map((id) => ({ quest: getQuest(id), progress: questProgress(state, id) }));
}
