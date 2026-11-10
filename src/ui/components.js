// Componentes de interfaz reutilizables: retratos, insignias, barras de
// estadísticas, tarjetas de jugador, diálogo, notificaciones y modales.

import { h, clear } from './dom.js';
import { STATS, STAT_SHORT, STAT_LABELS, RARITY, POSITION_SHORT } from '../config.js';
import { ELEMENTS } from '../data/elements.js';
import { TECHNIQUE_CATEGORIES } from '../data/techniques.js';
import { PERSONALITIES } from '../data/personalities.js';
import { PLAYER_TEAM } from '../data/teams.js';
import { getPlayerTemplate, getTechnique } from '../systems/database.js';
import { effectiveStats, template, overall, maxTp, xpToNext, fatigueLabel, TECH_LEVEL_LABEL, techPower } from '../systems/player.js';
import { lookFor, portraitURL } from '../render/sprites.js';
import { audio } from '../audio/audio.js';

export function portrait(templateId, { size = 64, mood, jersey = PLAYER_TEAM.colors.primary, jersey2 = PLAYER_TEAM.colors.secondary, cls = '' } = {}) {
  const t = getPlayerTemplate(templateId);
  const src = portraitURL(templateId, lookFor(t), { element: t.element, jersey, jersey2, mood }, 128);
  return h('img', { class: `portrait ${cls}`, src, width: size, height: size, alt: `${t.name} ${t.surname}`, draggable: 'false' });
}

export function lookPortrait(key, look, { size = 64, element = null } = {}) {
  const src = portraitURL(key, { eyes: '#333', ...look }, { element, jersey: look.shirt || '#455a64', jersey2: '#eceff1' }, 128);
  return h('img', { class: 'portrait', src, width: size, height: size, alt: '', draggable: 'false' });
}

export function elementBadge(el) {
  const e = ELEMENTS[el];
  return h('span', { class: 'badge el', style: { background: e.color }, title: e.label }, `${e.icon} ${e.label}`);
}

export function rarityBadge(r) {
  const rr = RARITY[r];
  return h('span', { class: `badge rarity r-${r}`, style: { borderColor: rr.color, color: rr.color } }, rr.label);
}

export function posBadge(pos) { return h('span', { class: `badge pos pos-${pos}` }, POSITION_SHORT[pos]); }

export function statBars(stats, { max = 160, compare = null } = {}) {
  return h('div', { class: 'stat-bars' }, STATS.map((s) => {
    const v = stats[s];
    const diff = compare ? v - compare[s] : 0;
    return h('div', { class: 'stat-row' },
      h('span', { class: 'stat-name', title: STAT_LABELS[s] }, STAT_SHORT[s]),
      h('div', { class: 'stat-track' }, h('div', { class: 'stat-fill', style: { width: `${Math.min(100, (v / max) * 100)}%` } })),
      h('span', { class: 'stat-val' }, v, diff ? h('small', { class: diff > 0 ? 'up' : 'down' }, ` ${diff > 0 ? '+' : ''}${diff}`) : null));
  }));
}

export function techChip(techId, level = 1, { equipped = null, onclick = null } = {}) {
  const t = getTechnique(techId);
  const el = ELEMENTS[t.element];
  return h('div', { class: `tech-chip ${equipped === false ? 'off' : ''} ${onclick ? 'clickable' : ''}`, style: { borderLeftColor: el.color }, onclick, title: t.desc },
    h('span', { class: 'tech-cat' }, TECHNIQUE_CATEGORIES[t.category].icon),
    h('span', { class: 'tech-name' }, t.name),
    h('span', { class: 'tech-meta' }, `${TECH_LEVEL_LABEL[level]} · POT ${techPower(techId, level)} · ${t.tp} PT`),
    equipped !== null ? h('span', { class: 'tech-eq' }, equipped ? '✔' : '—') : null);
}

/** Tarjeta compacta de jugador (listas). */
export function playerCard(player, { onclick = null, selected = false, extra = null, compact = false } = {}) {
  const t = template(player);
  const f = fatigueLabel(player.fatigue);
  return h('div', { class: `player-card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`, onclick: onclick ? () => { audio.play('click'); onclick(player); } : null, style: { borderColor: RARITY[t.rarity].color } },
    portrait(t.id, { size: compact ? 40 : 56 }),
    h('div', { class: 'pc-info' },
      h('div', { class: 'pc-name' }, `${t.name} ${t.surname}`),
      h('div', { class: 'pc-badges' }, posBadge(t.position), elementBadge(t.element), compact ? null : rarityBadge(t.rarity)),
      compact ? null : h('div', { class: 'pc-sub' }, `Nv.${player.level} · MED ${overall(player)} · `, h('span', { style: { color: f.color } }, f.label))),
    compact ? h('div', { class: 'pc-ovr' }, overall(player)) : null,
    extra);
}

