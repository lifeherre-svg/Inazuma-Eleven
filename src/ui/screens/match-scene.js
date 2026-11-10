// Flujo completo de partido: previa → partido jugable → descanso →
// resultados (experiencia, dinero) → ojeo de jugadores rivales.

import { h, clear, fmtMoney } from '../dom.js';
import { MatchEngine, simulateMatch } from '../../match/match-engine.js';
import { buildPlayerTeamSpec, buildOpponentSpec } from '../../match/match-setup.js';
import { MatchRenderer } from '../../render/match-renderer.js';
import { applyMatchResult } from '../../systems/match-rewards.js';
import { postMatchCandidates, attemptConvince, convinceChance } from '../../systems/recruitment.js';
import { validateLineup } from '../../systems/team.js';
import { getTeam, getTechnique, getPlayerTemplate } from '../../systems/database.js';
import { itemCount } from '../../systems/inventory.js';
import { PLAYER_TEAM } from '../../data/teams.js';
import { ELEMENTS } from '../../data/elements.js';
import { APPROACHES, PERSONALITIES } from '../../data/personalities.js';
import { OFFENSE_STRATEGIES, DEFENSE_STRATEGIES, PLAY_STYLES } from '../../data/formations.js';
import { ITEMS } from '../../data/items.js';
import { RARITY } from '../../config.js';
import { audio } from '../../audio/audio.js';
import { portrait, modal, toast, elementBadge, rarityBadge, posBadge, closeTopModal } from '../components.js';
import { teamAverageLevel } from '../../systems/game-state.js';

export class MatchFlow {
  constructor(app) { this.app = app; }

  /** opts: { team, level?, context: 'story'|'friendly'|'tournament', tournamentName? } */
  async run(opts) {
    const app = this.app;
    const state = app.game.state;
    const lineupCheck = validateLineup(state);
    if (!lineupCheck.ok) {
      await modal({ title: 'No puedes jugar todavía', body: h('p', {}, lineupCheck.errors.join(' ')) });
      return { won: false, result: null, aborted: true };
    }
    const team = getTeam(opts.team);
    const level = opts.level ?? team.level;
    const choice = await this.preMatch(team, level, opts);
    if (choice === 'cancel') return { won: false, result: null, aborted: true };
    const participants = state.team.lineup.filter(Boolean);
    let result;
    if (choice === 'sim') {
      result = simulateMatch({ home: buildPlayerTeamSpec(state), away: buildOpponentSpec(team.id, { levelOverride: level }), seed: Date.now() % 1e9, halfDurationSec: 90, difficulty: state.settings.difficulty });
    } else {
      result = await this.playLive(team, level);
    }
    const report = applyMatchResult(app.game, { opponentId: team.id, opponentLevel: level, result, context: opts.context, participants });
    await this.results(team, result, report, opts);
    if (result.winner === 0) await this.scouting(team, result);
    app.autosave(true);
    return { won: result.winner === 0, result };
  }

