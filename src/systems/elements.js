// Cálculo de efectividades elementales.
import { ELEMENTS } from '../data/elements.js';
import { ELEMENT_MULT } from '../config.js';

/** Multiplicador de un ataque de elemento `attacker` contra `defender`. */
export function elementMultiplier(attacker, defender) {
  if (!attacker || !defender || attacker === defender) return ELEMENT_MULT.neutral;
  if (ELEMENTS[attacker]?.beats === defender) return ELEMENT_MULT.advantage;
  if (ELEMENTS[defender]?.beats === attacker) return ELEMENT_MULT.disadvantage;
  return ELEMENT_MULT.neutral;
}

/** Bonificación si el jugador usa una técnica de su mismo elemento. */
export function sameElementBonus(playerElement, techElement) {
  return playerElement && playerElement === techElement ? ELEMENT_MULT.sameElementBonus : 1;
}

export function effectivenessLabel(mult) {
  if (mult > 1) return '¡Ventaja elemental!';
  if (mult < 1) return 'Desventaja elemental...';
  return '';
}