/** Ficha completa del jugador. */
export function playerSheet(player, { actions = [] } = {}) {
  const t = template(player);
  const stats = effectiveStats(player, { applyFatigue: false });
  const next = xpToNext(player.level);
  const pers = PERSONALITIES[t.personality];
  const f = fatigueLabel(player.fatigue);
  return h('div', { class: 'player-sheet' },
    h('div', { class: 'ps-head' },
      portrait(t.id, { size: 140, cls: 'big' }),
      h('div', { class: 'ps-id' },
        h('h2', {}, `${t.name} ${t.surname}`),
        h('div', { class: 'pc-badges' }, posBadge(t.position), elementBadge(t.element), rarityBadge(t.rarity)),
        h('div', { class: 'ps-line' }, `Nivel ${player.level} · Media ${overall(player)} · PT máx. ${maxTp(player)}`),
        h('div', { class: 'xp-bar' }, h('div', { style: { width: `${(player.xp / next) * 100}%` } })),
        h('div', { class: 'ps-line small' }, `XP ${player.xp}/${next}`),
        h('div', { class: 'ps-line' }, 'Personalidad: ', h('b', {}, pers.label), ` — ${pers.desc}`),
        h('div', { class: 'ps-line' }, 'Estado: ', h('b', { style: { color: f.color } }, `${f.label} (${Math.round(player.fatigue)}% fatiga)`)),
        h('div', { class: 'ps-line small' }, `Procedencia: ${t.team === 'free' ? 'Agente libre' : t.team === 'rayo_azul' ? 'Instituto Rayo Azul' : t.team} · Partidos ${player.matches} · Goles ${player.goals}`),
        h('div', { class: 'actions' }, actions))),
    h('p', { class: 'ps-bio' }, t.bio),
    h('div', { class: 'ps-cols' },
      h('div', {}, h('h3', {}, 'Estadísticas'), statBars(stats),
        h('div', { class: 'small muted' }, 'Entrenamiento: ', STATS.filter((s) => player.trained[s]).map((s) => `${STAT_SHORT[s]} +${player.trained[s]}`).join(' · ') || 'ninguno')),
      h('div', {}, h('h3', {}, 'Técnicas'),
        player.techniques.length ? player.techniques.map((pt) => techChip(pt.id, pt.level, { equipped: pt.equipped })) : h('p', { class: 'muted' }, 'Aún no conoce técnicas.'),
        h('h3', {}, 'Por aprender'),
        h('div', { class: 'small muted' }, t.learnset.filter((l) => !player.techniques.some((x) => x.id === l.tech)).map((l) => `Nv.${l.level}: ${getTechnique(l.tech).name}`).join(' · ') || '—'),
        h('h3', {}, 'Equipo'),
        h('div', { class: 'small' }, Object.entries(player.equipment).map(([slot, id]) => `${{ boots: '👟', gloves: '🧤', accessory: '💍' }[slot]} ${id ? id.replace(/_/g, ' ') : '—'}`).join(' · ')))));
}

// ---------------------------------------------------------------- notificaciones

let toastRoot = null;
export function toast(text, { type = 'info', icon = null, duration = 2800 } = {}) {
  if (!toastRoot) { toastRoot = h('div', { class: 'toasts' }); document.body.appendChild(toastRoot); }
  const el = h('div', { class: `toast ${type}` }, icon ? h('span', { class: 'ticon' }, icon) : null, text);
  toastRoot.appendChild(el);
  // Máximo 4 avisos visibles: los más antiguos se retiran.
  while (toastRoot.children.length > 4) toastRoot.firstChild.remove();
  setTimeout(() => el.classList.add('out'), duration);
  setTimeout(() => el.remove(), duration + 400);
}

// ---------------------------------------------------------------- modales

export function modal({ title, body, buttons = [{ text: 'Cerrar', value: null }], cls = '', dismissable = true }) {
  return new Promise((resolve) => {
    const close = (v) => { audio.play('click'); overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    const overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay && dismissable) close(null); } },
      h('div', { class: `modal ${cls}` },
        title ? h('h2', {}, title) : null,
        h('div', { class: 'modal-body' }, body),
        h('div', { class: 'modal-buttons' }, buttons.map((b) => h('button', { class: `btn ${b.cls || ''}`, disabled: b.disabled, onclick: () => close(b.value) }, b.text)))));
    overlay.closeModal = close;
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.modal-buttons .btn:not([disabled])')?.focus();
  });
}

