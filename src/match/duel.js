// Fórmulas de resolución de duelos. Son funciones puras compartidas por el
// motor de partido en tiempo real y por los desafíos por turnos.
//
// Cada "actor" es { stats, element, tech?: { id, level } , staminaMul? }.
// Las estadísticas, el elemento y la técnica influyen directamente en el
// resultado; el azar aporta una variación de ±25%.

import { getTechnique } from '../systems/database.js';
import { techPower } from '../systems/player.js';
import { elementMultiplier, sameElementBonus } from '../systems/elements.js';

// Ventaja base del portero: sin técnicas, la mayoría de tiros lejanos se paran.
export const KEEPER_ADVANTAGE = 1.15;

const roll = (rng, spread = 0.25) => 1 + (rng.next() * 2 - 1) * spread;

function techFactor(actor) {
  if (!actor.tech) return { mul: 1, element: actor.element };
  const t = getTechnique(actor.tech.id);
  const power = techPower(t.id, actor.tech.level || 1);
  return {
    mul: (1 + power / 85) * sameElementBonus(actor.element, t.element),
    element: t.element,
  };
}

/** Valor de ataque/defensa para cada tipo de acción. */
export const ACTION_FORMULAS = {
  shot:    (s) => s.shoot * 1.0 + s.technique * 0.3 + s.physical * 0.2,
  keeper:  (s) => s.defense * 0.85 + s.physical * 0.45 + s.technique * 0.25 + s.control * 0.15,
  block:   (s) => s.defense * 0.8 + s.physical * 0.5 + s.technique * 0.2,
  dribble: (s) => s.dribble * 0.9 + s.control * 0.5 + s.speed * 0.25 + s.technique * 0.15,
  tackle:  (s) => s.defense * 0.95 + s.physical * 0.45 + s.speed * 0.25 + s.technique * 0.15,
  pass:    (s) => s.control * 0.9 + s.technique * 0.4 + s.dribble * 0.1,
  intercept: (s) => s.defense * 0.6 + s.speed * 0.5 + s.control * 0.3,
};

/**
 * Resuelve un duelo genérico.
 * @returns {{ attackerWins, atkValue, defValue, elementMul, margin }}
 */
export function resolveDuel(rng, attacker, defender, atkAction, defAction, opts = {}) {
  const a = techFactor(attacker);
  const d = techFactor(defender);
  const elemA = elementMultiplier(a.element, d.element);
  const elemD = elementMultiplier(d.element, a.element);
  // El elemento solo cuenta cuando alguien usa técnica (o por el elemento natural reducido).
  const atkElem = attacker.tech || defender.tech ? elemA : 1 + (elemA - 1) * 0.3;
  const defElem = attacker.tech || defender.tech ? elemD : 1 + (elemD - 1) * 0.3;
  let atkValue = ACTION_FORMULAS[atkAction](attacker.stats) * a.mul * atkElem * (attacker.staminaMul ?? 1) * (opts.atkMul ?? 1) * roll(rng);
  let defValue = ACTION_FORMULAS[defAction](defender.stats) * d.mul * defElem * (defender.staminaMul ?? 1) * (opts.defMul ?? 1) * roll(rng);
  return { attackerWins: atkValue > defValue, atkValue, defValue, elementMul: atkElem, margin: atkValue / Math.max(1, defValue) };
}

/** Disminución de potencia de tiro con la distancia (1 cerca, ~0.55 muy lejos). */
export function distanceDecay(distance) {
  if (distance <= 160) return 1;
  return Math.max(0.5, 1 - (distance - 160) / 600);
}

/** Tiro contra portero. Devuelve también si el balón queda atrapado o rechazado. */
export function resolveShot(rng, shooter, keeper, distance, opts = {}) {
  const decay = distanceDecay(distance);
  const r = resolveDuel(rng, shooter, keeper, 'shot', 'keeper', { atkMul: decay * (opts.shotMul ?? 1), defMul: KEEPER_ADVANTAGE * (opts.keeperMul ?? 1) });
  return { goal: r.attackerWins, caught: !r.attackerWins && r.margin < 0.8, ...r };
}

/**
 * Bloqueo de un defensor en la trayectoria. Si el bloqueo gana, el balón se
 * detiene; si pierde pero se acerca, el tiro pierde potencia.
 */
export function resolveBlock(rng, shooter, blocker, opts = {}) {
  const r = resolveDuel(rng, shooter, blocker, 'shot', 'block', { atkMul: opts.shotMul ?? 1 });
  const weaken = r.attackerWins ? Math.max(0.6, 1 - r.defValue / (r.atkValue * 2.2)) : 0;
  return { blocked: !r.attackerWins, weaken, ...r };
}
