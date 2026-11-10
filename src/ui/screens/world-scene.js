// Escena de exploración: mueve al entrenador por el mapa, gestiona NPC,
// diálogos y guiones (actúa como "host" del intérprete de guiones).

import { h, fmtMoney } from '../dom.js';
import { World, getMap } from '../../world/world.js';
import { WorldRenderer } from '../../render/world-renderer.js';
import { runScript } from '../../systems/script.js';
import { setFlag } from '../../systems/game-state.js';
import { giveItem } from '../../systems/inventory.js';
import { restTeam } from '../../systems/training.js';
import { currentChapter } from '../../systems/story.js';
import { removeLead } from '../../systems/recruitment.js';
import { getItem, hasPlayerTemplate } from '../../systems/database.js';
import { AVATAR_PRESETS } from '../../data/coaches.js';
import { LOOKS } from '../../data/maps.js';
import { audio } from '../../audio/audio.js';
import { DialogueBox, portrait, lookPortrait, toast, titleCard, screenFx } from '../components.js';
import { EVT } from '../../core/events.js';

export class WorldScene {
  constructor(app) {
    this.app = app;
    this.world = new World(app.game);
    this.renderer = new WorldRenderer(app.canvas);
    this.busy = false;
    this.stepSound = 0;
  }

  get state() { return this.app.game.state; }

  enter() {
    this.hud = h('div', { class: 'world-hud' });
    this.dialogue = new DialogueBox(this.app.uiLayer);
    this.dialogue.speed = this.state.settings.textSpeed;
    this.app.uiLayer.append(this.hud);
    this.playMapMusic();
    this.refreshHud();
    this.offHud = this.app.game.bus.on('*', () => this.refreshHud());
  }

  exit() {
    this.hud?.remove();
    this.dialogue?.el.remove();
    this.offHud?.();
  }

  playMapMusic() { audio.playMusic(this.world.map.music || 'town'); }

  refreshHud() {
    if (!this.hud) return;
    const st = this.state;
    const ch = currentChapter(st);
    this.hud.replaceChildren(
      h('div', { class: 'hud-loc' }, h('b', {}, this.world.map.name), h('span', {}, ` · Día ${st.day}`)),
      h('div', { class: 'hud-money' }, fmtMoney(st.money)),
      h('div', { class: 'hud-goal' }, h('small', {}, ch.title), h('div', {}, ch.goal)),
      h('div', { class: 'hud-keys' }, '[ESPACIO] Hablar · [ESC] Menú · [Shift] Correr'),
      h('button', { class: 'hud-menu-btn', onclick: () => this.app.openMenu() }, '☰ Menú'));
  }

  // ---------------------------------------------------------------- bucle

  update(dt) {
    const input = this.app.input;
    if (this.busy || this.app.locked) {
      if (this.dialogue.open && (input.consume('confirm') || input.consume('cancel'))) this.dialogue.advance();
      return;
    }
    if (input.consume('menu')) { this.app.openMenu(); return; }
    if (input.consume('confirm')) { this.interact(); return; }
    const ev = this.world.update(dt, { dir: input.dir(), run: input.held.has('sprint') });
    if (this.world.player.moving) {
      this.stepSound -= dt;
      if (this.stepSound <= 0) { audio.play('step'); this.stepSound = 0.3; }
    }
    if (ev) this.handleWorldEvent(ev);
  }

