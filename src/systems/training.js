// Entrenamiento: mejora permanente de estadísticas, experiencia, mejora y
// descubrimiento de técnicas, fatiga y descanso.

import { PROGRESSION, FATIGUE } from '../config.js';
import { TRAINING_MAP } from '../data/trainings.js';
import { TECHNIQUES } from '../data/techniques.js';
import { COACH_MAP } from '../data/coaches.js';
import { gainXp, gainTechXp, addFatigue, canLearn, addTechnique, template, equippedTechniques } from './player.js';
import { getPlayer, pushLog } from './game-state.js';
import { EVT } from '../core/events.js';

/** Técnica que un jugador puede descubrir entrenando (afín a su elemento y posición). */
export function discoverableTechnique(player) {
  const t = template(player);
  const catByPos = { GK: ['keeper'], DF: ['defense', 'block'], MF: ['dribble', 'shoot', 'defense'], FW: ['shoot', 'dribble'] }[t.position];
  const learnsetIds = new Set(t.learnset.map((l) => l.tech));
  return TECHNIQUES
    .filter((tech) => !tech.combo && tech.element === t.element && catByPos.includes(tech.category))
    .filter((tech) => !player.techniques.some((x) => x.id === tech.id))
    .filter((tech) => canLearn(player, tech.id).ok || learnsetIds.has(tech.id) && player.level >= (tech.requires?.level || 1))
    .sort((a, b) => a.power - b.power)[0] || null;
}

/**
 * Ejecuta una sesión de entrenamiento.
 * @param quality 0..1 resultado del minijuego (0.5 = normal)
 */
export function train(game, uid, trainingId, quality = 0.5) {
  const { state } = game;
  const player = getPlayer(state, uid);
  const tr = TRAINING_MAP[trainingId];
  if (!player) return { ok: false, message: 'Jugador no encontrado.' };
  if (!tr) return { ok: false, message: 'Entrenamiento desconocido.' };
  if (player.fatigue >= 85) return { ok: false, message: 'Está demasiado cansado. Necesita descansar.' };
  const perk = COACH_MAP[state.profile.coachId]?.perk || {};
  const q = Math.max(0, Math.min(1, quality));
  const mul = (0.4 + q * 1.2) * (perk.trainingMul || 1);
  const report = { gains: {}, xp: 0, levelUp: null, techUps: [], learned: null, insight: null };

  for (const [stat, base] of Object.entries(tr.gains)) {
    const before = player.trained[stat] || 0;
    const gain = Math.min(PROGRESSION.maxTrainedPerStat - before, Math.max(0, Math.round(base * mul)));
    player.trained[stat] = before + gain;
    if (gain > 0) report.gains[stat] = gain;
  }
  report.xp = Math.round(tr.xp * (0.6 + q * 0.8));
  const lv = gainXp(player, report.xp);
  if (lv.levelsGained) { report.levelUp = lv; game.bus.emit(EVT.LEVEL_UP, { uid, report: lv }); }

  if (tr.techXp) {
    for (const pt of equippedTechniques(player)) {
      if (gainTechXp(player, pt.id, Math.round(tr.techXp * (0.5 + q)))) report.techUps.push(pt.id);
    }
    // Descubrimiento de nuevas técnicas mediante "inspiración".
    const tech = discoverableTechnique(player);
    if (tech) {
      player.insight = player.insight || {};
      player.insight[tech.id] = (player.insight[tech.id] || 0) + Math.round(20 + q * 40);
      report.insight = { techId: tech.id, progress: Math.min(100, player.insight[tech.id]) };
      if (player.insight[tech.id] >= 100 && canLearn(player, tech.id).ok) {
        addTechnique(player, tech.id);
        delete player.insight[tech.id];
        report.learned = tech.id;
        game.bus.emit(EVT.TECH_LEARNED, { uid, techId: tech.id });
      }
    }
  }
  addFatigue(player, Math.round(tr.fatigue * (perk.trainingFatigueMul || 1)));
  state.stats.trainings++;
  game.bus.emit(EVT.TRAINED, { uid, trainingId, quality: q });
  pushLog(state, `${template(player).name} entrena: ${tr.name}.`);
  return { ok: true, report };
}

/** Descanso completo de la plantilla (casa / posada). Avanza un día. */
export function restTeam(game) {
  for (const p of game.state.roster) p.fatigue = 0;
  advanceDay(game);
}

export function advanceDay(game) {
  game.state.day++;
  for (const p of game.state.roster) addFatigue(p, -FATIGUE.dailyRecovery);
}
