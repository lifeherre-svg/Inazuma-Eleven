// Construye las "especificaciones de equipo" que consume el motor de partido,
// tanto para el equipo del jugador como para equipos rivales.

import { getTeam, getTeamRoster, getFormation, getTechnique } from '../systems/database.js';
import { createPlayer, effectiveStats, equippedTechniques, maxTp, template } from '../systems/player.js';
import { positionFit } from '../systems/team.js';
import { PLAYER_TEAM } from '../data/teams.js';
import { COACH_MAP } from '../data/coaches.js';
import { STATS } from '../config.js';

function specPlayer(player, { role, isCaptain = false, statMul = 1, startTpBonus = 0 }) {
  const t = template(player);
  const fit = role ? positionFit(t.position, role) : 1;
  const stats = effectiveStats(player);
  for (const s of STATS) stats[s] = Math.max(1, Math.round(stats[s] * fit * statMul * (isCaptain ? 1.05 : 1)));
  const techs = equippedTechniques(player).map((pt) => ({ id: pt.id, level: pt.level, category: getTechnique(pt.id).category }));
  const mtp = maxTp(player);
  return {
    id: player.uid,
    templateId: player.templateId,
    name: `${t.name} ${t.surname}`,
    short: t.surname,
    position: t.position,
    element: t.element,
    rarity: t.rarity,
    look: t.look,
    stats,
    techniques: techs,
    maxTp: mtp,
    startTp: Math.min(mtp, Math.round(mtp * (1 - player.fatigue / 250)) + startTpBonus),
    isCaptain,
    level: player.level,
  };
}

/** Especificación del equipo del jugador a partir del estado de la partida. */
export function buildPlayerTeamSpec(state) {
  const formation = getFormation(state.team.formationId);
  const coach = COACH_MAP[state.profile.coachId];
  const byUid = new Map(state.roster.map((p) => [p.uid, p]));
  const starters = state.team.lineup.map((uid, i) => {
    const p = byUid.get(uid);
    if (!p) throw new Error('Alineación incompleta');
    return specPlayer(p, { role: formation.slots[i].role, isCaptain: uid === state.team.captain, startTpBonus: coach?.perk.startTpBonus || 0 });
  });
  const bench = state.team.bench.map((uid) => byUid.get(uid)).filter(Boolean).slice(0, 7)
    .map((p) => specPlayer(p, { role: null, startTpBonus: coach?.perk.startTpBonus || 0 }));
  return {
    id: PLAYER_TEAM.id,
    name: PLAYER_TEAM.name,
    short: PLAYER_TEAM.short,
    colors: PLAYER_TEAM.colors,
    formation,
    strategy: { ...state.team.strategy },
    starters,
    bench,
  };
}

/**
 * Especificación de un equipo rival. Los jugadores se instancian al nivel del
 * equipo (± variación) sin tocar el estado de la partida.
 * levelOverride permite escalar torneos / revanchas.
 */
export function buildOpponentSpec(teamId, { levelOverride, statMul = 1 } = {}) {
  const team = getTeam(teamId);
  const level = levelOverride ?? team.level;
  const formation = getFormation(team.formation);
  const ids = getTeamRoster(teamId);
  const instances = ids.map((id, i) => createPlayer(id, Math.max(1, level + (team.stars.includes(id) ? 2 : (i % 3) - 1)), { uid: `${teamId}_${id}` }));
  // Elegir titulares por rol de la formación.
  const pool = [...instances];
  const starters = formation.slots.map((slot) => {
    let idx = pool.findIndex((p) => template(p).position === slot.role);
    if (idx < 0) idx = 0;
    const [p] = pool.splice(idx, 1);
    return { p, role: slot.role };
  });
  const captainIdx = starters.findIndex(({ p }) => team.stars.includes(p.templateId));
  return {
    id: team.id,
    name: team.name,
    short: team.short,
    colors: team.colors,
    formation,
    strategy: { offense: team.offense, defense: team.defense, style: team.style },
    starters: starters.map(({ p, role }, i) => specPlayer(p, { role, isCaptain: i === Math.max(0, captainIdx), statMul })),
    bench: pool.map((p) => specPlayer(p, { role: null, statMul })),
    level,
  };
}