  draw(dt) {
    const look = { ...AVATAR_PRESETS[this.state.profile.avatar], eyes: '#333' };
    this.renderer.draw(this.world, look, dt);
    if (this.state.settings.showFps) {
      const ctx = this.app.canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`${Math.round(this.app.fps)} FPS`, 10, this.app.canvas.height - 10);
    }
  }

  async handleWorldEvent(ev) {
    switch (ev.type) {
      case 'warp': await this.doWarp(ev.warp.to, ev.warp.tx, ev.warp.ty); break;
      case 'locked': await this.runScript([{ say: ev.text, who: '' }]); break;
      case 'item': {
        this.world.pickItem(ev.item);
        giveItem(this.app.game, ev.item.item, ev.item.qty || 1);
        break;
      }
      case 'encounter': {
        this.busy = true;
        audio.play('encounter');
        await screenFx(this.app.uiLayer, 'lightning');
        await this.app.startEncounter({ templateId: ev.templateId, level: ev.level, kind: 'wild' });
        this.busy = false;
        break;
      }
      case 'sight': {
        setFlag(this.app.game, `seen_${ev.npc.id}`);
        audio.play('encounter');
        toast('¡!', { duration: 800 });
        await this.runNpc(ev.npc);
        break;
      }
      default: break;
    }
  }

  async doWarp(map, x, y) {
    this.busy = true;
    await screenFx(this.app.uiLayer, 'fade');
    this.world.load(map, x, y, this.world.player.dir);
    this.playMapMusic();
    this.refreshHud();
    this.app.autosave(true);
    this.busy = false;
    toast(this.world.map.name, { icon: '📍', duration: 1800 });
  }

  async interact() {
    const npc = this.world.interact();
    if (npc) { audio.play('click'); await this.runNpc(npc); }
  }

  async runNpc(npc) {
    const ctx = { npcName: npc.name, portrait: npc.templateId || npc.look || null, npc };
    this.app.game.bus.emit(EVT.TALKED, { npc: npc.id });
    await this.runScript(npc.script, ctx);
  }

  async runScript(script, ctx = {}) {
    this.busy = true;
    try {
      await runScript(this.app.game, script, this.host(), ctx);
    } catch (err) {
      this.app.reportError(err);
    } finally {
      this.busy = false;
      this.refreshHud();
    }
  }

  portraitEl(p) {
    if (!p) return null;
    if (typeof p === 'string') {
      if (hasPlayerTemplate(p)) return portrait(p, { size: 120 });
      if (LOOKS[p]) return lookPortrait(p, LOOKS[p], { size: 120 });
      return null;
    }
    return lookPortrait(JSON.stringify(p), p, { size: 120 });
  }

  /** Implementación de las operaciones de presentación para los guiones. */
  host() {
    const app = this.app;
    return {
      say: (who, text, p) => this.dialogue.say(who, text.replace('{name}', this.state.profile.name), this.portraitEl(p)),
      choice: (q, options, who) => this.dialogue.choice(q, options, who),
      notify: (text) => toast(text, { icon: '✦' }),
      itemName: (id) => getItem(id).name,
      match: (m) => app.playMatch({ team: m.team, level: m.level, context: m.context || 'story' }),
      challenge: (c) => app.startEncounter({ templateId: c.player, level: c.level, kind: 'challenge' }),
      fx: (kind) => screenFx(app.uiLayer, kind),
      title: (t, s) => titleCard(app.uiLayer, t, s),
      warp: (map, x, y) => this.doWarp(map, x, y),
      shop: (id) => app.facilities.shop(id),
      heal: () => { restTeam(app.game); audio.play('levelup'); toast('El equipo ha descansado (fatiga a 0).', { icon: '💤' }); },
      save: () => app.facilities.saveDialog(),
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      sfx: (n) => audio.play(n),
      music: (m) => audio.playMusic(m),
      npcMove: async (id, path) => { this.world.moveNpc(id, path); await new Promise((r) => setTimeout(r, 300)); },
      open: async (screen, cmd) => {
        if (screen === 'team') return app.openMenu('team');
        if (screen === 'training') return app.facilities.training();
        if (screen === 'scout') return app.facilities.scout();
        if (screen === 'tournaments') return app.facilities.tournaments();
        if (screen === 'leadChallenge') {
          const status = await app.startEncounter({ templateId: cmd.templateId, level: cmd.level, kind: 'lead' });
          if (status === 'recruited') removeLead(this.state, cmd.templateId);
          return null;
        }
        return app.openMenu(screen);
      },
    };
  }

  suspend() {}
  resume() { this.playMapMusic(); this.refreshHud(); }
}

export { getMap };
