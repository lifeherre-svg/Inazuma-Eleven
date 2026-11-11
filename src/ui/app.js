// Orquestador de la aplicación: escenas, bucle principal, guardado
// automático, notificaciones globales y flujo partido/desafío/historia.

import { GAME } from '../config.js';
import { Input, mountTouchControls } from '../core/input.js';
import { EVT } from '../core/events.js';
import { audio } from '../audio/audio.js';
import { SaveManager } from '../systems/save.js';
import { createGameContext, createNewState } from '../systems/game-state.js';
import { attachQuestSystem, getQuest } from '../systems/quests.js';
import { attachStorySystem, syncChapter } from '../systems/story.js';
import { getTechnique, getPlayerTemplate, getItem } from '../systems/database.js';
import { h } from './dom.js';
import { toast, titleCard } from './components.js';
import { TitleScene } from './screens/title.js';
import { NewGameScene } from './screens/newgame.js';
import { WorldScene } from './screens/world-scene.js';
import { MatchFlow } from './screens/match-scene.js';
import { EncounterScene } from './screens/encounter-scene.js';
import { Menu } from './screens/menu.js';
import { Facilities } from './screens/facilities.js';

export class App {
  constructor(root) {
    this.root = root;
    this.canvas = h('canvas', { id: 'game-canvas' });
    this.uiLayer = h('div', { id: 'ui-layer' });
    root.append(this.canvas, this.uiLayer);
    this.input = new Input();
    this.saves = new SaveManager();
    this.game = null;
    this.scene = null;
    this.locks = 0;              // >0 cuando un panel DOM bloquea el control del mundo
    this.last = performance.now();
    this.autosaveTimer = 0;
    this.fps = 0;
    this.detach = [];
    this.menu = new Menu(this);
    this.facilities = new Facilities(this);
    this.matchFlow = new MatchFlow(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    if (matchMedia('(pointer: coarse)').matches) mountTouchControls(root, this.input);
    window.addEventListener('error', (e) => this.reportError(e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => this.reportError(e.reason));
    window.addEventListener('beforeunload', () => this.autosave(true));
  }

  reportError(err) {
    console.error(err);
    toast(`Error inesperado: ${err?.message || err}. Tu progreso se ha autoguardado.`, { type: 'error', duration: 6000 });
    try { this.autosave(true); } catch { /* nada */ }
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }

  lock() { this.locks++; }
  unlock() { this.locks = Math.max(0, this.locks - 1); }
  get locked() { return this.locks > 0; }

  setScene(scene) {
    this.scene?.exit?.();
    this.scene = scene;
    // Los controles táctiles solo se muestran en las escenas que los usan (mundo y partido).
    document.body.dataset.touch = scene.touch ? 'on' : 'off';
    scene.enter?.();
  }

  start() {
    this.setScene(new TitleScene(this));
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
      try {
        this.scene?.update?.(dt);
        this.scene?.draw?.(dt);
        if (this.game) {
          this.game.state.playtime += dt;
          this.autosaveTimer += dt;
          if (this.autosaveTimer > 180 && this.scene instanceof WorldScene && !this.locked) this.autosave();
        }
      } catch (err) {
        this.reportError(err);
      }
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- partida

  attachGame(state) {
    for (const off of this.detach) off();
    this.detach = [];
    this.game = createGameContext(state);
    const bus = this.game.bus;
    audio.setVolumes(state.settings.musicVolume, state.settings.sfxVolume);
    syncChapter(this.game);
    this.detach.push(attachQuestSystem(this.game));
    this.detach.push(attachStorySystem(this.game, (ch) => toast(`Nuevo capítulo: ${ch.title}`, { icon: '📖', type: 'story', duration: 4500 })));
    this.detach.push(bus.on(EVT.QUEST_COMPLETED, ({ name }) => { audio.play('levelup'); toast(`Misión completada: ${name}`, { icon: '✅', type: 'success' }); }));
    this.detach.push(bus.on(EVT.QUEST_STARTED, ({ id }) => toast(`Nueva misión: ${getQuest(id).name}`, { icon: '📜' })));
    this.detach.push(bus.on(EVT.RECRUITED, ({ templateId }) => { audio.play('recruit'); const t = getPlayerTemplate(templateId); toast(`¡${t.name} ${t.surname} se une al equipo!`, { icon: '🤝', type: 'success' }); }));
    this.detach.push(bus.on(EVT.TECH_LEARNED, ({ techId }) => toast(`Nueva técnica: ${getTechnique(techId).name}`, { icon: '✨', type: 'success' })));
    this.detach.push(bus.on(EVT.TOURNAMENT_WON, () => audio.play('recruit')));
    this.detach.push(bus.on(EVT.ITEM_GAINED, ({ id, qty }) => { audio.play('item'); toast(`${qty}× ${getItem(id).name}`, { icon: getItem(id).icon }); }));
  }

  async newGame(opts) {
    const state = createNewState(opts);
    try { Object.assign(state.settings, JSON.parse(localStorage.getItem('ul_settings') || '{}')); } catch { /* ajustes por defecto */ }
    this.attachGame(state);
    this.saves.save('auto', state);
    const world = new WorldScene(this);
    this.setScene(world);
    await titleCard(this.uiLayer, GAME.title, 'Un nuevo entrenador llega a Villa Rayo');
    await world.runScript([
      { say: `¡${state.profile.name}! Hoy es tu primer día como entrenador del Instituto Rayo Azul.`, who: 'Mamá', portrait: { hair: 'long', hairColor: '#5a3825', skin: '#f5d0b0', shirt: '#e76f51' } },
      { say: 'Dicen que el club de fútbol lleva años abandonado... pero el Abuelo Tetsuo te espera en la puerta del instituto, al norte de casa.', who: 'Mamá', portrait: { hair: 'long', hairColor: '#5a3825', skin: '#f5d0b0', shirt: '#e76f51' } },
      { say: 'Usa las flechas o WASD para moverte, ESPACIO/ENTER para hablar y ESC para abrir el menú.', who: 'Consejo' },
    ]);
  }

  loadSlot(slot) {
    const r = this.saves.load(slot);
    if (!r.ok) { toast(r.error, { type: 'error' }); return false; }
    if (r.warning) toast(r.warning, { type: 'warn', duration: 6000 });
    this.attachGame(r.state);
    this.setScene(new WorldScene(this));
    toast('Partida cargada', { icon: '💾' });
    return true;
  }

  saveSlot(slot) {
    if (!this.game) return false;
    const r = this.saves.save(slot, this.game.state);
    if (r.ok) { audio.play('save_ok'); toast(slot === 'auto' ? 'Autoguardado' : 'Partida guardada', { icon: '💾' }); }
    else toast(r.error, { type: 'error' });
    return r.ok;
  }

  autosave(silent = false) {
    if (!this.game) return;
    this.autosaveTimer = 0;
    const r = this.saves.save('auto', this.game.state);
    if (!silent && r.ok) toast('Autoguardado', { icon: '💾', duration: 1500 });
  }

  toTitle() {
    this.autosave(true);
    for (const off of this.detach) off();
    this.detach = [];
    this.game = null;
    this.setScene(new TitleScene(this));
  }

  // ---------------------------------------------------------------- flujos

  /** Partido completo (previa, partido, resultados, ojeo). Devuelve {won, result}. */
  playMatch(opts) {
    return this.matchFlow.run(opts);
  }

  /** Desafío por turnos. Devuelve el estado final. */
  startEncounter({ templateId, level, kind }) {
    return new Promise((resolve) => {
      const back = this.scene;
      const scene = new EncounterScene(this, { templateId, level, kind, onEnd: (status) => {
        this.setScene(back);
        back.resume?.();
        this.autosave(true);
        resolve(status);
      } });
      back.suspend?.();
      this.setScene(scene);
    });
  }

  openMenu(tab) { return this.menu.open(tab); }
}
