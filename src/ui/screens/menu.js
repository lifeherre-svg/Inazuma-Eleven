// Menú de juego con pestañas: Equipo, Jugadores, Técnicas, Inventario,
// Misiones, Mapa, Torneos, Libreta, Guardar y Ajustes.

import { h, clear, fmtMoney, fmtTime } from '../dom.js';
import { FORMATIONS, OFFENSE_STRATEGIES, DEFENSE_STRATEGIES, PLAY_STYLES } from '../../data/formations.js';
import { PLAYERS } from '../../data/players.js';
import { MAPS } from '../../data/maps.js';
import { CHAPTERS } from '../../data/story.js';
import { ITEMS } from '../../data/items.js';
import { RARITY, POSITION_SHORT, PROGRESSION } from '../../config.js';
import { getFormation, getPlayerTemplate, getTechnique } from '../../systems/database.js';
import { autoLineup, assignSlot, setFormation, setCaptain, setStrategy, validateLineup, savePreset, loadPreset, positionFit, benchPlayer } from '../../systems/team.js';
import { template, overall, toggleEquipTechnique, equippedCount, unequipSlot, displayName } from '../../systems/player.js';
import { getPlayer, releasePlayer } from '../../systems/game-state.js';
import { listInventory, useItem, addItem } from '../../systems/inventory.js';
import { activeQuests, getQuest, questProgress } from '../../systems/quests.js';
import { currentChapter } from '../../systems/story.js';
import { visitedMaps } from '../../world/world.js';
import { SLOTS } from '../../systems/save.js';
import { audio } from '../../audio/audio.js';
import { playerCard, playerSheet, portrait, techChip, modal, confirmModal, pickPlayerModal, toast, elementBadge, rarityBadge, posBadge } from '../components.js';
import { settingsPanel } from './settings.js';
import { slotInfo } from './title.js';
import { WorldScene } from './world-scene.js';

const TABS = [
  ['team', '⚽ Equipo'], ['players', '👥 Jugadores'], ['techs', '⚡ Técnicas'], ['inventory', '🎒 Inventario'],
  ['quests', '📜 Misiones'], ['map', '🗺️ Mapa'], ['tournaments', '🏆 Torneos'], ['dex', '📒 Libreta'],
  ['save', '💾 Guardar'], ['settings', '⚙ Ajustes'],
];

export class Menu {
  constructor(app) { this.app = app; this.el = null; this.selectedSlot = null; this.selectedPlayer = null; }

  get game() { return this.app.game; }
  get state() { return this.app.game.state; }

