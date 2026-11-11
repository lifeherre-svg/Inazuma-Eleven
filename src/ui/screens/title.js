// Menú principal: continuar, nueva partida, cargar, ajustes y créditos.

import { GAME } from '../../config.js';
import { h, fmtTime } from '../dom.js';
import { modal, toast, closeTopModal } from '../components.js';
import { audio } from '../../audio/audio.js';
import { NewGameScene } from './newgame.js';
import { settingsPanel } from './settings.js';
import { CHAPTERS } from '../../data/story.js';
import { drawBolt } from '../../render/vfx.js';

const SLOT_LABEL = { auto: 'Autoguardado', slot1: 'Ranura 1', slot2: 'Ranura 2', slot3: 'Ranura 3' };

export function slotInfo(meta) {
  if (!meta) return 'Vacía';
  if (meta.corrupt) return '⚠ Dañada (se intentará recuperar la copia de seguridad)';
  return `${meta.name} · ${CHAPTERS[meta.chapter]?.title.split(':')[0] || ''} · ${meta.players} jugadores · ${fmtTime(meta.playtime || 0)} · ${new Date(meta.savedAt).toLocaleString('es-ES')}`;
}

export class TitleScene {
  constructor(app) { this.app = app; this.t = 0; this.bolts = 0; }

  enter() {
    audio.playMusic('title');
    const app = this.app;
    const latest = app.saves.latestSlot();
    this.el = h('div', { class: 'title-screen' },
      h('div', { class: 'title-logo' },
        h('div', { class: 'logo-bolt' }, '⚡'),
        h('h1', {}, GAME.title),
        h('h2', {}, GAME.subtitle)),
      h('div', { class: 'title-menu' },
        latest ? h('button', { class: 'btn big primary', onclick: () => { audio.play('select'); app.loadSlot(latest); } }, '▶ Continuar') : null,
        h('button', { class: `btn big ${latest ? '' : 'primary'}`, onclick: () => { audio.play('select'); app.setScene(new NewGameScene(app)); } }, '✦ Nueva partida'),
        h('button', { class: 'btn big', onclick: () => this.loadMenu() }, '💾 Cargar partida'),
        h('button', { class: 'btn big', onclick: () => this.settings() }, '⚙ Configuración'),
        h('button', { class: 'btn big', onclick: () => this.credits() }, '★ Créditos')),
      h('div', { class: 'title-foot' }, `v${GAME.version} · Contenido original inspirado en el género de fútbol RPG · ${app.isTouch ? 'Toca la pantalla' : 'Pulsa cualquier tecla'} para activar el sonido`));
    app.uiLayer.appendChild(this.el);
  }

  exit() { this.el?.remove(); }

  async loadMenu() {
    const app = this.app;
    const slots = app.saves.listSlots();
    const body = h('div', { class: 'slot-list' }, slots.map(({ slot, meta }) => h('div', { class: 'slot' },
      h('div', {}, h('b', {}, SLOT_LABEL[slot]), h('div', { class: 'small muted' }, slotInfo(meta))),
      h('div', { class: 'slot-actions' },
        h('button', { class: 'btn primary', disabled: !meta, onclick: () => { closeTopModal(); app.loadSlot(slot); } }, 'Cargar')))),
    h('div', { class: 'import-row' },
      h('label', { class: 'btn' }, '📥 Importar partida (.json)', h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const r = app.saves.importToSlot('slot3', await file.text());
          if (r.ok) { toast('Partida importada en la Ranura 3', { type: 'success' }); closeTopModal(); this.loadMenu(); }
          else toast(r.error, { type: 'error' });
        } catch (err) { toast(`Archivo no válido: ${err.message}`, { type: 'error' }); }
      } }))));
    await modal({ title: 'Cargar partida', body, cls: 'wide' });
  }

  async settings() {
    const settings = JSON.parse(localStorage.getItem('ul_settings') || 'null') || null;
    await modal({ title: 'Configuración', body: settingsPanel(this.app, settings), cls: 'wide' });
  }

  credits() {
    modal({ title: 'Créditos', body: h('div', { class: 'credits' },
      h('p', {}, h('b', {}, GAME.title), ' — un RPG de fútbol con exploración, colección y partidos en tiempo real.'),
      h('p', {}, 'Diseño, programación, arte procedural, música generativa y textos: proyecto original.'),
      h('p', {}, 'Inspirado en los RPG de fútbol con supertécnicas y en los juegos de colección y exploración. Todos los personajes, equipos, técnicas y escenarios son originales; el sistema de datos permite sustituirlos por contenido con licencia.'),
      h('p', { class: 'muted' }, 'Tecnología: HTML5 Canvas, Web Audio API y JavaScript (módulos ES) sin dependencias.')) });
  }

  update(dt) { this.t += dt; }

  draw() {
    const { canvas } = this.app;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, hh = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#061331'); g.addColorStop(0.6, '#0d2b6b'); g.addColorStop(1, '#14522f');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
    // líneas de campo en perspectiva
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 40, hh * 0.6); ctx.lineTo(w / 2 + i * 220, hh); ctx.stroke(); }
    for (let j = 0; j < 8; j++) { const y = hh * 0.6 + Math.pow(j / 8, 1.8) * hh * 0.4 + ((this.t * 30) % 20); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // estrellas
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 80; i++) { const x = (i * 97) % w, y = (i * 53) % (hh * 0.55); ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(this.t + i)); ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
    // rayos ocasionales
    if (Math.random() < 0.012) this.bolts = 0.25;
    if (this.bolts > 0) {
      this.bolts -= 1 / 60;
      ctx.fillStyle = `rgba(200,220,255,${this.bolts * 0.6})`; ctx.fillRect(0, 0, w, hh);
      drawBolt(ctx, w * (0.2 + Math.random() * 0.6), 0, w * (0.3 + Math.random() * 0.4), hh * 0.55, '#fff59d', 4);
    }
  }
}
