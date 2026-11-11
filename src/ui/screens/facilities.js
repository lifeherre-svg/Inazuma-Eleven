// Instalaciones: tienda, oficina de ojeadores, entrenamiento (con minijuego
// de precisión), torneos y punto de guardado.

import { h, clear, fmtMoney } from '../dom.js';
import { SHOPS } from '../../data/items.js';
import { TRAININGS } from '../../data/trainings.js';
import { MAPS } from '../../data/maps.js';
import { ELEMENTS } from '../../data/elements.js';
import { POSITIONS, POSITION_LABELS, STAT_LABELS, FATIGUE } from '../../config.js';
import { getItem, getTeam, getPlayerTemplate, getTechnique } from '../../systems/database.js';
import { buyItem, sellItem, itemCount, listInventory } from '../../systems/inventory.js';
import { scoutSearch, scoutCost } from '../../systems/recruitment.js';
import { train } from '../../systems/training.js';
import { listTournaments, canEnter, enterTournament, recordTournamentMatch, nextOpponent } from '../../systems/tournaments.js';
import { template, displayName, fatigueLabel } from '../../systems/player.js';
import { visitedMaps } from '../../world/world.js';
import { SLOTS } from '../../systems/save.js';
import { audio } from '../../audio/audio.js';
import { modal, toast, playerCard, closeTopModal } from '../components.js';
import { slotInfo } from './title.js';

export class Facilities {
  constructor(app) { this.app = app; }
  get game() { return this.app.game; }
  get state() { return this.app.game.state; }

  // ---------------------------------------------------------------- tienda
  async shop(shopId) {
    const list = SHOPS[shopId] || [];
    const body = h('div', {});
    const render = () => {
      clear(body).append(
        h('p', {}, 'Tu dinero: ', h('b', {}, fmtMoney(this.state.money))),
        h('h3', {}, 'Comprar'),
        h('div', { class: 'item-grid' }, list.map((id) => {
          const it = getItem(id);
          return h('div', { class: 'item-card' }, h('div', { class: 'item-icon' }, it.icon),
            h('div', {}, h('b', {}, it.name), h('div', { class: 'small muted' }, it.desc), h('div', { class: 'small' }, `${fmtMoney(it.price)} · Tienes ${itemCount(this.state, id)}`)),
            h('button', { class: 'btn small primary', disabled: this.state.money < it.price, onclick: () => { const r = buyItem(this.game, id, 1); toast(r.message, { type: r.ok ? 'success' : 'error' }); render(); } }, 'Comprar'));
        })),
        h('h3', {}, 'Vender'),
        h('div', { class: 'item-grid' }, listInventory(this.state).filter(({ item }) => item.type !== 'key' && item.price > 0).map(({ item, qty }) => h('div', { class: 'item-card' },
          h('div', { class: 'item-icon' }, item.icon), h('div', {}, h('b', {}, `${item.name} ×${qty}`), h('div', { class: 'small' }, `Se vende por ${fmtMoney(Math.floor(item.price / 2))}`)),
          h('button', { class: 'btn small', onclick: () => { const r = sellItem(this.game, item.id); toast(r.message); render(); } }, 'Vender')))));
    };
    render();
    this.app.lock();
    await modal({ title: '🛒 Tienda', body, cls: 'wide' });
    this.app.unlock();
  }

