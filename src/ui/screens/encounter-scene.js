// Pantalla de desafío por turnos (encuentros, retos y pistas de ojeador).

import { h, clear } from '../dom.js';
import { createEncounter, playerTurn, availableActions, previewConvince, convinceAfterWin } from '../../systems/encounter.js';
import { getPlayer } from '../../systems/game-state.js';
import { template, displayName, maxTp } from '../../systems/player.js';
import { itemCount } from '../../systems/inventory.js';
import { ITEMS } from '../../data/items.js';
import { ELEMENTS } from '../../data/elements.js';
import { APPROACHES, PERSONALITIES } from '../../data/personalities.js';
import { RARITY, ENCOUNTER } from '../../config.js';
import { portrait, elementBadge, rarityBadge, posBadge, modal, toast } from '../components.js';
import { audio } from '../../audio/audio.js';
import { haptic } from '../../core/haptics.js';

export class EncounterScene {
  constructor(app, { templateId, level, kind, onEnd }) {
    this.app = app;
    this.onEnd = onEnd;
    this.kind = kind;
    try {
      this.enc = createEncounter(app.game, { templateId, level, kind });
    } catch (err) {
      toast(err.message, { type: 'error' });
      this.enc = null;
    }
    this.mode = 'main';
    this.anim = null;
  }

  get game() { return this.app.game; }

  enter() {
    if (!this.enc) { setTimeout(() => this.onEnd('fled'), 0); return; }
    audio.playMusic('encounter');
    this.el = h('div', { class: 'encounter' });
    this.app.uiLayer.appendChild(this.el);
    this.app.lock();
    this.render();
  }

  exit() { this.el?.remove(); if (this.enc) this.app.unlock(); }

  update() {
    const input = this.app.input;
    if (!this.enc || this.busy) return;
    if (this.mode === 'main' && this.enc.status === 'choose') {
      if (input.consume('pass') || input.consume('dribble')) this.act({ type: 'dribble' });
      else if (input.consume('shoot')) this.act({ type: 'shoot' });
    }
  }

