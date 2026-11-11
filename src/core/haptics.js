// Vibración háptica (móviles). Se desactiva desde Ajustes → Vibración.
let enabled = true;

export function setHapticsEnabled(on) { enabled = !!on; }

/** Vibra con un patrón (ms o lista de ms). No hace nada si no hay soporte. */
export function haptic(pattern) {
  if (!enabled) return;
  try { globalThis.navigator?.vibrate?.(pattern); } catch { /* sin soporte */ }
}