  preMatch(team, level, opts) {
    const state = this.app.game.state;
    const myLvl = teamAverageLevel(state);
    const diff = level - myLvl;
    const risk = diff > 6 ? { t: 'Muy difícil', c: '#ff4d6d' } : diff > 2 ? { t: 'Difícil', c: '#ff9f43' } : diff > -3 ? { t: 'Igualado', c: '#f2c94c' } : { t: 'Asequible', c: '#4cc96b' };
    const spec = buildOpponentSpec(team.id, { levelOverride: level });
    const body = h('div', { class: 'prematch' },
      h('div', { class: 'pm-teams' },
        h('div', { class: 'pm-team', style: { borderColor: PLAYER_TEAM.colors.primary } }, h('h3', {}, PLAYER_TEAM.name), h('div', {}, `Nivel medio ${myLvl}`)),
        h('div', { class: 'pm-vs' }, 'VS'),
        h('div', { class: 'pm-team', style: { borderColor: team.colors.primary } }, h('h3', {}, team.name), h('div', {}, `Nivel ${level} · `, elementBadge(team.element)), h('div', { class: 'small muted' }, team.desc))),
      opts.tournamentName ? h('p', { class: 'pm-tour' }, `🏆 ${opts.tournamentName}`) : null,
      h('p', {}, 'Dificultad estimada: ', h('b', { style: { color: risk.c } }, risk.t)),
      h('div', { class: 'pm-stars' }, h('b', {}, 'Jugadores a vigilar: '), spec.starters.filter((p) => team.stars.includes(p.templateId)).map((p) => h('span', { class: 'pm-star' }, portrait(p.templateId, { size: 36, jersey: team.colors.primary, jersey2: team.colors.secondary }), p.name))),
      h('p', { class: 'small muted' }, 'Controles: mover WASD/flechas · Shift sprint · J pase/cambiar · K tiro/entrada · I técnica de tiro · U técnica de regate o defensa · P pausa.'));
    return modal({
      title: 'Previa del partido', body, cls: 'wide', dismissable: false,
      buttons: [
        { text: 'Cancelar', value: 'cancel' },
        { text: 'Gestionar equipo', value: 'team' },
        { text: '⏩ Simular', value: 'sim' },
        { text: '⚽ ¡Jugar!', value: 'play', cls: 'primary' },
      ],
    }).then(async (v) => {
      if (v === 'team') { await this.app.openMenu('team'); return this.preMatch(team, level, opts); }
      return v || 'cancel';
    });
  }

  playLive(team, level) {
    return new Promise((resolve) => {
      const app = this.app;
      const back = app.scene;
      const scene = new MatchScene(app, team, level, (result) => {
        app.setScene(back);
        back.resume?.();
        resolve(result);
      });
      back.suspend?.();
      app.setScene(scene);
    });
  }

  async results(team, result, report, opts) {
    const won = result.winner === 0, draw = result.winner === null;
    audio.playMusic(won ? 'victory' : 'town');
    const goalsList = (t) => result.goals.filter((g) => g.team === t).map((g) => h('div', { class: 'small' }, `⚽ ${g.minute}' ${g.scorer}${g.tech ? ` (${g.tech})` : ''}`));
    const st = this.app.game.state;
    const mvpName = (() => {
      const p = st.roster.find((x) => x.uid === result.mvp);
      if (p) { const t = getPlayerTemplate(p.templateId); return `${t.name} ${t.surname}`; }
      return result.mvp ? 'Jugador rival' : '—';
    })();
    const body = h('div', { class: 'results' },
      h('div', { class: `res-banner ${won ? 'win' : draw ? 'draw' : 'loss'}` }, won ? '¡VICTORIA!' : draw ? 'EMPATE' : 'DERROTA'),
      h('div', { class: 'res-score' },
        h('div', {}, h('b', {}, PLAYER_TEAM.name), goalsList(0)),
        h('div', { class: 'res-num' }, `${result.score[0]} - ${result.score[1]}`),
        h('div', {}, h('b', {}, team.name), goalsList(1))),
      h('table', { class: 'res-stats' },
        row('Posesión', `${result.possession[0]}%`, `${result.possession[1]}%`),
        row('Tiros', result.shots[0], result.shots[1]),
        row('A puerta', result.onTarget[0], result.onTarget[1]),
        row('Técnicas usadas', result.techUses.filter((u) => u.team === 0).reduce((s, u) => s + u.count, 0), result.techUses.filter((u) => u.team === 1).reduce((s, u) => s + u.count, 0))),
      h('p', {}, `⭐ MVP: ${mvpName}`),
      h('div', { class: 'res-rewards' },
        h('div', {}, `+${report.xp} XP base para los titulares · ${fmtMoney(report.money)}`),
        report.levelUps.map((l) => h('div', { class: 'lvlup' }, `⬆ ${l.name}: Nv.${l.from} → Nv.${l.to}${l.learned.length ? ` · aprende ${l.learned.map((t) => getTechnique(t).name).join(', ')}` : ''}`)),
        report.techUps.map((t) => h('div', { class: 'lvlup' }, `✨ ${getTechnique(t.techId).name} sube de nivel`))));
    await modal({ title: opts.tournamentName ? `Resultado · ${opts.tournamentName}` : 'Resultado final', body, cls: 'wide', buttons: [{ text: 'Continuar', value: true, cls: 'primary' }] });
  }

