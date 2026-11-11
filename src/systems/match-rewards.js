// Aplica el resultado de un partido al estado de la partida: experiencia,
// mejora de técnicas por uso, fatiga, dinero, estadísticas y eventos.

import { ECONOMY, FATIGUE } from '../config.js';
import { COACH_MAP } from '../data/coaches.js';
import { getTeam } from './database.js';
import { gainXp, gainTechXp, addFatigue, template } from './player.js';
import { getPlayer, addMoney, pushLog } from './game-state.js';
import { EVT } from '../core/events.js';

/**
 * @param {object} game
 * @param {object} o { opponentId, opponentLevel, result (MatchEngine.result()), context, participants: [uid] }
 */
export function applyMatchResult(game, { opponentId, opponentLevel, result, context = 'friendly', participants }) {
  const { state } = game;
  const team = getTeam(opponentId);
  const level = opponentLevel ?? team.level;
  const outcome = result.winner === 0 ? 'win' : result.winner === 1 ? 'loss' : 'draw';
  const perk = COACH_MAP[state.profile.coachId]?.perk || {};
  const baseXp = Math.round((30 + level * 12) * (outcome === 'win' ? 1.5 : outcome === 'draw' ? 1.0 : 0.6) * (perk.matchXpMul || 1));
  const report = { outcome, xp: baseXp, money: 0, levelUps: [], techUps: [] };

  const uids = participants || state.team.lineup.filter(Boolean);
  for (const uid of uids) {
    const p = getPlayer(state, uid);
    if (!p) continue;
    const rating = result.ratings?.[uid] ?? 6;
    const xp = Math.round(baseXp * (0.7 + rating / 20));
    const r = gainXp(p, xp);
    if (r.levelsGained) {
      report.levelUps.push({ uid, name: `${template(p).name} ${template(p).surname}`, from: r.fromLevel, to: p.level, learned: r.learned });
      game.bus.emit(EVT.LEVEL_UP, { uid, report: r });
    }
    addFatigue(p, FATIGUE.matchCost);
    p.matches++;
  }
  // Las técnicas usadas en el partido ganan experiencia.
  for (const use of result.techUses || []) {
    if (use.team !== 0) continue;
    const p = getPlayer(state, use.playerId);
    if (!p) continue;
    const gained = gainTechXp(p, use.techId, 25 * use.count);
    if (gained) report.techUps.push({ uid: p.uid, techId: use.techId });
  }
  for (const g of result.goals || []) {
    if (g.team === 0 && g.scorerId) { const p = getPlayer(state, g.scorerId); if (p) p.goals++; }
  }
  if (outcome === 'win') report.money = ECONOMY.matchWinMoneyPerLevel * level + Math.round(team.money * 0.5);
  else if (outcome === 'draw') report.money = ECONOMY.matchDrawMoneyPerLevel * level;
  else report.money = Math.round(level * 5);
  addMoney(game, report.money);

  state.stats.matches++;
  state.stats[outcome === 'win' ? 'wins' : outcome === 'draw' ? 'draws' : 'losses']++;
  state.stats.goalsFor += result.score[0];
  state.stats.goalsAgainst += result.score[1];
  if (outcome === 'win') state.defeatedTeams[opponentId] = (state.defeatedTeams[opponentId] || 0) + 1;
  pushLog(state, `${outcome === 'win' ? 'Victoria' : outcome === 'draw' ? 'Empate' : 'Derrota'} ${result.score[0]}-${result.score[1]} contra ${team.name}.`);
  game.bus.emit(EVT.MATCH_END, { opponentId, outcome, score: result.score, context });
  return report;
}
