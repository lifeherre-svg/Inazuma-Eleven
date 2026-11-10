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
    window.addEventListener('blur', () => { this.held.clear(); this.dirOrder = []; });
  }

  /** Dirección dominante (la última pulsada) para el mundo. */
  dir() { return this.dirOrder[this.dirOrder.length - 1] || null; }

  axis() {
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

/** Controles táctiles: cruceta + botones de acción. */
export function mountTouchControls(root, input) {
  const wrap = document.createElement('div');
  wrap.className = 'touch-controls';
  wrap.innerHTML = `
    <div class="dpad">
      <button data-a="up">▲</button><button data-a="left">◀</button><button data-a="right">▶</button><button data-a="down">▼</button>
    </div>
    <div class="tbtns">
      <button data-a="pass">J<br><small>Pase</small></button>
      <button data-a="shoot">K<br><small>Tiro</small></button>
      <button data-a="special">I<br><small>Técnica</small></button>
      <button data-a="tech">U<br><small>Regate/Def</small></button>
      <button data-a="confirm">OK</button>
      <button data-a="menu">☰</button>
    </div>`;
  for (const b of wrap.querySelectorAll('button')) {
    const a = b.dataset.a;
    const on = (e) => { e.preventDefault(); input.hold(a, true); };
    const off = (e) => { e.preventDefault(); input.hold(a, false); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  }
  root.appendChild(wrap);
  return wrap;
}