  /** Tras ganar: intentar convencer a jugadores del equipo rival. */
  async scouting(team, result) {
    const game = this.app.game;
    const cands = postMatchCandidates(game, team.id, result);
    if (!cands.length) return;
    const invites = ITEMS.filter((i) => i.type === 'invite' && itemCount(game.state, i.id) > 0);
    const pick = await modal({
      title: '🔭 Ojeo tras el partido',
      body: h('div', {}, h('p', {}, `Algunos jugadores de ${team.name} han quedado impresionados. ¿Quieres intentar ficharlos?`),
        invites.length ? null : h('p', { class: 'warn' }, 'No tienes cartas de invitación.'),
        h('div', { class: 'card-grid' }, cands.map((c) => {
          const t = getPlayerTemplate(c.templateId);
          return h('div', { class: 'player-card', style: { borderColor: RARITY[t.rarity].color } }, portrait(t.id, { size: 56, jersey: team.colors.primary, jersey2: team.colors.secondary }),
            h('div', { class: 'pc-info' }, h('div', { class: 'pc-name' }, `${t.name} ${t.surname}`), h('div', { class: 'pc-badges' }, posBadge(t.position), elementBadge(t.element), rarityBadge(t.rarity)), h('div', { class: 'pc-sub' }, `Nv.${c.level}`)),
            h('button', { class: 'btn primary', disabled: !invites.length, onclick: () => closeTopModal(c) }, 'Intentar'));
        }))),
      buttons: [{ text: 'No, gracias', value: null }],
    });
    if (pick) await this.convince(pick);
  }

  async convince(c) {
    const game = this.app.game;
    const t = getPlayerTemplate(c.templateId);
    const invites = ITEMS.filter((i) => i.type === 'invite' && itemCount(game.state, i.id) > 0);
    let approach = 'inspirar', invite = invites[0].id;
    const chanceEl = h('div', { class: 'chance' });
    const upd = () => { chanceEl.textContent = `Probabilidad: ${Math.round(convinceChance({ templateId: c.templateId, level: c.level, morale: 30, approach, inviteId: invite, state: game.state }) * 100)}%`; };
    const body = h('div', {},
      h('p', {}, `${t.name} es de carácter `, h('b', {}, PERSONALITIES[t.personality].label.toLowerCase()), '. ¿Qué le dices?'),
      h('div', { class: 'approach-list' }, Object.entries(APPROACHES).map(([id, a]) => h('label', { class: 'approach' },
        h('input', { type: 'radio', name: 'ap2', checked: id === approach, onchange: () => { approach = id; upd(); } }), h('b', {}, a.label), h('span', { class: 'small muted' }, ` — ${a.desc}`)))),
      h('select', { onchange: (e) => { invite = e.target.value; upd(); } }, invites.map((i) => h('option', { value: i.id }, `${i.icon} ${i.name} (x${itemCount(game.state, i.id)})`))),
      chanceEl);
    upd();
    const ok = await modal({ title: `Fichar a ${t.name} ${t.surname}`, body, buttons: [{ text: 'Cancelar', value: false }, { text: 'Enviar invitación', value: true, cls: 'primary' }] });
    if (!ok) return;
    const r = attemptConvince(game, { templateId: c.templateId, level: c.level, morale: 30, approach, inviteId: invite, source: 'ojeo' });
    if (!r.ok) toast(r.message, { type: 'error' });
    else if (!r.success) { audio.play('error'); toast(r.message, { type: 'warn' }); }
  }
}

function row(label, a, b) { return h('tr', {}, h('td', {}, a), h('th', {}, label), h('td', {}, b)); }

// ====================================================================== escena

export class MatchScene {
  constructor(app, team, level, onEnd) {
    this.app = app;
    this.team = team;
    this.onEnd = onEnd;
    const state = app.game.state;
    this.engine = new MatchEngine({
      home: buildPlayerTeamSpec(state),
      away: buildOpponentSpec(team.id, { levelOverride: level }),
      userTeam: 0,
      seed: Date.now() % 1e9,
      settings: state.settings,
    });
    this.renderer = new MatchRenderer(app.canvas, this.engine);
    this.paused = false;
    this.ticker = [];
    this.ended = false;
  }

