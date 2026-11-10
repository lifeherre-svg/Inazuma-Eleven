// Desafíos por turnos (encuentros en hierba alta, retos de agentes libres y
// pistas de ojeador). Estructura inspirada en los combates de un "PokeLike":
//  - Tu jugador activo intenta Regatear, Tirar o usar una Técnica para bajar
//    el ÁNIMO del rival.
//  - El rival contraataca y desgasta tu RESISTENCIA.
//  - Cuando su ánimo baja, puedes CONVENCERLE (requiere carta de invitación)
//    eligiendo el enfoque adecuado a su personalidad.

import { ENCOUNTER, FATIGUE } from '../config.js';
import { createPlayer, effectiveStats, template, equippedTechniques, gainXp, gainTechXp, maxTp, addFatigue, displayName } from './player.js';
import { getTechnique } from './database.js';
import { resolveDuel } from '../match/duel.js';
import { attemptConvince, convinceChance } from './recruitment.js';
import { getPlayer, markSeen, addPlayerToRoster } from './game-state.js';
import { EVT } from '../core/events.js';
import { elementMultiplier } from './elements.js';

const ACTION_MAP = {
  shoot:   { atk: 'shot', def: (pos) => (pos === 'GK' ? 'keeper' : 'block') },
  dribble: { atk: 'dribble', def: () => 'tackle' },
  defense: { atk: 'tackle', def: () => 'dribble' },
  block:   { atk: 'block', def: () => 'shot' },
  keeper:  { atk: 'keeper', def: () => 'shot' },
  combo:   { atk: 'shot', def: (pos) => (pos === 'GK' ? 'keeper' : 'block') },
};

/**
 * Crea un encuentro.
 * kind: 'wild' (hierba alta, se puede huir) | 'challenge' (reto: al ganar se une) | 'lead' (pista de ojeador)
 */
export function createEncounter(game, { templateId, level, kind = 'wild' }) {
  const { state } = game;
  const wild = createPlayer(templateId, level, { uid: `wild_${templateId}` });
  markSeen(game, templateId);
  const fighters = state.team.lineup.filter(Boolean).concat(state.team.bench)
    .map((uid) => getPlayer(state, uid)).filter((p) => p && p.fatigue < FATIGUE.max);
  if (!fighters.length) throw new Error('No tienes jugadores disponibles.');
  const pools = {};
  const tps = {};
  for (const p of fighters) {
    pools[p.uid] = Math.round(ENCOUNTER.playerStaminaPool * (1 - p.fatigue / 200));
    tps[p.uid] = maxTp(p);
  }
  // El primer luchador: el capitán si está disponible.
  const first = fighters.find((p) => p.uid === state.team.captain) || fighters[0];
  return {
    kind,
    templateId,
    level,
    wild,
    wildStats: effectiveStats(wild),
    wildTp: maxTp(wild),
    morale: ENCOUNTER.maxMorale,
    active: first.uid,
    pools,
    tps,
    participants: new Set([first.uid]),
    turn: 1,
    log: [`¡${displayName(wild)} (Nv.${level}) te reta a un duelo!`],
    status: 'choose', // choose | won | lost | recruited | fled
    lastFx: null,
  };
}

function actorFor(player, stats, techRef) {
  return { stats, element: template(player).element, tech: techRef };
}

function damageFromMargin(margin, base) {
  return Math.round(Math.min(45, Math.max(8, base * margin)));
}

/** Acciones disponibles para el jugador activo. */
export function availableActions(game, enc) {
  const p = getPlayer(game.state, enc.active);
  const techs = equippedTechniques(p)
    .map((pt) => ({ ...pt, def: getTechnique(pt.id) }))
    .filter((t) => ['shoot', 'dribble', 'combo'].includes(t.def.category));
  return {
    techniques: techs.map((t) => ({ id: t.id, level: t.level, name: t.def.name, tp: t.def.tp, element: t.def.element, category: t.def.category, usable: enc.tps[enc.active] >= t.def.tp })),
    canFlee: enc.kind === 'wild',
    canConvince: enc.kind !== 'challenge',
  };
}

/**
 * Ejecuta el turno del jugador. action:
 *  { type: 'dribble' } | { type: 'shoot' } | { type: 'tech', techId }
 *  { type: 'convince', approach, inviteId } | { type: 'switch', uid } | { type: 'flee' }
 */