  open(tab = 'team') {
    if (this.el) { this.show(tab); return this.promise; }
    audio.play('select');
    this.app.lock();
    this.body = h('div', { class: 'menu-body' });
    this.nav = h('div', { class: 'menu-nav' });
    this.el = h('div', { class: 'menu-overlay' }, h('div', { class: 'menu' }, this.nav, this.body));
    this.app.uiLayer.appendChild(this.el);
    this.keyHandler = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) this.close(); };
    document.addEventListener('keydown', this.keyHandler);
    this.promise = new Promise((r) => { this.resolve = r; });
    this.show(tab);
    return this.promise;
  }

  close() {
    if (!this.el) return;
    audio.play('click');
    this.el.remove();
    this.el = null;
    document.removeEventListener('keydown', this.keyHandler);
    this.app.unlock();
    this.app.input.endFrame();
    this.resolve?.();
  }

  show(tab) {
    this.tab = tab;
    const st = this.state;
    clear(this.nav).append(
      h('div', { class: 'menu-profile' }, h('b', {}, st.profile.name), h('div', { class: 'small' }, fmtMoney(st.money)), h('div', { class: 'small muted' }, `Día ${st.day} · ${fmtTime(st.playtime)}`)),
      ...TABS.map(([id, label]) => h('button', { class: `nav-btn ${id === tab ? 'active' : ''}`, onclick: () => { audio.play('click'); this.show(id); } }, label)),
      h('button', { class: 'nav-btn close', onclick: () => this.close() }, '✕ Cerrar (ESC)'),
      h('button', { class: 'nav-btn', onclick: async () => { if (await confirmModal('Salir al título', 'Se guardará automáticamente. ¿Salir?')) { this.close(); this.app.toTitle(); } } }, '⏏ Menú principal'));
    clear(this.body);
    const render = {
      team: () => this.teamTab(), players: () => this.playersTab(), techs: () => this.techsTab(), inventory: () => this.inventoryTab(),
      quests: () => this.questsTab(), map: () => this.mapTab(), tournaments: () => this.app.facilities.tournamentsPanel(() => this.show('tournaments'), () => this.close()),
      dex: () => this.dexTab(), save: () => this.saveTab(), settings: () => h('div', {}, h('h2', {}, 'Configuración'), settingsPanel(this.app)),
    }[tab];
    this.body.append(render());
  }

  // ---------------------------------------------------------------- equipo
  teamTab() {
    const st = this.state;
    const formation = getFormation(st.team.formationId);
    const v = validateLineup(st);
    const sel = (opts, key) => h('select', { onchange: (e) => { setStrategy(st, { [key]: e.target.value }); this.show('team'); } },
      Object.entries(opts).map(([k, o]) => h('option', { value: k, selected: st.team.strategy[key] === k, title: o.desc }, o.label)));
    const pitch = h('div', { class: 'pitch' }, h('div', { class: 'pitch-lines' }));
    formation.slots.forEach((slot, i) => {
      const p = getPlayer(st, st.team.lineup[i]);
      const fit = p ? positionFit(template(p).position, slot.role) : 1;
      pitch.append(h('div', {
        class: `slot ${this.selectedSlot === i ? 'selected' : ''} ${fit < 1 ? 'misfit' : ''}`,
        style: { left: `${slot.y * 100}%`, bottom: `${slot.x * 120 + 2}%` },
        onclick: () => {
          audio.play('click');
          if (this.selectedSlot !== null && this.selectedSlot !== i) {
            const other = st.team.lineup[this.selectedSlot];
            if (other) assignSlot(st, i, other);
            this.selectedSlot = null;
          } else this.selectedSlot = this.selectedSlot === i ? null : i;
          this.show('team');
        },
      },
      p ? portrait(p.templateId, { size: 40 }) : h('div', { class: 'empty-slot' }, '+'),
      h('div', { class: 'slot-name' }, p ? `${p.uid === st.team.captain ? '© ' : ''}${template(p).surname}` : 'Vacío'),
      h('div', { class: 'slot-role' }, `${POSITION_SHORT[slot.role]}${p ? ` · ${overall(p)}` : ''}`)));
    });
    const bench = st.team.bench.map((u) => getPlayer(st, u)).filter(Boolean).sort((a, b) => overall(b) - overall(a));
    return h('div', { class: 'team-tab' },
      h('div', { class: 'team-left' },
        h('h2', {}, 'Alineación'),
        h('div', { class: 'row' },
          h('select', { onchange: (e) => { setFormation(st, e.target.value); autoLineup(st, { keepExisting: true }); this.show('team'); } },
            FORMATIONS.map((f) => h('option', { value: f.id, selected: f.id === st.team.formationId }, f.name))),
          h('button', { class: 'btn', onclick: () => { autoLineup(st); toast('Alineación automática aplicada'); this.show('team'); } }, '✨ Auto')),
        h('p', { class: 'small muted' }, formation.desc),
        pitch,
        h('p', { class: 'small muted' }, 'Pulsa un puesto y después otro puesto o un suplente para intercambiarlos. Los jugadores fuera de su posición rinden menos (borde rojo).'),
        v.errors.map((e) => h('p', { class: 'warn' }, e))),
      h('div', { class: 'team-right' },
        h('h3', {}, 'Estrategia'),
        h('div', { class: 'tactics-row' }, h('label', {}, 'Ataque ', sel(OFFENSE_STRATEGIES, 'offense')), h('label', {}, 'Defensa ', sel(DEFENSE_STRATEGIES, 'defense')), h('label', {}, 'Estilo ', sel(PLAY_STYLES, 'style'))),
        h('p', { class: 'small muted' }, `${OFFENSE_STRATEGIES[st.team.strategy.offense].desc} ${DEFENSE_STRATEGIES[st.team.strategy.defense].desc} ${PLAY_STYLES[st.team.strategy.style].desc}`),
        h('h3', {}, 'Capitán'),
        h('div', {}, (() => { const c = getPlayer(st, st.team.captain); return c ? `© ${displayName(c)} (+5% a sus estadísticas)` : 'Sin capitán'; })(),
          this.selectedSlot !== null && st.team.lineup[this.selectedSlot] ? h('button', { class: 'btn small', onclick: () => { setCaptain(st, st.team.lineup[this.selectedSlot]); this.show('team'); } }, 'Nombrar capitán al seleccionado') : null,
          this.selectedSlot !== null && st.team.lineup[this.selectedSlot] ? h('button', { class: 'btn small', onclick: () => { benchPlayer(st, this.selectedSlot); this.selectedSlot = null; this.show('team'); } }, 'Mandar al banquillo') : null),
        h('h3', {}, 'Tácticas guardadas'),
        h('div', { class: 'row' },
          h('input', { class: 'text-input', id: 'preset-name', placeholder: 'Nombre de la táctica', maxlength: 20 }),
          h('button', { class: 'btn', onclick: () => { savePreset(st, document.getElementById('preset-name').value); toast('Táctica guardada'); this.show('team'); } }, 'Guardar')),
        h('div', { class: 'presets' }, st.team.presets.map((p) => h('button', { class: 'btn small', onclick: () => { loadPreset(st, p.name); toast(`Táctica "${p.name}" cargada`); this.show('team'); } }, `📋 ${p.name} (${getFormation(p.formationId).name})`))),
        h('h3', {}, `Suplentes (${bench.length})`),
        h('div', { class: 'bench-list' }, bench.map((p) => playerCard(p, {
          compact: true,
          onclick: () => {
            if (this.selectedSlot === null) { toast('Primero elige un puesto en el campo.'); return; }
            assignSlot(st, this.selectedSlot, p.uid);
            this.selectedSlot = null;
            this.show('team');
          },
        })))));
  }

  // ---------------------------------------------------------------- jugadores
  playersTab() {
    const st = this.state;
    const list = st.roster.slice().sort((a, b) => ['GK', 'DF', 'MF', 'FW'].indexOf(template(a).position) - ['GK', 'DF', 'MF', 'FW'].indexOf(template(b).position) || overall(b) - overall(a));
    const sel = getPlayer(st, this.selectedPlayer) || list[0];
    const actions = [
      h('button', { class: 'btn small', onclick: () => { setCaptain(st, sel.uid); toast('Nuevo capitán'); this.show('players'); } }, '© Capitán'),
      h('button', { class: 'btn small', onclick: () => this.useItemOn(sel) }, '🎒 Usar objeto'),
      ...Object.entries(sel.equipment).filter(([, id]) => id).map(([slot]) => h('button', { class: 'btn small', onclick: () => { const prev = unequipSlot(sel, slot); if (prev) addItem(st, prev); this.show('players'); } }, `Quitar ${slot === 'boots' ? 'botas' : slot === 'gloves' ? 'guantes' : 'accesorio'}`)),
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmModal('Despedir jugador', `¿Seguro que quieres que ${displayName(sel)} deje el club?`))) return;
        const r = releasePlayer(this.game, sel.uid);
        if (!r.ok) toast(r.reason, { type: 'error' }); else { this.selectedPlayer = null; this.show('players'); }
      } }, 'Despedir'),
    ];
    return h('div', { class: 'split' },
      h('div', { class: 'list-col' }, h('h2', {}, `Plantilla (${st.roster.length})`),
        list.map((p) => playerCard(p, { compact: true, selected: p === sel, onclick: () => { this.selectedPlayer = p.uid; this.show('players'); } }))),
      h('div', { class: 'detail-col' }, playerSheet(sel, { actions })));
  }

  async useItemOn(player) {
    const items = listInventory(this.state).filter(({ item }) => ['consumable', 'equipment', 'manual'].includes(item.type));
    if (!items.length) { toast('No tienes objetos utilizables.'); return; }
    const id = await modal({ title: `Usar objeto en ${displayName(player)}`, cls: 'wide',
      body: h('div', { class: 'item-list' }, items.map(({ item, qty }) => h('button', { class: 'btn item', onclick: (e) => { e.target.closest('.modal-overlay').closeModal(item.id); } }, `${item.icon} ${item.name} ×${qty}`, h('small', {}, item.desc)))),
      buttons: [{ text: 'Cancelar', value: null }] });
    if (!id) return;
    const r = useItem(this.game, id, player.uid);
    toast(r.message, { type: r.ok ? 'success' : 'error' });
    this.show(this.tab);
  }

  // ---------------------------------------------------------------- técnicas
  techsTab() {
    const st = this.state;
    const ids = st.team.lineup.filter(Boolean).concat(st.team.bench);
    return h('div', {}, h('h2', {}, 'Técnicas especiales'),
      h('p', { class: 'small muted' }, `Cada jugador puede llevar equipadas hasta ${PROGRESSION.maxTechniques} técnicas. Las técnicas suben de nivel (hasta MAX) al usarlas en partidos y desafíos o en el entrenamiento de técnicas. Las combinadas necesitan que varios compañeros en el campo las conozcan.`),
      h('div', { class: 'tech-grid' }, ids.map((uid) => getPlayer(st, uid)).filter(Boolean).map((p) => h('div', { class: 'tech-player' },
        h('div', { class: 'tp-head' }, portrait(p.templateId, { size: 40 }), h('b', {}, displayName(p)), h('span', { class: 'small muted' }, ` ${equippedCount(p)}/${PROGRESSION.maxTechniques}`)),
        p.techniques.length ? p.techniques.map((pt) => techChip(pt.id, pt.level, { equipped: pt.equipped, onclick: () => {
          if (!toggleEquipTechnique(p, pt.id)) toast(`Máximo ${PROGRESSION.maxTechniques} técnicas equipadas.`, { type: 'error' });
          this.show('techs');
        } })) : h('p', { class: 'muted small' }, 'Sin técnicas'),
        p.insight ? Object.entries(p.insight).map(([tid, v]) => h('div', { class: 'small' }, `💡 Descubriendo ${getTechnique(tid).name}: ${Math.min(100, v)}%`)) : null))));
  }

  // ---------------------------------------------------------------- inventario
  inventoryTab() {
    const inv = listInventory(this.state);
    const groups = { consumable: 'Consumibles', invite: 'Invitaciones', equipment: 'Equipamiento', manual: 'Manuales de técnicas', key: 'Objetos clave' };
    return h('div', {}, h('h2', {}, 'Inventario'),
      Object.entries(groups).map(([type, label]) => {
        const items = inv.filter(({ item }) => item.type === type);
        if (!items.length) return null;
        return h('div', {}, h('h3', {}, label), h('div', { class: 'item-grid' }, items.map(({ item, qty }) => h('div', { class: 'item-card' },
          h('div', { class: 'item-icon' }, item.icon), h('div', {}, h('b', {}, `${item.name} ×${qty}`), h('div', { class: 'small muted' }, item.desc)),
          ['consumable', 'equipment', 'manual'].includes(item.type) ? h('button', { class: 'btn small', onclick: async () => {
            if (item.effect?.team) { const r = useItem(this.game, item.id); toast(r.message); this.show('inventory'); return; }
            const p = await pickPlayerModal(this.state.roster, `Usar ${item.name}`, item.desc);
            if (!p) return;
            const r = useItem(this.game, item.id, p.uid);
            toast(r.message, { type: r.ok ? 'success' : 'error' });
            this.show('inventory');
          } }, 'Usar') : null))));
      }),
      inv.length ? null : h('p', { class: 'muted' }, 'El inventario está vacío.'));
  }

  // ---------------------------------------------------------------- misiones
  questsTab() {
    const st = this.state;
    const ch = currentChapter(st);
    const act = activeQuests(st);
    const block = (q, prog) => h('div', { class: `quest ${q.type}` },
      h('div', { class: 'q-head' }, h('span', { class: 'q-type' }, q.type === 'main' ? 'HISTORIA' : 'SECUNDARIA'), h('b', {}, q.name), h('span', { class: 'small muted' }, ` · ${q.giver}`)),
      h('p', { class: 'small' }, q.desc),
      prog.map((p) => h('div', { class: `q-obj ${p.done ? 'done' : ''}` }, `${p.done ? '✔' : '○'} ${p.obj.text} (${p.value}/${p.target})`)),
      h('div', { class: 'small muted' }, 'Recompensa: ', [q.rewards?.money ? fmtMoney(q.rewards.money) : null, ...Object.entries(q.rewards?.items || {}).map(([id, n]) => `${n}× ${ITEMS.find((i) => i.id === id)?.name}`), q.rewards?.player ? `Jugador: ${getPlayerTemplate(q.rewards.player.id).name}` : null].filter(Boolean).join(' · ')));
    return h('div', {}, h('h2', {}, 'Misiones'),
      h('div', { class: 'chapter-box' }, h('b', {}, ch.title), h('p', {}, ch.goal),
        h('div', { class: 'chapters' }, CHAPTERS.map((c) => h('span', { class: `ch-dot ${c.id < ch.id ? 'done' : c.id === ch.id ? 'cur' : ''}`, title: c.title }, c.id)))),
      act.length ? act.sort((a, b) => (a.quest.type === 'main' ? -1 : 1) - (b.quest.type === 'main' ? -1 : 1)).map(({ quest, progress }) => block(quest, progress)) : h('p', { class: 'muted' }, 'No hay misiones activas. Explora y habla con la gente.'),
      h('h3', {}, `Completadas (${st.quests.completed.length})`),
      h('div', { class: 'small muted' }, st.quests.completed.map((id) => getQuest(id).name).join(' · ') || '—'));
  }

  // ---------------------------------------------------------------- mapa
  mapTab() {
    const st = this.state;
    const visited = new Set(visitedMaps(st).map((m) => m.id));
    const scene = this.app.scene;
    return h('div', {}, h('h2', {}, 'Mapa del mundo'),
      h('p', { class: 'small muted' }, 'Viaje rápido a las zonas que ya has visitado. Las zonas nuevas se desbloquean avanzando en la historia.'),
      h('div', { class: 'world-map' }, MAPS.map((m, i) => {
        const here = st.location.map === m.id;
        const leads = st.scout.leads.filter((l) => l.map === m.id);
        return h('div', { class: `zone ${visited.has(m.id) ? 'visited' : 'locked'} ${here ? 'here' : ''}`, style: { '--i': i } },
          h('div', { class: 'zone-name' }, visited.has(m.id) ? m.name : '???'),
          visited.has(m.id) ? h('div', { class: 'small' }, (m.npcs || []).filter((n) => n.invisible && !n.sign).map((n) => n.name).join(' · ')) : h('div', { class: 'small muted' }, 'Zona no descubierta'),
          leads.length ? h('div', { class: 'small lead' }, `★ Pistas: ${leads.map((l) => getPlayerTemplate(l.templateId).name).join(', ')}`) : null,
          here ? h('div', { class: 'badge' }, 'Estás aquí') : visited.has(m.id) && scene instanceof WorldScene ? h('button', { class: 'btn small', onclick: () => { this.close(); scene.doWarp(m.id, m.spawn.x, m.spawn.y); } }, 'Viajar') : null);
      })));
  }

  // ---------------------------------------------------------------- libreta
  dexTab() {
    const st = this.state;
    const seen = new Set(st.encyclopedia.seen);
    const rec = new Set(st.encyclopedia.recruited);
    const all = PLAYERS;
    const where = (id) => MAPS.filter((m) => (m.encounters?.pool || []).some((e) => e.id === id) || (m.scoutPool || []).some((e) => e.id === id) || m.npcs.some((n) => n.templateId === id)).map((m) => m.name);
    return h('div', {}, h('h2', {}, 'Libreta de ojeador'),
      h('p', {}, `Vistos: ${all.filter((p) => seen.has(p.id)).length}/${all.length} · Reclutados: ${all.filter((p) => rec.has(p.id)).length}/${all.length}`),
      h('div', { class: 'dex-grid' }, all.map((p, i) => {
        const s = seen.has(p.id);
        return h('div', { class: `dex-entry ${s ? '' : 'unknown'} ${rec.has(p.id) ? 'owned' : ''}`, style: { borderColor: s ? RARITY[p.rarity].color : '#333' }, onclick: () => {
          if (!s) return;
          modal({ title: `${p.name} ${p.surname}`, body: h('div', { class: 'dex-detail' }, portrait(p.id, { size: 120 }),
            h('div', {}, h('div', { class: 'pc-badges' }, posBadge(p.position), elementBadge(p.element), rarityBadge(p.rarity)), h('p', {}, p.bio),
              h('p', { class: 'small' }, 'Técnicas: ', p.learnset.map((l) => getTechnique(l.tech).name).join(', ')),
              h('p', { class: 'small muted' }, 'Dónde encontrarlo: ', where(p.id).join(', ') || (p.team !== 'free' ? 'Equipo rival (ojeo tras ganarles)' : 'Desconocido')))) });
        } }, h('span', { class: 'dex-num' }, `#${String(i + 1).padStart(3, '0')}`),
        s ? portrait(p.id, { size: 64 }) : h('div', { class: 'silhouette' }, '?'),
        h('div', { class: 'small' }, s ? p.surname : '???'),
        rec.has(p.id) ? h('span', { class: 'dex-owned' }, '✔') : null);
      })));
  }

  // ---------------------------------------------------------------- guardar
  saveTab() {
    const app = this.app;
    const labels = { auto: 'Autoguardado', slot1: 'Ranura 1', slot2: 'Ranura 2', slot3: 'Ranura 3' };
    return h('div', {}, h('h2', {}, 'Guardar y cargar'),
      h('p', { class: 'small muted' }, 'El juego se guarda automáticamente al cambiar de zona, tras cada partido y cada 3 minutos. Cada ranura conserva una copia de seguridad que se recupera si el archivo se daña.'),
      h('div', { class: 'slot-list' }, SLOTS.map((slot) => {
        const meta = app.saves.meta(slot);
        return h('div', { class: 'slot' }, h('div', {}, h('b', {}, labels[slot]), h('div', { class: 'small muted' }, slotInfo(meta))),
          h('div', { class: 'slot-actions' },
            slot !== 'auto' ? h('button', { class: 'btn primary', onclick: async () => { if (!meta || await confirmModal('Sobrescribir', '¿Sobrescribir esta ranura?')) { app.saveSlot(slot); this.show('save'); } } }, 'Guardar') : null,
            h('button', { class: 'btn', disabled: !meta, onclick: async () => { if (await confirmModal('Cargar', 'Se perderá el progreso no guardado. ¿Cargar?')) { this.close(); app.loadSlot(slot); } } }, 'Cargar'),
            h('button', { class: 'btn', disabled: !meta, onclick: () => {
              const blob = new Blob([app.saves.exportSlot(slot)], { type: 'application/json' });
              const a = h('a', { href: URL.createObjectURL(blob), download: `ultimate-legends-${slot}.json` });
              document.body.appendChild(a); a.click(); a.remove();
            } }, 'Exportar'),
            slot !== 'auto' ? h('button', { class: 'btn danger', disabled: !meta, onclick: async () => { if (await confirmModal('Borrar', '¿Borrar esta ranura?')) { app.saves.remove(slot); this.show('save'); } } }, 'Borrar') : null));
      })));
  }
}