  enter() {
    audio.playMusic('match');
    audio.play('whistle');
    this.hud = h('div', { class: 'match-hud' });
    this.app.uiLayer.appendChild(this.hud);
    this.app.lock();
    this.buildHud();
  }

  exit() { this.hud?.remove(); this.app.unlock(); }

  buildHud() {
    const e = this.engine;
    const [a, b] = e.teams;
    this.scoreEl = h('div', { class: 'scoreboard' },
      h('span', { class: 'sb-team', style: { background: a.spec.colors.primary } }, a.spec.short),
      h('span', { class: 'sb-score' }, '0 - 0'),
      h('span', { class: 'sb-team', style: { background: b.spec.colors.primary } }, b.spec.short),
      h('span', { class: 'sb-clock' }, "0'"));
    this.playerEl = h('div', { class: 'ctrl-panel' });
    this.tickerEl = h('div', { class: 'ticker' });
    this.duelEl = h('div', { class: 'duel-prompt hidden' });
    this.hud.append(this.scoreEl, this.playerEl, this.tickerEl, this.duelEl,
      h('button', { class: 'hud-menu-btn', onclick: () => this.pause() }, '⏸ Pausa'));
  }

  updateHud() {
    const e = this.engine;
    this.scoreEl.querySelector('.sb-score').textContent = `${e.teams[0].score} - ${e.teams[1].score}`;
    this.scoreEl.querySelector('.sb-clock').textContent = `${e.clockMinutes()}' ${e.half === 1 ? '1ª' : '2ª'}`;
    const c = e.controlled;
    if (c && c.id !== this.lastCtrl || (this.hudTick = (this.hudTick || 0) + 1) % 10 === 0) {
      this.lastCtrl = c?.id;
      if (!c) return;
      const hasBall = e.ball.owner === c;
      const techs = c.techniques.map((t) => {
        const def = getTechnique(t.id);
        const key = { shoot: 'I', combo: 'I', dribble: 'U', defense: 'U', block: '—', keeper: '—' }[def.category];
        return h('div', { class: `ht ${c.tp >= def.tp ? '' : 'off'}`, style: { borderColor: ELEMENTS[def.element].color } }, h('kbd', {}, key), ` ${def.name} `, h('small', {}, `${def.tp}PT`));
      });
      clear(this.playerEl).append(
        portrait(c.templateId, { size: 54 }),
        h('div', { class: 'cp-info' },
          h('b', {}, `${c.idx + 1}. ${c.name}`),
          h('div', { class: 'cp-bar' }, h('span', {}, 'PT'), h('div', { class: 'track' }, h('div', { class: 'fill tp', style: { width: `${(c.tp / c.maxTp) * 100}%` } })), h('span', {}, Math.floor(c.tp))),
          h('div', { class: 'cp-bar' }, h('span', {}, 'RES'), h('div', { class: 'track' }, h('div', { class: 'fill st', style: { width: `${c.stamina}%` } }))),
          h('div', { class: 'cp-keys' }, hasBall ? '[J] Pase  [K] Tiro  [I] Técnica  [U] Regate esp.' : '[J] Cambiar  [K] Entrada  [U] Técnica defensiva'),
          h('div', { class: 'cp-techs' }, techs)));
    }
  }

  pushTicker(text) {
    this.ticker.unshift(text);
    this.ticker.length = Math.min(this.ticker.length, 4);
    clear(this.tickerEl).append(...this.ticker.map((t, i) => h('div', { style: { opacity: 1 - i * 0.22 } }, t)));
  }