  draw() {
    const ctx = this.app.canvas.getContext('2d');
    const el = this.enc ? ELEMENTS[template(this.enc.wild).element] : ELEMENTS.wind;
    const c = this.app.canvas;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#0a1430'); g.addColorStop(1, el.color);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3;
    const t = performance.now() / 1000;
    for (let i = 0; i < 30; i++) { const y = ((i * 71 + t * 200) % c.height); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y - 200); ctx.stroke(); }
  }

  async act(action) {
    if (this.busy) return;
    this.busy = true;
    const before = this.enc.log.length;
    playerTurn(this.game, this.enc, action);
    const fx = this.enc.lastFx;
    if (fx) {
      audio.play('tech');
      haptic(40);
      await this.techBanner(fx.tech, fx.by);
    } else audio.play(action.type === 'shoot' ? 'shot' : 'kick');
    this.newLines = this.enc.log.length - before;
    this.busy = false;
    this.mode = 'main';
    this.render();
    if (this.enc.status === 'recruited') { audio.play('recruit'); }
    if (this.enc.status === 'won') audio.play('levelup');
  }

  techBanner(tech, by) {
    return new Promise((resolve) => {
      const el = ELEMENTS[tech.element];
      const b = h('div', { class: `tech-banner ${by}`, style: { '--el': el.color, '--glow': el.glow } }, h('span', {}, el.icon), h('b', {}, tech.name.toUpperCase()));
      this.el.appendChild(b);
      setTimeout(() => { b.remove(); resolve(); }, 1300);
    });
  }

  render() {
    const enc = this.enc;
    const st = this.game.state;
    const me = getPlayer(st, enc.active);
    const wt = template(enc.wild);
    const mt = template(me);
    const moralePct = (enc.morale / ENCOUNTER.maxMorale) * 100;
    const myPool = enc.pools[enc.active];
    clear(this.el);
    const title = { wild: '¡Desafío callejero!', challenge: '¡Reto!', lead: 'Pista del ojeador' }[enc.kind];
    this.el.append(
      h('div', { class: 'enc-title' }, title),
      h('div', { class: 'enc-field' },
        h('div', { class: 'enc-side me' },
          portrait(mt.id, { size: 170, cls: 'enc-portrait' }),
          h('div', { class: 'enc-card' },
            h('b', {}, `${displayName(me)} Nv.${me.level}`), h('div', { class: 'pc-badges' }, posBadge(mt.position), elementBadge(mt.element)),
            bar('Resistencia', myPool, 100, '#4cc96b'),
            bar('PT', enc.tps[enc.active], maxTp(me), '#4bb8ff'))),
        h('div', { class: 'enc-vs' }, 'VS'),
        h('div', { class: 'enc-side wild' },
          portrait(wt.id, { size: 170, cls: 'enc-portrait', jersey: '#455a64', jersey2: '#eceff1' }),
          h('div', { class: 'enc-card' },
            h('b', {}, `${wt.name} ${wt.surname} Nv.${enc.level}`), h('div', { class: 'pc-badges' }, posBadge(wt.position), elementBadge(wt.element), rarityBadge(wt.rarity)),
            h('div', { class: 'small' }, `Personalidad: ${st.encyclopedia.recruited.length > 3 ? PERSONALITIES[wt.personality].label : '???'}`),
            bar('Ánimo', enc.morale, ENCOUNTER.maxMorale, moralePct > 50 ? '#ff9f43' : moralePct > 20 ? '#f2c94c' : '#ff4d6d')))),
      h('div', { class: 'enc-log' }, enc.log.slice(-5).map((l, i, arr) => h('div', { class: i >= arr.length - (this.newLines || 0) ? 'new' : '' }, l))),
      h('div', { class: 'enc-actions' }, this.actions()));
  }

  actions() {
    const enc = this.enc;
    if (enc.status === 'recruited') return [h('p', { class: 'big-msg' }, '🤝 ¡Nuevo jugador en tu equipo!'), h('button', { class: 'btn primary big', onclick: () => this.onEnd('recruited') }, 'Continuar')];
    if (enc.status === 'fled') return [h('button', { class: 'btn big', onclick: () => this.onEnd('fled') }, 'Volver')];
    if (enc.status === 'lost') return [h('p', { class: 'big-msg' }, 'Has perdido el desafío...'), h('button', { class: 'btn big', onclick: () => this.onEnd('lost') }, 'Volver')];
    if (enc.status === 'won') {
      if (enc.kind === 'challenge') return [h('button', { class: 'btn big', onclick: () => this.onEnd('won') }, 'Continuar')];
      return [
        h('p', { class: 'big-msg' }, `¡${template(enc.wild).name} se rinde! Ahora es más fácil convencerle.`),
        h('button', { class: 'btn primary big', onclick: () => this.convinceDialog(true) }, '✉️ Invitar al equipo'),
        h('button', { class: 'btn big', onclick: () => this.onEnd('won') }, 'Despedirse'),
      ];
    }
    const av = availableActions(this.game, enc);
    if (this.mode === 'techs') {
      return [
        ...av.techniques.map((t) => h('button', { class: 'btn tech', disabled: !t.usable, style: { borderColor: ELEMENTS[t.element].color }, onclick: () => this.act({ type: 'tech', techId: t.id }) }, `${ELEMENTS[t.element].icon} ${t.name}`, h('small', {}, ` ${t.tp} PT`))),
        av.techniques.length ? null : h('p', { class: 'muted' }, 'Este jugador no tiene técnicas ofensivas equipadas.'),
        h('button', { class: 'btn', onclick: () => { this.mode = 'main'; this.render(); } }, '← Volver'),
      ];
    }
    if (this.mode === 'switch') {
      const st = this.game.state;
      return [
        ...Object.entries(enc.pools).filter(([uid, v]) => uid !== enc.active && v > 0).slice(0, 10).map(([uid, v]) => {
          const p = getPlayer(st, uid);
          return h('button', { class: 'btn', onclick: () => this.act({ type: 'switch', uid }) }, `${displayName(p)} (${template(p).position}) · ${v}`);
        }),
        h('button', { class: 'btn', onclick: () => { this.mode = 'main'; this.render(); } }, '← Volver'),
      ];
    }
    return [
      h('button', { class: 'btn action', onclick: () => this.act({ type: 'dribble' }) }, '💨 Regate', h('small', {}, 'Regate vs. Defensa')),
      h('button', { class: 'btn action', onclick: () => this.act({ type: 'shoot' }) }, '⚽ Tiro', h('small', {}, 'Tiro vs. Bloqueo/Portero')),
      h('button', { class: 'btn action primary', onclick: () => { this.mode = 'techs'; this.render(); } }, '⚡ Técnicas', h('small', {}, 'Gasta PT, aplica elemento')),
      av.canConvince ? h('button', { class: 'btn action', onclick: () => this.convinceDialog(false) }, '✉️ Convencer', h('small', {}, 'Mejor con su ánimo bajo')) : null,
      h('button', { class: 'btn action', onclick: () => { this.mode = 'switch'; this.render(); } }, '🔄 Cambiar'),
      av.canFlee ? h('button', { class: 'btn action', onclick: () => this.act({ type: 'flee' }) }, '🏃 Retirarse') : null,
    ];
  }

  async convinceDialog(afterWin) {
    const st = this.game.state;
    const invites = ITEMS.filter((i) => i.type === 'invite' && itemCount(st, i.id) > 0);
    if (!invites.length) { toast('No tienes cartas de invitación. Cómpralas en la tienda.', { type: 'error' }); return; }
    let invite = invites[0].id;
    const t = template(this.enc.wild);
    const chanceEl = h('div', { class: 'chance' });
    let approach = 'inspirar';
    const update = () => {
      const morale = afterWin ? 0 : this.enc.morale;
      const c = previewConvince(this.game, { ...this.enc, morale }, approach, invite);
      chanceEl.textContent = `Probabilidad estimada: ${Math.round(c * 100)}% (rareza ${RARITY[t.rarity].label})`;
    };
    const body = h('div', {},
      h('p', {}, `¿Cómo quieres convencer a ${t.name}? Cada personalidad responde mejor a un enfoque.`),
      h('div', { class: 'approach-list' }, Object.entries(APPROACHES).map(([id, a]) => h('label', { class: 'approach' },
        h('input', { type: 'radio', name: 'appr', value: id, checked: id === approach, onchange: () => { approach = id; update(); } }),
        h('b', {}, a.label), h('span', { class: 'small muted' }, ` — ${a.desc}`)))),
      h('label', { class: 'set-row' }, 'Invitación: ', h('select', { onchange: (e) => { invite = e.target.value; update(); } },
        invites.map((i) => h('option', { value: i.id }, `${i.icon} ${i.name} (x${itemCount(st, i.id)})`)))),
      chanceEl);
    update();
    const ok = await modal({ title: `Convencer a ${t.name} ${t.surname}`, body, buttons: [{ text: 'Cancelar', value: false }, { text: 'Enviar invitación', value: true, cls: 'primary' }] });
    if (!ok) return;
    if (afterWin) {
      const r = convinceAfterWin(this.game, this.enc, approach, invite);
      if (!r.ok) toast(r.message, { type: 'error' });
      else if (!r.success) { audio.play('error'); toast(r.message, { type: 'warn' }); }
      this.render();
    } else {
      await this.act({ type: 'convince', approach, inviteId: invite });
    }
  }
}

function bar(label, value, max, color) {
  return h('div', { class: 'enc-bar' }, h('span', {}, `${label} ${Math.round(value)}/${max}`),
    h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color } })));
}