export function playerTurn(game, enc, action) {
  if (enc.status !== 'choose') return enc;
  const { state, rng } = game;
  const me = getPlayer(state, enc.active);
  const myStats = effectiveStats(me);
  const wildPos = template(enc.wild).position;
  enc.lastFx = null;

  if (action.type === 'flee') {
    if (enc.kind !== 'wild') { enc.log.push('¡No puedes huir de este reto!'); return enc; }
    enc.status = 'fled';
    enc.log.push('Te retiras del desafío.');
    return enc;
  }

  if (action.type === 'switch') {
    if (!enc.pools[action.uid] || enc.pools[action.uid] <= 0) { enc.log.push('Ese jugador no puede salir.'); return enc; }
    enc.active = action.uid;
    enc.participants.add(action.uid);
    enc.log.push(`Sale ${displayName(getPlayer(state, action.uid))}.`);
    return wildTurn(game, enc);
  }

  if (action.type === 'convince') {
    if (enc.kind === 'challenge') { enc.log.push('En un reto debes ganar el duelo.'); return enc; }
    const r = attemptConvince(game, { templateId: enc.templateId, level: enc.level, morale: enc.morale, approach: action.approach, inviteId: action.inviteId, source: 'desafío' });
    if (!r.ok) { enc.log.push(r.message); return enc; }
    enc.log.push(`Probabilidad: ${Math.round(r.chance * 100)}%. ${r.message}`);
    if (r.success) { enc.status = 'recruited'; grantXp(game, enc); return enc; }
    enc.morale = Math.min(ENCOUNTER.maxMorale, enc.morale + 8);
    return wildTurn(game, enc);
  }

  let category = action.type === 'shoot' ? 'shoot' : 'dribble';
  let techRef = null;
  if (action.type === 'tech') {
    const pt = me.techniques.find((t) => t.id === action.techId);
    if (!pt) { enc.log.push('Técnica no disponible.'); return enc; }
    const def = getTechnique(pt.id);
    if (enc.tps[enc.active] < def.tp) { enc.log.push('¡No tienes PT suficientes!'); return enc; }
    enc.tps[enc.active] -= def.tp;
    techRef = { id: pt.id, level: pt.level };
    category = def.category === 'combo' ? 'shoot' : def.category;
    gainTechXp(me, pt.id, 15);
    enc.lastFx = { tech: def, by: 'player' };
    enc.log.push(`¡${template(me).name} usa ${def.name}!`);
  }
  const map = ACTION_MAP[category];
  // El rival puede responder con una técnica defensiva.
  const wildDefTech = pickWildTech(enc, map.def(wildPos), rng);
  const r = resolveDuel(rng, actorFor(me, myStats, techRef), actorFor(enc.wild, enc.wildStats, wildDefTech), map.atk, map.def(wildPos));
  if (wildDefTech) enc.log.push(`${template(enc.wild).name} responde con ${getTechnique(wildDefTech.id).name}.`);
  if (r.attackerWins) {
    const dmg = damageFromMargin(r.margin, techRef ? 30 : 20);
    enc.morale = Math.max(0, enc.morale - dmg);
    const eff = techRef ? elementMultiplier(getTechnique(techRef.id).element, template(enc.wild).element) : 1;
    enc.log.push(`${action.type === 'shoot' || category === 'shoot' ? '¡Golazo!' : '¡Regate perfecto!'} Ánimo rival −${dmg}.${eff > 1 ? ' ¡Ventaja elemental!' : eff < 1 ? ' (desventaja elemental)' : ''}`);
  } else {
    const cost = Math.round(10 + 8 / Math.max(0.5, r.margin));
    enc.pools[enc.active] = Math.max(0, enc.pools[enc.active] - cost);
    enc.log.push(`¡${template(enc.wild).name} lo detiene! Resistencia −${cost}.`);
  }
  if (enc.morale <= 0) return finishWon(game, enc);
  return wildTurn(game, enc);
}

function pickWildTech(enc, defAction, rng) {
  const cat = { keeper: 'keeper', block: 'block', tackle: 'defense', dribble: 'dribble', shot: 'shoot' }[defAction];
  const options = enc.wild.techniques.map((t) => ({ t, d: getTechnique(t.id) })).filter(({ d }) => d.category === cat && enc.wildTp >= d.tp);
  if (!options.length || !rng.chance(0.45)) return null;
  const { t, d } = options.sort((a, b) => b.d.power - a.d.power)[0];
  enc.wildTp -= d.tp;
  return { id: t.id, level: t.level };
}