  handleEvents() {
    const shake = this.app.game.state.settings.screenShake;
    for (const ev of this.engine.drainEvents()) {
      this.renderer.onEvent(ev, shake);
      switch (ev.type) {
        case 'goal': audio.play('goal'); this.pushTicker(`⚽ ${ev.minute}' ¡GOL de ${ev.scorer}!${ev.tech ? ` (${ev.tech})` : ''}`); break;
        case 'tech': audio.play('tech'); this.pushTicker(`⚡ ${ev.player}: ${ev.tech.name}`); break;
        case 'shot': if (!ev.tech) audio.play('shot'); break;
        case 'pass': audio.play('kick'); break;
        case 'save': audio.play('save'); this.pushTicker(`🧤 Parada de ${ev.player}`); break;
        case 'tackle': audio.play('tackle'); break;
        case 'whistle': audio.play('whistle'); break;
        case 'sub': this.pushTicker(`🔁 Entra ${ev.in}, sale ${ev.out}`); break;
        case 'aiAdapt': this.pushTicker(`📋 ${ev.text}`); break;
        case 'duelStart': this.showDuel(); break;
        case 'duelEnd': this.duelEl.classList.add('hidden'); break;
        default: break;
      }
    }
  }

  showDuel() {
    const d = this.engine.duel;
    if (!d) return;
    const tech = d.options.tech ? getTechnique(d.options.tech.id) : null;
    clear(this.duelEl).append(
      h('div', { class: 'duel-title' }, `¡DUELO! ${d.defender.name} va a por ti`),
      h('div', { class: 'duel-opts' },
        h('button', { class: 'btn', onclick: () => this.engine.chooseDuel('dribble') }, h('kbd', {}, 'L'), ' Regate'),
        h('button', { class: 'btn', disabled: !tech, onclick: () => this.engine.chooseDuel('tech') }, h('kbd', {}, 'U'), ` ${tech ? tech.name : 'Sin técnica'}`),
        h('button', { class: 'btn', onclick: () => this.engine.chooseDuel('pass') }, h('kbd', {}, 'J'), ' Pase'),
        h('button', { class: 'btn', disabled: !d.options.shoot, onclick: () => this.engine.chooseDuel('shoot') }, h('kbd', {}, 'K'), ' Tiro')),
      h('div', { class: 'duel-timer' }, h('div', {})));
    this.duelEl.classList.remove('hidden');
  }

  update(dt) {
    if (this.ended) return;
    const input = this.app.input;
    const e = this.engine;
    if (input.consume('pause') || input.consume('menu')) { this.pause(); return; }
    if (this.paused) return;
    if (e.phase === 'halftime') { this.halftime(); return; }
    if (e.finished) { this.finish(); return; }
    const ax = input.axis();
    const userHasBall = e.ball.owner && e.ball.owner === e.controlled;
    const passPressed = input.consume('pass');
    const frameInput = {
      moveX: ax.x, moveY: ax.y,
      sprint: input.held.has('sprint'),
      pass: passPressed && (userHasBall || !!e.duel),
      switch: input.consume('switch') || (passPressed && !userHasBall && !e.duel),
      shoot: input.consume('shoot'),
      special: input.consume('special'),
      tech: input.consume('tech'),
      dribble: input.consume('dribble') || (e.duel && input.consume('confirm')),
    };
    e.update(dt, frameInput);
    if (e.duel) {
      const bar = this.duelEl.querySelector('.duel-timer div');
      if (bar) bar.style.width = `${(e.duel.timer / 2.6) * 100}%`;
    }
    this.handleEvents();
    this.renderer.update(dt);
    this.updateHud();
  }

  draw() { this.renderer.draw(); }

  async pause() {
    if (this.paused || this.ended) return;
    this.paused = true;
    const v = await modal({
      title: 'Pausa', body: h('p', {}, `${this.engine.teams[0].spec.name} ${this.engine.teams[0].score} - ${this.engine.teams[1].score} ${this.team.name}`),
      buttons: [{ text: '▶ Continuar', value: 'resume', cls: 'primary' }, { text: '📋 Tácticas y cambios', value: 'tactics' }, { text: '⏩ Simular el resto', value: 'sim' }, { text: '🏳 Abandonar', value: 'quit' }],
    });
    if (v === 'tactics') await this.tactics();
    if (v === 'sim') this.simulateRest();
    if (v === 'quit') {
      const ok = await modal({ title: '¿Abandonar?', body: h('p', {}, 'Se contará como derrota 3-0.'), buttons: [{ text: 'No', value: false }, { text: 'Sí, abandonar', value: true, cls: 'danger' }] });
      if (ok) { this.engine.teams[1].score = Math.max(3, this.engine.teams[1].score); this.engine.teams[0].score = 0; this.engine.finished = true; }
    }
    this.paused = false;
  }