  // ---------------------------------------------------------------- ojeadores
  async scout() {
    const zones = visitedMaps(this.state);
    let pos = '', el = '';
    const body = h('div', {});
    const render = (msg = null) => {
      clear(body).append(
        h('p', {}, 'Los ojeadores buscan jugadores libres en las zonas que has visitado. Cuando encuentran a alguien, aparece en el mapa marcado con ★: ve a retarle.'),
        h('div', { class: 'row' },
          h('label', {}, 'Posición ', h('select', { onchange: (e) => { pos = e.target.value; } }, h('option', { value: '' }, 'Cualquiera'), POSITIONS.map((p) => h('option', { value: p, selected: pos === p }, POSITION_LABELS[p])))),
          h('label', {}, 'Elemento ', h('select', { onchange: (e) => { el = e.target.value; } }, h('option', { value: '' }, 'Cualquiera'), Object.values(ELEMENTS).map((x) => h('option', { value: x.id, selected: el === x.id }, `${x.icon} ${x.label}`)))),
          h('button', { class: 'btn primary', onclick: () => {
            const r = scoutSearch(this.game, { position: pos || null, element: el || null, zones });
            audio.play(r.ok ? 'item' : 'error');
            render(r.message);
          } }, `🔭 Buscar (${fmtMoney(scoutCost(this.state))})`)),
        msg ? h('p', { class: 'chance' }, msg) : null,
        h('h3', {}, 'Pistas activas'),
        this.state.scout.leads.length ? this.state.scout.leads.map((l) => {
          const t = getPlayerTemplate(l.templateId);
          return h('div', { class: 'small' }, `★ ${t.name} ${t.surname} (Nv.${l.level}, ${ELEMENTS[t.element].icon} ${POSITION_LABELS[t.position]}) — ${MAPS.find((m) => m.id === l.map)?.name} (${l.x}, ${l.y})`);
        }) : h('p', { class: 'muted small' }, 'Ninguna.'));
    };
    render();
    this.app.lock();
    await modal({ title: '🔭 Red de ojeadores', body, cls: 'wide' });
    this.app.unlock();
  }

  // ---------------------------------------------------------------- entrenamiento
  async training() {
    this.app.lock();
    let selected = null;
    let drill = TRAININGS[0].id;
    const body = h('div', { class: 'training' });
    const render = () => {
      const st = this.state;
      const players = st.roster.slice().sort((a, b) => a.fatigue - b.fatigue);
      clear(body).append(
        h('p', { class: 'small muted' }, `Elige un jugador y un ejercicio. Durante el minijuego ${this.app.isTouch ? 'toca el botón' : 'pulsa ESPACIO (o el botón)'} cuando el marcador esté en la zona dorada. Mejor precisión = más mejora. El entrenamiento genera fatiga: descansa en casa, en el hotel o en los refugios.`),
        h('div', { class: 'split' },
          h('div', { class: 'list-col' }, players.map((p) => playerCard(p, { compact: true, selected: selected === p.uid, onclick: () => { selected = p.uid; render(); },
            extra: h('span', { class: 'small', style: { color: fatigueLabel(p.fatigue).color } }, `${Math.round(p.fatigue)}%`) }))),
          h('div', { class: 'detail-col' },
            h('div', { class: 'drills' }, TRAININGS.map((t) => h('button', { class: `btn drill ${drill === t.id ? 'selected' : ''}`, onclick: () => { drill = t.id; render(); } },
              h('span', { class: 'drill-icon' }, t.icon), h('b', {}, t.name), h('small', {}, Object.entries(t.gains).map(([k, v]) => `${STAT_LABELS[k]} +${v}`).join(' · ')), h('small', {}, `Fatiga +${t.fatigue}`)))),
            h('button', { class: 'btn big primary', disabled: !selected, onclick: async () => {
              const p = st.roster.find((x) => x.uid === selected);
              if (p.fatigue >= 85) { toast('Está demasiado cansado.', { type: 'error' }); return; }
              const q = await timingMinigame(drill);
              const r = train(this.game, selected, drill, q);
              if (!r.ok) { toast(r.message, { type: 'error' }); return; }
              audio.play(r.report.levelUp ? 'levelup' : 'item');
              const g = Object.entries(r.report.gains).map(([k, v]) => `${STAT_LABELS[k]} +${v}`).join(', ') || 'sin mejoras (límite alcanzado)';
              toast(`${displayName(p)}: ${g}. +${r.report.xp} XP${r.report.levelUp ? ' ¡Sube de nivel!' : ''}`, { type: 'success', duration: 3500 });
              if (r.report.insight && !r.report.learned) toast(`💡 ${getTechnique(r.report.insight.techId).name}: ${r.report.insight.progress}%`, { duration: 3000 });
              for (const t of r.report.techUps) toast(`✨ ${getTechnique(t).name} sube de nivel`);
              render();
            } }, '¡Entrenar!'))));
    };
    render();
    await modal({ title: '🏋️ Entrenamiento', body, cls: 'wide' });
    this.app.unlock();
  }