function wildTurn(game, enc) {
  const { state, rng } = game;
  const me = getPlayer(state, enc.active);
  const wildPos = template(enc.wild).position;
  const atkType = wildPos === 'GK' || wildPos === 'DF' ? 'defense' : rng.chance(0.5) ? 'dribble' : 'shoot';
  const tech = pickWildTech(enc, { defense: 'tackle', dribble: 'dribble', shoot: 'shot' }[atkType], rng);
  const map = { defense: ['tackle', 'dribble'], dribble: ['dribble', 'tackle'], shoot: ['shot', template(me).position === 'GK' ? 'keeper' : 'block'] }[atkType];
  const r = resolveDuel(rng, actorFor(enc.wild, enc.wildStats, tech), actorFor(me, effectiveStats(me), null), map[0], map[1]);
  const name = template(enc.wild).name;
  if (tech) { enc.log.push(`¡${name} usa ${getTechnique(tech.id).name}!`); enc.lastFx = { tech: getTechnique(tech.id), by: 'wild' }; }
  if (r.attackerWins) {
    const dmg = damageFromMargin(r.margin, tech ? 24 : 15);
    enc.pools[enc.active] = Math.max(0, enc.pools[enc.active] - dmg);
    enc.log.push(`${name} te supera. Resistencia −${dmg}.`);
  } else {
    const dmg = Math.round(6 + 6 * Math.min(2, 1 / Math.max(0.3, r.margin)));
    enc.morale = Math.max(0, enc.morale - dmg);
    enc.log.push(`¡Le paras en seco! Ánimo rival −${dmg}.`);
  }
  enc.turn++;
  if (enc.morale <= 0) return finishWon(game, enc);
  if (enc.pools[enc.active] <= 0) {
    enc.log.push(`${displayName(me)} está agotado.`);
    const next = Object.entries(enc.pools).find(([, v]) => v > 0);
    if (!next) {
      enc.status = 'lost';
      enc.log.push('Todos tus jugadores están agotados. Has perdido el desafío.');
      for (const uid of enc.participants) addFatigue(getPlayer(state, uid), 15);
      return enc;
    }
    enc.active = next[0];
    enc.participants.add(next[0]);
    enc.log.push(`Sale ${displayName(getPlayer(state, next[0]))}.`);
  }
  return enc;
}

function grantXp(game, enc) {
  const xp = Math.round(12 + enc.level * 6);
  for (const uid of enc.participants) {
    const p = getPlayer(game.state, uid);
    const r = gainXp(p, xp);
    addFatigue(p, 6);
    if (r.levelsGained) game.bus.emit(EVT.LEVEL_UP, { uid, report: r });
  }
  enc.xpGained = xp;
}

function finishWon(game, enc) {
  enc.status = 'won';
  game.state.stats.encounters++;
  grantXp(game, enc);
  enc.log.push(`¡${template(enc.wild).name} se rinde! Tus jugadores ganan ${enc.xpGained} XP.`);
  game.bus.emit(EVT.ENCOUNTER_WON, { templateId: enc.templateId, kind: enc.kind });
  if (enc.kind === 'challenge') {
    // En los retos, quien gana el duelo se gana su respeto: se une sin carta.
    const r = addPlayerToRoster(game, enc.templateId, enc.level, 'reto');
    enc.log.push(r.ok ? `¡${template(enc.wild).name} se une a tu equipo!` : r.reason);
    if (r.ok) enc.status = 'recruited';
  }
  return enc;
}

/** Tras ganar: para retos se une directamente; en otros casos queda la opción de convencer con bonificación. */
export function previewConvince(game, enc, approach, inviteId) {
  return convinceChance({ templateId: enc.templateId, level: enc.level, morale: enc.morale, approach, inviteId, state: game.state });
}

export function convinceAfterWin(game, enc, approach, inviteId) {
  const r = attemptConvince(game, { templateId: enc.templateId, level: enc.level, morale: 0, approach, inviteId, source: 'desafío' });
  if (r.ok && r.success) enc.status = 'recruited';
  enc.log.push(r.message);
  return r;
}
