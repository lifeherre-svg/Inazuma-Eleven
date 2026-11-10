// Nueva partida: nombre, selección de entrenador, aspecto y jugador inicial.

import { h, clear } from '../dom.js';
import { COACHES, AVATAR_PRESETS } from '../../data/coaches.js';
import { STARTER_IDS } from '../../data/players.js';
import { getPlayerTemplate, getTechnique } from '../../systems/database.js';
import { createPlayer, effectiveStats } from '../../systems/player.js';
import { portrait, elementBadge, posBadge, rarityBadge, statBars, lookPortrait } from '../components.js';
import { audio } from '../../audio/audio.js';
import { TitleScene } from './title.js';

export class NewGameScene {
  constructor(app) {
    this.app = app;
    this.choice = { name: '', coachId: COACHES[0].id, avatar: 0, starterId: STARTER_IDS[0] };
  }

  enter() {
    audio.playMusic('title');
    this.el = h('div', { class: 'newgame panel-screen' });
    this.app.uiLayer.appendChild(this.el);
    this.render();
  }

  exit() { this.el?.remove(); }

  render() {
    const c = this.choice;
    clear(this.el);
    const nameInput = h('input', { class: 'text-input', maxlength: 16, placeholder: 'Tu nombre', value: c.name, oninput: (e) => { c.name = e.target.value; } });
    this.el.append(
      h('h1', { class: 'screen-title' }, 'Nueva partida'),
      h('section', {}, h('h3', {}, '1. ¿Cómo te llamas, entrenador?'), nameInput),
      h('section', {}, h('h3', {}, '2. Aspecto'),
        h('div', { class: 'avatar-row' }, AVATAR_PRESETS.map((look, i) => h('div', { class: `avatar-opt ${c.avatar === i ? 'selected' : ''}`, onclick: () => { audio.play('click'); c.avatar = i; this.render(); } },
          lookPortrait(`avatar${i}`, { ...look, eyes: '#333' }, { size: 72 }))))),
      h('section', {}, h('h3', {}, '3. Estilo de entrenador'),
        h('div', { class: 'coach-row' }, COACHES.map((co) => h('div', { class: `coach-card ${c.coachId === co.id ? 'selected' : ''}`, style: { borderColor: co.color }, onclick: () => { audio.play('click'); c.coachId = co.id; this.render(); } },
          h('div', { class: 'coach-icon' }, co.icon), h('b', {}, co.name), h('p', {}, co.desc))))),
      h('section', {}, h('h3', {}, '4. Elige a tu primer gran fichaje'),
        h('div', { class: 'starter-row' }, STARTER_IDS.map((id) => {
          const t = getPlayerTemplate(id);
          const p = createPlayer(id, 5);
          return h('div', { class: `starter-card ${c.starterId === id ? 'selected' : ''}`, onclick: () => { audio.play('click'); c.starterId = id; this.render(); } },
            portrait(id, { size: 110 }),
            h('h4', {}, `${t.name} ${t.surname}`),
            h('div', { class: 'pc-badges' }, posBadge(t.position), elementBadge(t.element), rarityBadge(t.rarity)),
            h('p', { class: 'small' }, t.bio),
            statBars(effectiveStats(p), { max: 80 }),
            h('div', { class: 'small muted' }, 'Técnica: ', p.techniques.map((x) => getTechnique(x.id).name).join(', ')));
        }))),
      h('div', { class: 'screen-actions' },
        h('button', { class: 'btn', onclick: () => this.app.setScene(new TitleScene(this.app)) }, '← Volver'),
        h('button', { class: 'btn big primary', onclick: () => {
          c.name = (nameInput.value || '').trim() || 'Entrenador';
          audio.play('select');
          this.app.newGame(c);
        } }, '¡Empezar la aventura! ⚡')));
  }

  update() {}
  draw() {
    const ctx = this.app.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#081a3a';
    ctx.fillRect(0, 0, this.app.canvas.width, this.app.canvas.height);
  }
}