  // ---------------------------------------------------------------- torneos
  tournamentsPanel(refresh, closeMenu) {
    const st = this.state;
    return h('div', {}, h('h2', {}, 'Torneos y competiciones'),
      h('div', { class: 'tour-grid' }, listTournaments(st).map(({ t, unlocked, st: ts }) => {
        const check = canEnter(st, t.id);
        const next = nextOpponent(st, t.id);
        return h('div', { class: `tour-card ${unlocked ? '' : 'locked'}` },
          h('div', { class: 'tour-head' }, h('span', { class: 'tour-icon' }, t.icon), h('div', {}, h('b', {}, t.name), h('div', { class: 'small muted' }, `${t.tier}${ts.titles ? ` · 🏆×${ts.titles}` : ''}`))),
          h('p', { class: 'small' }, unlocked ? t.desc : `🔒 ${t.requires.text}`),
          unlocked ? h('ol', { class: 'rounds' }, t.rounds.map((r, i) => h('li', { class: i < ts.round ? 'done' : i === ts.round && ts.inProgress ? 'cur' : '' }, `${t.roundNames[i]}: ${getTeam(r.team).name} (Nv.${r.level + (ts.titles && t.repeatable ? 4 * ts.titles : 0)})`))) : null,
          unlocked ? h('div', { class: 'small muted' }, 'Premio: ', [t.rewards.money ? fmtMoney(ts.titles ? (t.repeatRewards?.money || 0) : t.rewards.money) : null, ...Object.entries((ts.titles ? t.repeatRewards?.items : t.rewards.items) || {}).map(([id, n]) => `${n}× ${getItem(id).name}`)].filter(Boolean).join(' · ')) : null,
          unlocked ? h('button', { class: 'btn primary', disabled: !check.ok, title: check.reason || '', onclick: async () => { closeMenu?.(); await this.playTournament(t.id); } },
            check.ok ? (ts.inProgress ? `Jugar: ${next?.roundName}` : 'Inscribirse') : check.reason) : null);
      })));
  }

  async tournaments() {
    this.app.lock();
    await modal({ title: '🏆 Torneos', cls: 'wide', body: this.tournamentsPanel(null, () => closeTopModal()) });
    this.app.unlock();
  }

  /** Juega las rondas de un torneo de forma consecutiva hasta ser eliminado, ganarlo o pausarlo. */
  async playTournament(id) {
    const r = enterTournament(this.game, id);
    if (!r.ok) { toast(r.reason, { type: 'error' }); return; }
    const t = listTournaments(this.state).find((x) => x.t.id === id).t;
    for (;;) {
      const opp = nextOpponent(this.state, id);
      if (!opp) return;
      const res = await this.app.playMatch({ team: opp.team, level: opp.level, context: 'tournament', tournamentName: `${t.name} · ${opp.roundName}` });
      if (res.aborted) return;
      const out = recordTournamentMatch(this.game, id, res.won);
      if (out.status === 'eliminated') { await modal({ title: 'Eliminados', body: h('p', {}, `Habéis caído en ${opp.roundName}. ¡Entrena y vuelve a intentarlo!`) }); return; }
      if (out.status === 'champion') {
        audio.playMusic('victory');
        await modal({ title: `🏆 ¡Campeones del ${t.name}!`, cls: 'wide', body: h('div', { class: 'champion' }, h('div', { class: 'trophy' }, '🏆'), h('p', {}, '¡El esfuerzo del equipo ha dado sus frutos!'),
          h('p', {}, [out.rewards.money ? fmtMoney(out.rewards.money) : null, ...Object.entries(out.rewards.items || {}).map(([i, n]) => `${n}× ${getItem(i).name}`)].filter(Boolean).join(' · '))) });
        return;
      }
      const cont = await modal({ title: '¡Ronda superada!', body: h('p', {}, `Siguiente: ${out.next.roundName} contra ${getTeam(out.next.team).name}.`),
        buttons: [{ text: 'Descansar y seguir luego', value: false }, { text: 'Jugar ahora', value: true, cls: 'primary' }] });
      if (!cont) return;
    }
  }