  simulateRest() {
    const e = this.engine;
    e.userTeam = null;
    let guard = 0;
    while (!e.finished && guard++ < 100000) {
      e.update(1 / 30, null);
      if (e.phase === 'halftime') e.resumeSecondHalf();
      e.drainEvents();
    }
  }

  async tactics() {
    const e = this.engine;
    const t = e.teams[0];
    const s = t.spec.strategy;
    const sel = (opts, key) => h('select', { onchange: (ev) => { e.setStrategy(0, { [key]: ev.target.value }); } }, Object.entries(opts).map(([k, o]) => h('option', { value: k, selected: s[key] === k }, o.label)));
    let fieldSel = null;
    const subsInfo = h('div', { class: 'small' }, `Cambios restantes: ${t.subsLeft}`);
    const fieldList = h('div', { class: 'sub-list' }, t.players.map((p, i) => h('button', { class: 'btn sub', onclick: (ev) => { fieldSel = i; fieldList.querySelectorAll('.btn').forEach((b) => b.classList.remove('selected')); ev.currentTarget.classList.add('selected'); } },
      `${p.role} ${p.name} · RES ${Math.round(p.stamina)}% · PT ${Math.floor(p.tp)}`)));
    const benchList = h('div', { class: 'sub-list' }, t.bench.map((p, i) => h('button', { class: 'btn sub', onclick: () => {
      if (fieldSel === null) { toast('Elige primero al jugador que sale.'); return; }
      const r = e.substitute(0, fieldSel, i);
      if (!r.ok) toast(r.reason, { type: 'error' });
      else { toast('Cambio realizado', { icon: '🔁' }); closeTopModal(); }
    } }, `${p.position} ${p.name} · Nv.${p.level}`)));
    await modal({
      title: 'Tácticas y cambios', cls: 'wide',
      body: h('div', {},
        h('div', { class: 'tactics-row' }, h('label', {}, 'Ataque ', sel(OFFENSE_STRATEGIES, 'offense')), h('label', {}, 'Defensa ', sel(DEFENSE_STRATEGIES, 'defense')), h('label', {}, 'Estilo ', sel(PLAY_STYLES, 'style'))),
        h('h3', {}, 'Sustituciones'), subsInfo,
        h('div', { class: 'subs' }, h('div', {}, h('b', {}, 'En el campo (sale)'), fieldList), h('div', {}, h('b', {}, 'Banquillo (entra)'), benchList))),
    });
  }

  async halftime() {
    if (this.paused) return;
    this.paused = true;
    const e = this.engine;
    audio.play('whistle');
    const v = await modal({
      title: 'Descanso', dismissable: false,
      body: h('div', {}, h('p', { class: 'res-num' }, `${e.teams[0].score} - ${e.teams[1].score}`),
        h('p', {}, `Posesión ${Math.round(e.teams[0].possessionTime / Math.max(1, e.teams[0].possessionTime + e.teams[1].possessionTime) * 100)}% · Tiros ${e.teams[0].shots}-${e.teams[1].shots}`),
        h('p', { class: 'muted' }, 'Aprovecha para ajustar la táctica o hacer cambios. Los jugadores recuperan algo de resistencia.')),
      buttons: [{ text: '📋 Tácticas y cambios', value: 'tactics' }, { text: '▶ Segunda parte', value: 'go', cls: 'primary' }],
    });
    if (v === 'tactics') await this.tactics();
    for (const p of e.allPlayers()) p.stamina = Math.min(100, p.stamina + 25);
    e.resumeSecondHalf();
    this.paused = false;
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.handleEvents();
    setTimeout(() => this.onEnd(this.engine.result()), 900);
  }
}
