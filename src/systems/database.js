// Registro central de datos. Une los jugadores escritos a mano con los
// jugadores generados para completar las plantillas rivales, y ofrece
// búsquedas validadas (con errores claros si se pide un id inexistente).

import { PLAYERS } from '../data/players.js';
import { TEAMS, TEAM_MAP } from '../data/teams.js';
import { TECHNIQUE_MAP, TECHNIQUES } from '../data/techniques.js';
import { FORMATION_MAP } from '../data/formations.js';
import { ITEM_MAP } from '../data/items.js';
import { NAME_POOLS } from '../data/names.js';
import { ELEMENT_IDS } from '../data/elements.js';
import { PERSONALITY_IDS } from '../data/personalities.js';
import { RNG } from '../core/rng.js';
import { STATS } from '../config.js';

const ROSTER_SIZE = 16;

// Perfil de pesos por posición para generar estadísticas.
const POSITION_PROFILE = {
  GK: { shoot: 0.4, dribble: 0.45, defense: 1.3, control: 0.85, technique: 0.85, speed: 0.75, stamina: 1.0, physical: 1.15 },
  DF: { shoot: 0.5, dribble: 0.6, defense: 1.25, control: 0.8, technique: 0.75, speed: 0.85, stamina: 1.0, physical: 1.1 },
  MF: { shoot: 0.8, dribble: 1.05, defense: 0.75, control: 1.15, technique: 1.0, speed: 1.0, stamina: 0.95, physical: 0.7 },
  FW: { shoot: 1.25, dribble: 1.0, defense: 0.5, control: 0.8, technique: 0.9, speed: 1.05, stamina: 0.85, physical: 0.8 },
};

// Técnicas que reciben los jugadores generados según categoría, elemento y nivel de equipo.
const GEN_TECH_BY_TIER = (category, element, tier) => {
  const pool = TECHNIQUES.filter((t) => t.category === category && t.element === element && !t.combo);
  pool.sort((a, b) => a.power - b.power);
  return pool.slice(0, Math.max(1, Math.min(pool.length, tier)));
};

const ROLE_TECH_CATEGORY = { GK: 'keeper', DF: 'defense', MF: 'dribble', FW: 'shoot' };

const registry = new Map(PLAYERS.map((p) => [p.id, p]));
const teamRosters = new Map();

function generateTeamPlayer(team, index, role) {
  const rng = new RNG(`${team.id}#${index}`);
  const pool = NAME_POOLS[team.namePool] || NAME_POOLS.jp;
  const element = rng.chance(0.6) ? team.element : rng.pick(ELEMENT_IDS);
  const rarity = rng.chance(Math.min(0.5, 0.1 + team.level / 120)) ? 'uncommon' : 'common';
  const profile = POSITION_PROFILE[role];
  const base = {};
  for (const s of STATS) base[s] = Math.round(25 * profile[s] * rng.float(0.88, 1.12));
  const techs = [];
  const cat = ROLE_TECH_CATEGORY[role];
  const candidates = GEN_TECH_BY_TIER(cat, element, team.techTier);
  candidates.forEach((t) => techs.push({ level: t.requires?.level || 1, tech: t.id }));
  if (role === 'DF' && team.techTier >= 2) {
    const block = GEN_TECH_BY_TIER('block', element, team.techTier - 1)[0];
    if (block) techs.push({ level: block.requires?.level || 1, tech: block.id });
  }
  if (role === 'MF' && team.techTier >= 2) {
    const shot = GEN_TECH_BY_TIER('shoot', element, team.techTier - 1)[0];
    if (shot) techs.push({ level: shot.requires?.level || 1, tech: shot.id });
  }
  return {
    id: `gen_${team.id}_${index}`,
    name: rng.pick(pool.first),
    surname: rng.pick(pool.last),
    team: team.id,
    position: role,
    element,
    rarity,
    personality: rng.pick(PERSONALITY_IDS),
    base,
    learnset: techs,
    bio: `Jugador de ${team.name}.`,
    look: null,
    generated: true,
  };
}

/** Devuelve los ids de la plantilla completa (16) de un equipo rival. */
export function getTeamRoster(teamId) {
  if (teamRosters.has(teamId)) return teamRosters.get(teamId);
  const team = getTeam(teamId);
  const ids = [];
  for (const starId of team.stars) {
    if (!registry.has(starId)) throw new Error(`Equipo ${teamId}: estrella desconocida ${starId}`);
    ids.push(starId);
  }
  // Roles necesarios: formación + suplentes (1 por línea).
  const formation = getFormation(team.formation);
  const needed = formation.slots.map((s) => s.role).concat(['GK', 'DF', 'MF', 'FW', 'MF']);
  const have = ids.map((id) => registry.get(id).position);
  const remaining = [...needed];
  for (const pos of have) {
    const idx = remaining.indexOf(pos);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  let i = 0;
  while (ids.length < ROSTER_SIZE && remaining.length) {
    const role = remaining.shift();
    const p = generateTeamPlayer(team, i++, role);
    registry.set(p.id, p);
    ids.push(p.id);
  }
  teamRosters.set(teamId, ids);
  return ids;
}

export function getPlayerTemplate(id) {
  if (!registry.has(id) && id.startsWith('gen_')) {
    // Asegura la generación perezosa de la plantilla del equipo.
    const teamId = id.slice(4, id.lastIndexOf('_'));
    if (TEAM_MAP[teamId]) getTeamRoster(teamId);
  }
  const p = registry.get(id);
  if (!p) throw new Error(`Jugador desconocido: ${id}`);
  return p;
}

export function hasPlayerTemplate(id) {
  try { getPlayerTemplate(id); return true; } catch { return false; }
}

export function allPlayerTemplates({ includeGenerated = false } = {}) {
  return [...registry.values()].filter((p) => includeGenerated || !p.generated);
}

export function getTechnique(id) {
  const t = TECHNIQUE_MAP[id];
  if (!t) throw new Error(`Técnica desconocida: ${id}`);
  return t;
}

export function getTeam(id) {
  const t = TEAM_MAP[id];
  if (!t) throw new Error(`Equipo desconocido: ${id}`);
  return t;
}

export function getFormation(id) {
  const f = FORMATION_MAP[id];
  if (!f) throw new Error(`Formación desconocida: ${id}`);
  return f;
}

export function getItem(id) {
  const i = ITEM_MAP[id];
  if (!i) throw new Error(`Objeto desconocido: ${id}`);
  return i;
}

export function allTeams() { return TEAMS; }
