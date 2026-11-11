// Reclutamiento: probabilidad de convencer, ojeo tras partido y búsqueda de
// jugadores mediante la red de ojeadores. (No es un sistema de sobres: cada
// fichaje requiere un desafío, un partido, una misión o una búsqueda.)

import { RARITY, ECONOMY } from '../config.js';
import { PERSONALITIES, APPROACHES } from '../data/personalities.js';
import { COACH_MAP } from '../data/coaches.js';
import { getPlayerTemplate, getItem, getTeamRoster, getTeam } from './database.js';
import { itemCount, removeItem } from './inventory.js';
import { ownsTemplate, addPlayerToRoster, teamAverageLevel, markSeen, spendMoney } from './game-state.js';

export function approachMultiplier(personality, approach) {
  const p = PERSONALITIES[personality];
  if (!p || !APPROACHES[approach]) return 1;
  if (p.likes === approach) return 1.6;
  if (p.dislikes === approach) return 0.45;
  return 1;
}

/**
 * Probabilidad de convencer a un jugador.
 * @param {object} o { templateId, level, morale (0-100), approach, inviteId, state }
 */
export function convinceChance({ templateId, level, morale = 100, approach, inviteId, state }) {
  const t = getPlayerTemplate(templateId);
  const base = RARITY[t.rarity].recruitBase;
  const moraleFactor = 1.25 - (morale / 100) * 0.95;          // 1.25 (rendido) → 0.30 (intacto)
  const invite = inviteId ? getItem(inviteId).recruitMul || 1 : 0;
  const coach = COACH_MAP[state.profile.coachId]?.perk.recruitMul || 1;
  const teamLvl = teamAverageLevel(state);
  const levelFactor = level > teamLvl + 5 ? Math.max(0.35, 1 - (level - teamLvl - 5) * 0.06) : 1.05;
  const chance = base * moraleFactor * approachMultiplier(t.personality, approach) * invite * coach * levelFactor;
  return Math.max(0.02, Math.min(0.95, chance));
}

/** Intenta convencer (consume una invitación). Devuelve {ok, success, chance, message}. */
export function attemptConvince(game, { templateId, level, morale, approach, inviteId, source = 'reclutamiento' }) {
  const { state, rng } = game;
  if (ownsTemplate(state, templateId)) return { ok: false, message: 'Ya forma parte de tu equipo.' };
  if (!inviteId || itemCount(state, inviteId) <= 0) return { ok: false, message: 'Necesitas una carta de invitación.' };
  const chance = convinceChance({ templateId, level, morale, approach, inviteId, state });
  removeItem(state, inviteId, 1);
  const success = rng.next() < chance;
  const t = getPlayerTemplate(templateId);
  if (success) {
    const r = addPlayerToRoster(game, templateId, level, source);
    if (!r.ok) return { ok: false, message: r.reason, chance };
    return { ok: true, success: true, chance, message: `¡${t.name} ${t.surname} acepta unirse a tu equipo!`, player: r.player };
  }
  const p = PERSONALITIES[t.personality];
  const hint = p.dislikes === approach ? 'Parece que ese enfoque le ha molestado...' : 'Todavía no está convencido.';
  return { ok: true, success: false, chance, message: hint };
}

/** Candidatos que se pueden intentar fichar tras ganar a un equipo rival. */
export function postMatchCandidates(game, teamId, result) {
  const team = getTeam(teamId);
  const ids = getTeamRoster(teamId);
  const stars = ids.filter((id) => team.stars.includes(id));
  const mvp = result?.mvp ? ids.find((id) => result.mvp === `${teamId}_${id}`) : null;
  const pool = [...new Set([...stars, ...(mvp ? [mvp] : []), ...ids.filter((id) => !team.stars.includes(id)).slice(0, 2)])];
  return pool
    .filter((id) => !ownsTemplate(game.state, id))
    .slice(0, 4)
    .map((id) => ({ templateId: id, level: team.level + (team.stars.includes(id) ? 1 : 0) }));
}

/**
 * Red de ojeadores: busca un jugador libre según filtros entre las zonas
 * desbloqueadas. Coloca una "pista" en el mapa donde podrás retarle.
 */
export function scoutSearch(game, { position = null, element = null, zones }) {
  const { state, rng } = game;
  const coach = COACH_MAP[state.profile.coachId]?.perk;
  const cost = Math.round(ECONOMY.scoutSearchCost * (coach?.scoutDiscount || 1));
  if (state.money < cost) return { ok: false, message: `Necesitas ${cost} monedas.` };
  const leadsTaken = new Set(state.scout.leads.map((l) => l.templateId));
  const candidates = [];
  for (const zone of zones) {
    for (const entry of zone.scoutPool || []) {
      const t = getPlayerTemplate(entry.id);
      if (ownsTemplate(state, entry.id) || leadsTaken.has(entry.id)) continue;
      if (position && t.position !== position) continue;
      if (element && t.element !== element) continue;
      candidates.push({ ...entry, map: zone.id, rarity: t.rarity });
    }
  }
  if (!candidates.length) return { ok: false, message: 'Tus ojeadores no encuentran a nadie con esos criterios en las zonas que conoces.' };
  spendMoney(game, cost);
  const weights = { common: 10, uncommon: 7, rare: 4, epic: 2, legendary: 0.7, mythic: 0.25 };
  const pick = rng.weighted(candidates, (c) => weights[c.rarity] || 1);
  const lead = { templateId: pick.id, level: rng.int(pick.min, pick.max), map: pick.map, x: pick.x, y: pick.y, day: state.day };
  state.scout.leads.push(lead);
  markSeen(game, pick.id);
  const t = getPlayerTemplate(pick.id);
  return { ok: true, lead, cost, message: `Pista encontrada: ${t.name} ${t.surname} (${RARITY[t.rarity].label}) entrena en ${zones.find((z) => z.id === pick.map)?.name}.` };
}

export function removeLead(state, templateId) {
  state.scout.leads = state.scout.leads.filter((l) => l.templateId !== templateId);
}

export function scoutCost(state) {
  return Math.round(ECONOMY.scoutSearchCost * (COACH_MAP[state.profile.coachId]?.perk.scoutDiscount || 1));
}

export { addPlayerToRoster };
