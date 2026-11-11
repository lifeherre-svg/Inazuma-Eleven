// Torneos y competiciones: requisitos, rondas, eliminación y recompensas.

import { TOURNAMENTS, TOURNAMENT_MAP } from '../data/tournaments.js';
import { hasFlag, setFlag, addMoney, addPlayerToRoster, teamAverageLevel, pushLog } from './game-state.js';
import { giveItem } from './inventory.js';
import { EVT } from '../core/events.js';

export function getTournament(id) {
  const t = TOURNAMENT_MAP[id];
  if (!t) throw new Error(`Torneo desconocido: ${id}`);
  return t;
}

export function tournamentState(state, id) {
  if (!state.tournaments[id]) state.tournaments[id] = { round: 0, wins: 0, titles: 0, inProgress: false };
  return state.tournaments[id];
}

export function isUnlocked(state, id) {
  const t = getTournament(id);
  if (t.requires?.flag && !hasFlag(state, t.requires.flag)) return false;
  return true;
}

export function canEnter(state, id) {
  const t = getTournament(id);
  if (!isUnlocked(state, id)) return { ok: false, reason: t.requires?.text || 'Aún no está disponible.' };
  const ts = tournamentState(state, id);
  if (ts.titles > 0 && !t.repeatable) return { ok: false, reason: 'Ya has ganado este torneo.' };
  if (state.team.lineup.filter(Boolean).length < 11) return { ok: false, reason: 'Necesitas 11 titulares.' };
  if (t.minLevel && teamAverageLevel(state) < t.minLevel) return { ok: false, reason: `Nivel medio mínimo del once: ${t.minLevel}.` };
  return { ok: true };
}

/** Siguiente rival (o null si no hay torneo en curso). */
export function nextOpponent(state, id) {
  const t = getTournament(id);
  const ts = tournamentState(state, id);
  const round = t.rounds[ts.round];
  if (!round) return null;
  const scale = ts.titles > 0 && t.repeatable ? 4 * ts.titles : 0;
  return { ...round, level: round.level + scale, roundIndex: ts.round, roundName: t.roundNames?.[ts.round] || `Ronda ${ts.round + 1}` };
}

export function enterTournament(game, id) {
  const check = canEnter(game.state, id);
  if (!check.ok) return check;
  const ts = tournamentState(game.state, id);
  ts.inProgress = true;
  if (ts.round >= getTournament(id).rounds.length) ts.round = 0;
  return { ok: true, opponent: nextOpponent(game.state, id) };
}

/** Registra el resultado de una ronda. Devuelve {status: 'advance'|'champion'|'eliminated', rewards?} */
export function recordTournamentMatch(game, id, won) {
  const { state } = game;
  const t = getTournament(id);
  const ts = tournamentState(state, id);
  if (!won) {
    ts.round = 0;
    ts.inProgress = false;
    pushLog(state, `Eliminado del ${t.name}.`);
    return { status: 'eliminated' };
  }
  ts.round++;
  ts.wins++;
  if (ts.round < t.rounds.length) return { status: 'advance', next: nextOpponent(state, id) };
  ts.round = 0;
  ts.inProgress = false;
  ts.titles++;
  const r = ts.titles === 1 ? t.rewards : (t.repeatRewards || { money: Math.round((t.rewards.money || 0) / 2) });
  if (r.money) addMoney(game, r.money);
  for (const [item, qty] of Object.entries(r.items || {})) giveItem(game, item, qty);
  if (r.player) addPlayerToRoster(game, r.player.id, r.player.level, 'torneo');
  for (const f of r.flags || []) setFlag(game, f);
  pushLog(state, `¡Campeones del ${t.name}!`);
  game.bus.emit(EVT.TOURNAMENT_WON, { id });
  return { status: 'champion', rewards: r };
}

export function listTournaments(state) {
  return TOURNAMENTS.map((t) => ({ t, unlocked: isUnlocked(state, t.id), st: tournamentState(state, t.id) }));
}