  // ---------------------------------------------------------------- guardado
  async saveDialog() {
    const app = this.app;
    const labels = { slot1: 'Ranura 1', slot2: 'Ranura 2', slot3: 'Ranura 3' };
    const slot = await modal({ title: '💾 Guardar partida', body: h('div', { class: 'slot-list' }, SLOTS.filter((s) => s !== 'auto').map((s) => h('div', { class: 'slot' },
      h('div', {}, h('b', {}, labels[s]), h('div', { class: 'small muted' }, slotInfo(app.saves.meta(s)))),
      h('button', { class: 'btn primary', onclick: () => closeTopModal(s) }, 'Guardar aquí')))), buttons: [{ text: 'Cancelar', value: null }] });
    if (slot) app.saveSlot(slot);
  }
}

/** Minijuego de precisión: 3 intentos; devuelve calidad 0..1. */
export function timingMinigame(drillId) {
  return new Promise((resolve) => {
    const tr = TRAININGS.find((t) => t.id === drillId);
    let attempt = 0;
    const scores = [];
    let pos = 0, dir = 1, raf = null, last = performance.now();
    const speed = () => 0.9 + attempt * 0.35;
    const zoneW = 0.16;
    let zoneX = 0.42;
    const marker = h('div', { class: 'mg-marker' });
    const zone = h('div', { class: 'mg-zone' });
    const info = h('div', { class: 'mg-info' }, `Intento 1/3`);
    const btn = h('button', { class: 'btn big primary' }, document.body.classList.contains('is-touch') ? '¡AHORA!' : '¡AHORA! (ESPACIO)');
    const overlay = h('div', { class: 'modal-overlay' }, h('div', { class: 'modal minigame' },
      h('h2', {}, `${tr.icon} ${tr.name}`), h('p', { class: 'small' }, tr.desc),
      h('div', { class: 'mg-track' }, zone, marker), info, btn));
    document.body.appendChild(overlay);
    const placeZone = () => { zoneX = 0.1 + Math.random() * 0.7; zone.style.left = `${zoneX * 100}%`; zone.style.width = `${zoneW * 100}%`; };
    placeZone();
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      pos += dir * speed() * dt;
      if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      marker.style.left = `${pos * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hit = () => {
      const center = zoneX + zoneW / 2;
      const d = Math.abs(pos - center);
      const s = d < zoneW / 2 ? 1 - (d / (zoneW / 2)) * 0.3 : Math.max(0, 0.6 - (d - zoneW / 2) * 2.5);
      scores.push(s);
      audio.play(s > 0.85 ? 'select' : s > 0.5 ? 'click' : 'error');
      info.textContent = `${s > 0.85 ? '¡PERFECTO!' : s > 0.6 ? '¡Bien!' : s > 0.3 ? 'Regular' : 'Fallo'} · Intento ${Math.min(3, attempt + 2)}/3`;
      attempt++;
      if (attempt >= 3) {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        const q = scores.reduce((a, b) => a + b, 0) / scores.length;
        info.textContent = `Calidad del entrenamiento: ${Math.round(q * 100)}%`;
        setTimeout(() => { overlay.remove(); resolve(q); }, 800);
      } else placeZone();
    };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hit(); } };
    document.addEventListener('keydown', onKey);
    // pointerdown: respuesta inmediata en pantallas táctiles (sin esperar al 'click').
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
  });
}

export { FATIGUE, template };