/** Cierra el modal superior resolviendo su promesa con `value`. */
export function closeTopModal(value = null) {
  const all = document.querySelectorAll('.modal-overlay');
  const top = all[all.length - 1];
  if (top?.closeModal) top.closeModal(value);
  else top?.remove();
}

export const confirmModal = (title, text) => modal({ title, body: h('p', {}, text), buttons: [{ text: 'Cancelar', value: false }, { text: 'Aceptar', value: true, cls: 'primary' }] });

/** Selector de jugador en modal. */
export function pickPlayerModal(players, title = 'Elige un jugador', note = null) {
  return new Promise((resolve) => {
    let overlay;
    const done = (v) => { overlay.remove(); resolve(v); };
    overlay = h('div', { class: 'modal-overlay' },
      h('div', { class: 'modal wide' }, h('h2', {}, title), note ? h('p', { class: 'muted' }, note) : null,
        h('div', { class: 'card-grid' }, players.map((p) => playerCard(p, { onclick: () => done(p) }))),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: () => done(null) }, 'Cancelar'))));
    document.body.appendChild(overlay);
  });
}

// ---------------------------------------------------------------- diálogo

export class DialogueBox {
  constructor(root) {
    this.root = root;
    this.el = h('div', { class: 'dialogue hidden' });
    root.appendChild(this.el);
    this.resolve = null;
    this.typing = null;
    this.speed = 2;
  }

  get open() { return !this.el.classList.contains('hidden'); }

  say(who, text, portraitEl = null) {
    return new Promise((resolve) => {
      clear(this.el);
      this.el.classList.remove('hidden');
      const textEl = h('div', { class: 'dlg-text' });
      this.el.append(
        portraitEl ? h('div', { class: 'dlg-portrait' }, portraitEl) : null,
        h('div', { class: 'dlg-main' }, who ? h('div', { class: 'dlg-name' }, who) : null, textEl, h('div', { class: 'dlg-next' }, '▼')));
      let i = 0;
      const cps = [0, 30, 60, 140][this.speed] || 60;
      clearInterval(this.typing);
      this.typing = setInterval(() => {
        i += Math.max(1, Math.round(cps / 30));
        textEl.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(this.typing); this.typing = null; }
      }, 33);
      this.resolve = () => {
        if (this.typing) { clearInterval(this.typing); this.typing = null; textEl.textContent = text; return false; }
        this.el.classList.add('hidden');
        resolve();
        return true;
      };
      this.el.onclick = () => this.advance();
    });
  }

  advance() {
    if (this.resolve && this.resolve()) { this.resolve = null; audio.play('click'); }
  }

  choice(question, options, who = '') {
    return new Promise((resolve) => {
      clear(this.el);
      this.el.classList.remove('hidden');
      this.el.onclick = null;
      this.resolve = null;
      const pick = (i) => { audio.play('select'); this.el.classList.add('hidden'); document.removeEventListener('keydown', onKey); resolve(i); };
      const onKey = (e) => { const n = Number(e.key); if (n >= 1 && n <= options.length) pick(n - 1); };
      document.addEventListener('keydown', onKey);
      this.el.append(h('div', { class: 'dlg-main' },
        who ? h('div', { class: 'dlg-name' }, who) : null,
        h('div', { class: 'dlg-text' }, question),
        h('div', { class: 'dlg-choices' }, options.map((o, i) => h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); pick(i); } }, `${i + 1}. ${o}`)))));
      this.el.querySelector('.dlg-choices .btn')?.focus();
    });
  }
}

/** Tarjeta de título de capítulo / cinemática. */
export function titleCard(root, title, subtitle) {
  return new Promise((resolve) => {
    audio.play('lightning');
    const el = h('div', { class: 'title-card' }, h('div', { class: 'tc-bolt' }), h('h1', {}, title), h('h2', {}, subtitle));
    root.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2300);
    setTimeout(() => { el.remove(); resolve(); }, 2800);
  });
}

export function screenFx(root, kind) {
  return new Promise((resolve) => {
    const el = h('div', { class: `screen-fx fx-${kind}` });
    root.appendChild(el);
    if (kind === 'lightning') audio.play('lightning');
    if (kind === 'shake') root.classList.add('shaking');
    setTimeout(() => { el.remove(); root.classList.remove('shaking'); resolve(); }, kind === 'fade' ? 900 : 600);
  });
}
