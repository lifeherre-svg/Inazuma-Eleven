import { haptic } from './haptics.js';

// Gestión de entrada: teclado + controles táctiles en pantalla.
// Distingue entre teclas mantenidas (movimiento) y pulsaciones (acciones).

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyJ: 'pass', KeyK: 'shoot', KeyI: 'special', KeyU: 'tech', KeyL: 'dribble',
  Space: 'confirm', Enter: 'confirm', KeyE: 'confirm', KeyZ: 'confirm',
  Escape: 'menu', KeyM: 'menu', KeyX: 'cancel', Backspace: 'cancel',
  KeyP: 'pause', KeyQ: 'switch', Tab: 'tactics',
};

export class Input {
  constructor() {
    this.stick = null;          // joystick táctil analógico {x, y} en [-1, 1]
    this.held = new Set();
    this.pressed = new Set();
    this.enabled = true;
    this.lastDir = null;
    this.dirOrder = [];
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code) && !isTyping(e)) e.preventDefault();
      if (isTyping(e)) return;
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
      if (['up', 'down', 'left', 'right'].includes(a)) { this.dirOrder = this.dirOrder.filter((d) => d !== a); this.dirOrder.push(a); }
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      // Puede haber varias teclas para la misma acción: solo se suelta si ninguna sigue pulsada.
      this.held.delete(a);
      this.dirOrder = this.dirOrder.filter((d) => d !== a);
    });
    window.addEventListener('blur', () => { this.held.clear(); this.dirOrder = []; this.stick = null; });
  }

  /** Dirección dominante (la última pulsada, o el eje mayor del joystick) para el mundo. */
  dir() {
    if (this.stick) {
      const { x, y } = this.stick;
      if (Math.hypot(x, y) < 0.35) return null;
      return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    }
    return this.dirOrder[this.dirOrder.length - 1] || null;
  }

  /** Eje de movimiento: analógico con joystick táctil, digital con teclado. */
  axis() {
    if (this.stick && Math.hypot(this.stick.x, this.stick.y) > 0.2) return { x: this.stick.x, y: this.stick.y };
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    return { x, y };
  }

  consume(action) {
    if (this.pressed.has(action)) { this.pressed.delete(action); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); }

  press(action) { this.pressed.add(action); }
  hold(action, on) {
    if (on) {
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
      if (['up', 'down', 'left', 'right'].includes(action)) { this.dirOrder = this.dirOrder.filter((d) => d !== action); this.dirOrder.push(action); }
    } else {
      this.held.delete(action);
      this.dirOrder = this.dirOrder.filter((d) => d !== action);
    }
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

/**
 * Controles táctiles: joystick analógico (izquierda) y botones de acción
 * contextuales (derecha). Qué botones se ven depende del modo de la escena
 * (`body[data-touch-mode="world"|"match"]`) y, en el partido, de quién tiene
 * el balón (`body[data-ball="own"|"rival"]`): ver styles/main.css.
 * Admite multitáctil: se puede mover y pulsar a la vez.
 */
export function mountTouchControls(root, input) {
  const btn = (action, cls, mode, key, own, rival = own) =>
    `<button data-a="${action}" class="tb ${cls}" data-mode="${mode}" aria-label="${own}">
      ${key ? `<b>${key}</b>` : ''}<span class="l-own">${own}</span><span class="l-rival">${rival}</span></button>`;
  const wrap = document.createElement('div');
  wrap.className = 'touch-controls';
  wrap.innerHTML = `
    <div class="joy" aria-label="Joystick"><div class="joy-ring"></div><div class="joy-knob"></div></div>
    <div class="tbtns">
      ${btn('shoot', 'tb-a', 'match', 'K', 'Tiro', 'Entrada')}
      ${btn('pass', 'tb-b', 'match', 'J', 'Pase', 'Cambiar')}
      ${btn('special', 'tb-c', 'match', 'I', 'Técnica', 'Técnica')}
      ${btn('tech', 'tb-d', 'match', 'U', 'Regate+', 'Defensa+')}
      ${btn('confirm', 'tb-a', 'world', '', 'Hablar')}
      ${btn('sprint', 'tb-s', 'both', '', 'Correr', 'Correr')}
    </div>`;

  // Botones: pulsación mantenida (sprint) o pulsación simple (acciones).
  for (const b of wrap.querySelectorAll('.tb')) {
    const a = b.dataset.a;
    const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('down'); input.hold(a, true); haptic(8); };
    const off = (e) => { e.preventDefault(); b.classList.remove('down'); input.hold(a, false); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Joystick analógico.
  const joy = wrap.querySelector('.joy');
  const knob = wrap.querySelector('.joy-knob');
  let pid = null;
  const update = (e) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const max = r.width * 0.38;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.stick = { x: dx / max, y: dy / max };
  };
  const release = () => { pid = null; input.stick = null; knob.style.transform = 'translate(-50%, -50%)'; joy.classList.remove('active'); };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; joy.setPointerCapture?.(pid); joy.classList.add('active'); update(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === pid) update(e); });
  joy.addEventListener('pointerup', (e) => { if (e.pointerId === pid) release(); });
  joy.addEventListener('pointercancel', release);
  joy.addEventListener('lostpointercapture', release);
  root.appendChild(wrap);
  return wrap;
}
