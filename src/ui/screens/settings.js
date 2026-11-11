// Panel de configuración (usado en el menú principal y en el menú de juego).

import { h } from '../dom.js';
import { DIFFICULTY, DEFAULT_SETTINGS } from '../../config.js';

export function settingsPanel(app, fallback = null) {
  const s = app.game?.state.settings || fallback || { ...DEFAULT_SETTINGS };
  const persist = () => {
    try { localStorage.setItem('ul_settings', JSON.stringify(s)); } catch { /* sin almacenamiento */ }
    app.applySettings(s);
  };
  const range = (label, key, min, max, step, fmt = (v) => v) => {
    const val = h('span', { class: 'set-val' }, fmt(s[key]));
    return h('label', { class: 'set-row' }, h('span', {}, label),
      h('input', { type: 'range', min, max, step, value: s[key], oninput: (e) => { s[key] = Number(e.target.value); val.textContent = fmt(s[key]); persist(); } }), val);
  };
  const toggle = (label, key) => h('label', { class: 'set-row' }, h('span', {}, label),
    h('input', { type: 'checkbox', checked: s[key], onchange: (e) => { s[key] = e.target.checked; persist(); } }));
  const select = (label, key, options) => h('label', { class: 'set-row' }, h('span', {}, label),
    h('select', { onchange: (e) => { s[key] = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value); persist(); } },
      options.map(([v, t]) => h('option', { value: v, selected: String(s[key]) === String(v) }, t))));
  return h('div', { class: 'settings' },
    h('h3', {}, 'Audio'),
    range('Música', 'musicVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
    range('Efectos', 'sfxVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
    h('h3', {}, 'Partidos'),
    select('Dificultad', 'difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label])),
    select('Duración de cada parte', 'halfDurationSec', [[90, '1:30 (rápido)'], [150, '2:30 (normal)'], [240, '4:00 (largo)'], [360, '6:00 (simulación)']]),
    toggle('Duelos tácticos (elegir respuesta al ser presionado)', 'duelPrompts'),
    toggle('Cambio automático de jugador al defender', 'autoSwitch'),
    toggle('Temblor de cámara en goles y técnicas', 'screenShake'),
    h('h3', {}, 'Interfaz'),
    select('Velocidad del texto', 'textSpeed', [[1, 'Lenta'], [2, 'Normal'], [3, 'Rápida']]),
    select('Tamaño de la interfaz', 'uiScale', [[0.85, 'Pequeño'], [1, 'Normal'], [1.15, 'Grande'], [1.3, 'Muy grande']]),
    toggle('Vibración (móviles)', 'vibration'),
    toggle('Mostrar FPS', 'showFps'),
    h('p', { class: 'small muted' }, app.isTouch
      ? 'Controles táctiles: joystick para moverte · Correr (mantener) · en el partido: Pase/Cambiar, Tiro/Entrada, Técnica (tiro especial o combinada) y Regate+/Defensa+ (técnica de regate o defensiva). Botón Atrás: cerrar, pausar o abrir el menú.'
      : 'Controles: Flechas/WASD mover · Shift sprint · J pase (en defensa: cambiar jugador) · K tiro (en defensa: entrada) · I técnica de tiro/combinada · U técnica de regate/defensa · L regate en duelos · P/ESC pausa y tácticas.'));
}
