// Motor de partido en tiempo real (sin dependencias de DOM).
//
// - El equipo 0 ataca hacia +x (portería en x = fieldW); el equipo 1 hacia -x.
// - Si `userTeam` es 0, el jugador controla a un futbolista del equipo 0 y el
//   resto lo mueve la IA. Con `userTeam = null` ambos equipos son IA
//   (simulación rápida y tests).
// - El motor emite eventos (`this.events`) que consumen el renderizador, el
//   audio y la pantalla de resultados.

import { MATCH, DIFFICULTY } from '../config.js';
import { RNG } from '../core/rng.js';
import { getTechnique } from '../systems/database.js';
import { resolveDuel, resolveShot, resolveBlock } from './duel.js';
import { TeamAI } from './match-ai.js';

const L = MATCH.fieldW;
const W = MATCH.fieldH;
const GOAL_TOP = W / 2 - MATCH.goalWidth / 2;
const GOAL_BOT = W / 2 + MATCH.goalWidth / 2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distancia de un punto a un segmento. */
export function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function makeMatchPlayer(spec, team, idx, slot) {
  return {
    ...spec,
    team,
    idx,
    role: slot ? slot.role : spec.position,
    slot: slot ? { x: slot.x, y: slot.y } : { x: 0.4, y: 0.5 },
    tp: spec.startTp,
    stamina: 100,
    x: 0, y: 0, vx: 0, vy: 0,
    face: { x: team === 0 ? 1 : -1, y: 0 },
    stun: 0,
    tackleCd: 0,
    kickCd: 0,
    think: 0,
    target: null,
    wantSprint: false,
    plannedDribbleTech: null,
    onField: true,
    m: { goals: 0, assists: 0, shots: 0, saves: 0, tacklesWon: 0, passes: 0, techs: 0, dribblesWon: 0 },
    techUses: {},
  };
}

export class MatchEngine {
  /**
   * @param {object} o
   * @param {object} o.home especificación del equipo 0
   * @param {object} o.away especificación del equipo 1
   * @param {number|null} o.userTeam 0 si el jugador controla al local
   * @param {object} o.settings { halfDurationSec, difficulty, duelPrompts, autoSwitch }
   */
  constructor({ home, away, userTeam = 0, settings = {}, seed = Date.now() }) {
    this.rng = new RNG(seed);
    this.settings = {
      halfDurationSec: settings.halfDurationSec ?? MATCH.halfDurationSec,
      difficulty: settings.difficulty ?? 'normal',
      duelPrompts: settings.duelPrompts ?? true,
      autoSwitch: settings.autoSwitch ?? true,
    };
    this.diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    this.userTeam = userTeam;
    this.teams = [home, away].map((spec, t) => ({
      spec,
      side: t,
      dir: t === 0 ? 1 : -1,
      players: spec.starters.map((s, i) => makeMatchPlayer(s, t, i, spec.formation.slots[i])),
      bench: spec.bench.map((s, i) => makeMatchPlayer(s, t, 100 + i, null)),
      subsLeft: MATCH.maxSubs,
      score: 0,
      possessionTime: 0,
      shots: 0,
      onTarget: 0,
    }));
    // Dificultad: afecta solo al equipo de la IA cuando juega el usuario.
    if (userTeam !== null) {
      for (const p of this.teams[1 - userTeam].players.concat(this.teams[1 - userTeam].bench)) {
        for (const k of Object.keys(p.stats)) p.stats[k] = Math.round(p.stats[k] * this.diff.aiStatMul);
      }
    }
    this.ai = [new TeamAI(this, 0), new TeamAI(this, 1)];
    this.ball = { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: 0, kind: null, passTarget: null, shot: null, interceptTried: new Set(), element: null };
    this.half = 1;
    this.elapsed = 0;           // segundos reales en la parte actual
    this.phase = 'kickoff';     // kickoff | play | goal | restart | halftime | fulltime
    this.phaseTimer = 1.2;
    this.freeze = 0;            // pausa breve para cinemáticas de técnicas
    this.pendingAction = null;  // acción que se ejecuta al terminar la cinemática
    this.duel = null;           // prompt de duelo táctico para el usuario
    this.duelCooldown = 0;
    this.controlled = null;
    this.switchCd = 0;
    this.events = [];
    this.goals = [];
    this.kickoffTeam = 0;
    this.finished = false;
    this.setupKickoff(0);
  }

  // ------------------------------------------------------------------ utilidades

  emit(type, data = {}) { this.events.push({ type, t: this.clockMinutes(), ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  clockMinutes() {
    const frac = clamp(this.elapsed / this.settings.halfDurationSec, 0, 1);
    return Math.floor((this.half - 1) * MATCH.gameMinutesPerHalf + frac * MATCH.gameMinutesPerHalf);
  }

  allPlayers() { return this.teams[0].players.concat(this.teams[1].players); }
  opponents(team) { return this.teams[1 - team].players; }
  mates(team) { return this.teams[team].players; }
  goalOf(team) { return { x: team === 0 ? L : 0, y: W / 2 }; }      // portería que ataca `team`
  ownGoal(team) { return { x: team === 0 ? 0 : L, y: W / 2 }; }
  keeper(team) { return this.teams[team].players.find((p) => p.role === 'GK') || this.teams[team].players[0]; }
  carrier() { return this.ball.owner; }
  possessionTeam() { return this.ball.owner ? this.ball.owner.team : null; }

  homePosition(p) {
    const t = this.teams[p.team];
    const x = p.team === 0 ? p.slot.x * L : (1 - p.slot.x) * L;
    const y = p.team === 0 ? p.slot.y * W : (1 - p.slot.y) * W;
    return { x, y, dir: t.dir };
  }

  // ------------------------------------------------------------------ fases

  setupKickoff(team) {
    this.kickoffTeam = team;
    for (const p of this.allPlayers()) {
      const h = this.homePosition(p);
      // Cada equipo en su mitad.
      const ownHalfX = p.team === 0 ? clamp(h.x * 0.85, 20, L / 2 - 30) : clamp(L - (L - h.x) * 0.85, L / 2 + 30, L - 20);
      p.x = ownHalfX; p.y = h.y; p.vx = p.vy = 0; p.stun = 0;
      p.face = { x: p.team === 0 ? 1 : -1, y: 0 };
    }
    const kicker = this.teams[team].players
      .filter((p) => p.role !== 'GK')
      .sort((a, b) => (team === 0 ? b.x - a.x : a.x - b.x))[0];
    kicker.x = L / 2 - (team === 0 ? 14 : -14);
    kicker.y = W / 2;
    Object.assign(this.ball, { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, kind: null, shot: null, passTarget: null, element: null });
    this.giveBall(kicker, false);
    this.phase = 'kickoff';
    this.phaseTimer = 1.0;
    if (this.userTeam === team) this.controlled = kicker;
    else if (this.userTeam !== null && !this.controlled) this.controlled = this.teams[this.userTeam].players.find((p) => p.role === 'FW') || this.teams[this.userTeam].players[1];
  }

  giveBall(p, emit = true) {
    const b = this.ball;
    if (b.owner && b.owner !== p && b.owner.team === p.team && emit && b.kind === 'pass') {
      // pase completado
    }
    b.owner = p;
    b.lastTouch = p.team;
    b.kind = null;
    b.shot = null;
    b.passTarget = null;
    b.vx = b.vy = b.vz = 0; b.z = 0;
    b.interceptTried = new Set();
    b.element = null;
    p.kickCd = 0;
    if (this.userTeam === p.team && p.role !== 'GK') this.controlled = p;
    if (emit) this.emit('possession', { team: p.team, player: p.name });
  }

  // ------------------------------------------------------------------ bucle principal

  /**
   * Avanza la simulación.
   * @param {number} dt segundos
   * @param {object} input estado del control del usuario
   */
  update(dt, input = null) {
    if (this.finished) return;
    dt = Math.min(dt, 0.05);

    if (this.duel) { this.updateDuel(dt, input); return; }
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0 && this.pendingAction) { const a = this.pendingAction; this.pendingAction = null; a(); }
      return;
    }

    if (this.phase === 'goal' || this.phase === 'restart' || this.phase === 'kickoff') {
      this.phaseTimer -= dt;
      if (this.phase === 'goal') this.moveTowardHome(dt);
      if (this.phaseTimer <= 0) {
        if (this.phase === 'goal') this.setupKickoff(this.kickoffTeam);
        else this.phase = 'play';
      }
      if (this.phase !== 'play') return;
    }
    if (this.phase === 'halftime' || this.phase === 'fulltime') return;

    this.elapsed += dt;
    if (this.elapsed >= this.settings.halfDurationSec) {
      if (this.half === 1) {
        this.half = 2; this.elapsed = 0;
        this.phase = 'halftime';
        this.emit('whistle', { kind: 'half' });
        return;
      }
      this.phase = 'fulltime';
      this.finished = true;
      this.emit('whistle', { kind: 'end' });
      return;
    }

    this.duelCooldown = Math.max(0, this.duelCooldown - dt);
    this.switchCd = Math.max(0, this.switchCd - dt);
    const pt = this.possessionTeam();
    if (pt !== null) this.teams[pt].possessionTime += dt;

    for (const p of this.allPlayers()) {
      p.stun = Math.max(0, p.stun - dt);
      p.tackleCd = Math.max(0, p.tackleCd - dt);
      p.kickCd = Math.max(0, p.kickCd - dt);
      p.tp = Math.min(p.maxTp, p.tp + MATCH.tpRegenPerSec * dt);
    }

    this.ai[0].update(dt);
    this.ai[1].update(dt);
    if (this.userTeam !== null && input) this.handleUserInput(dt, input);
    this.integratePlayers(dt);
    this.updateBall(dt);
    this.autoSwitch();
  }

  resumeSecondHalf() {
    if (this.phase !== 'halftime') return;
    this.setupKickoff(1);
  }

  // ------------------------------------------------------------------ movimiento

  speedOf(p) {
    const base = MATCH.baseSpeed + p.stats.speed * MATCH.speedPerStat;
    const stam = 0.7 + 0.3 * (p.stamina / 100);
    const carry = this.ball.owner === p ? MATCH.carryMul : 1;
    const sprint = p.wantSprint && p.stamina > 10 ? MATCH.sprintMul : 1;
    return base * stam * carry * sprint;
  }

  staminaMul(p) { return 0.75 + 0.25 * (p.stamina / 100); }

  integratePlayers(dt) {
    const players = this.allPlayers();
    for (const p of players) {
      if (p.stun > 0) { p.vx *= 0.8; p.vy *= 0.8; }
      else if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        const sp = this.speedOf(p) * (p.target.speedMul ?? 1);
        const arrive = Math.min(1, d / 30);
        const tvx = d > 2 ? (dx / d) * sp * arrive : 0;
        const tvy = d > 2 ? (dy / d) * sp * arrive : 0;
        const k = Math.min(1, dt * 8);
        p.vx += (tvx - p.vx) * k;
        p.vy += (tvy - p.vy) * k;
      }
      // separación entre jugadores
      for (const q of players) {
        if (q === p) continue;
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < 22 * 22) {
          const d = Math.sqrt(d2);
          const push = (22 - d) * 4;
          p.vx += (dx / d) * push * dt * 10;
          p.vy += (dy / d) * push * dt * 10;
        }
      }
      p.x = clamp(p.x + p.vx * dt, -10, L + 10);
      p.y = clamp(p.y + p.vy * dt, 4, W - 4);
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 10) p.face = { x: p.vx / sp, y: p.vy / sp };
      // resistencia
      const effort = sp / (MATCH.baseSpeed + p.stats.speed * MATCH.speedPerStat);
      const resist = 50 / (35 + p.stats.stamina * 0.5);
      const drain = (MATCH.staminaDrain * effort + (p.wantSprint && sp > 20 ? MATCH.sprintDrain : 0)) * resist;
      p.stamina = clamp(p.stamina - drain * dt + (sp < 15 ? MATCH.staminaRegen * dt : 0), 0, 100);
    }
  }

  moveTowardHome(dt) {
    for (const p of this.allPlayers()) {
      const h = this.homePosition(p);
      p.target = { x: h.x, y: h.y, speedMul: 0.6 };
    }
    this.integratePlayers(dt);
  }

  // ------------------------------------------------------------------ balón

  updateBall(dt) {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      b.x = o.x + o.face.x * 12;
      b.y = o.y + o.face.y * 12;
      b.vx = o.vx; b.vy = o.vy; b.z = 0;
      return;
    }
    const prev = { x: b.x, y: b.y };
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vz -= 600 * dt;
    b.z = Math.max(0, b.z + b.vz * dt);
    if (b.z === 0 && b.vz < 0) b.vz = Math.abs(b.vz) * 0.35 < 30 ? 0 : Math.abs(b.vz) * 0.35;
    const friction = b.kind === 'shot' ? 0.35 : MATCH.ballFriction;
    const f = Math.exp(-friction * dt);
    b.vx *= f; b.vy *= f;
    const speed = Math.hypot(b.vx, b.vy);

    if (b.kind === 'shot') this.updateShot(prev);
    if (!this.ball.owner && b.kind === 'pass') this.checkInterceptions();
    if (this.ball.owner) return;
    if (this.checkOut()) return;

    if (b.kind === 'shot' && speed < 140) { b.kind = null; b.shot = null; }
    if (b.kind === 'pass' && speed < 60) b.kind = null;

    // Recogida del balón suelto.
    let best = null, bestD = Infinity;
    for (const p of this.allPlayers()) {
      if (p.stun > 0 || p.kickCd > 0) continue;
      const d = dist(p, b);
      const radius = MATCH.pickupRadius + (p.role === 'GK' ? 6 : 0);
      if (d < radius && d < bestD && b.z < 30) {
        if (b.kind === 'shot') continue;
        if (b.kind === 'pass' && speed > 260 && b.passTarget !== p && p.team === b.lastTouch) continue;
        best = p; bestD = d;
      }
    }
    if (best) {
      if (b.kind === 'pass' && best.team === b.lastTouch && b.passer) b.passer.m.passes++;
      this.giveBall(best);
    }
  }

  checkInterceptions() {
    const b = this.ball;
    for (const p of this.opponents(b.lastTouch)) {
      if (p.stun > 0 || b.interceptTried.has(p) || p.role === 'GK') continue;
      if (dist(p, b) < 20 && b.z < 25) {
        b.interceptTried.add(p);
        const passer = b.passer;
        const r = resolveDuel(this.rng,
          { stats: passer?.stats || p.stats, element: passer?.element },
          { stats: p.stats, element: p.element, staminaMul: this.staminaMul(p) },
          'pass', 'intercept', { atkMul: 1.35 });
        if (!r.attackerWins) {
          this.emit('intercept', { team: p.team, player: p.name });
          this.giveBall(p);
          return;
        }
      }
    }
  }

  checkOut() {
    const b = this.ball;
    // Gol
    if ((b.x <= 0 || b.x >= L) && b.y > GOAL_TOP && b.y < GOAL_BOT) {
      const scoringTeam = b.x >= L ? 0 : 1;
      if (b.kind === 'shot' && b.shot && !b.shot.keeperResolved) {
        // El portero aún no ha intentado parar (tiro muy rápido): resolver ahora.
        this.resolveKeeper(b.shot);
        if (this.ball.owner || this.ball.kind !== 'shot') return true;
      }
      this.scoreGoal(scoringTeam);
      return true;
    }
    // Banda
    if (b.y < 0 || b.y > W) {
      const team = 1 - b.lastTouch;
      this.restartWith(team, { x: clamp(b.x, 30, L - 30), y: b.y < 0 ? 6 : W - 6 }, 'throw');
      return true;
    }
    // Línea de fondo
    if (b.x < 0 || b.x > L) {
      const defending = b.x < 0 ? 0 : 1;
      if (b.lastTouch === defending) {
        const att = 1 - defending;
        this.restartWith(att, { x: b.x < 0 ? 12 : L - 12, y: b.y < W / 2 ? 12 : W - 12 }, 'corner');
      } else {
        const gk = this.keeper(defending);
        this.restartWith(defending, { x: defending === 0 ? 50 : L - 50, y: W / 2 }, 'goalkick', gk);
      }
      return true;
    }
    return false;
  }

  restartWith(team, pos, kind, forced = null) {
    const p = forced || this.teams[team].players
      .filter((q) => q.role !== 'GK')
      .sort((a, c) => dist(a, pos) - dist(c, pos))[0];
    p.x = pos.x; p.y = pos.y; p.vx = p.vy = 0;
    // apartar rivales cercanos
    for (const o of this.opponents(team)) {
      if (dist(o, pos) < 70) {
        const d = dist(o, pos) || 1;
        o.x = clamp(pos.x + ((o.x - pos.x) / d) * 70, 10, L - 10);
        o.y = clamp(pos.y + ((o.y - pos.y) / d) * 70, 10, W - 10);
      }
    }
    this.ball.x = pos.x; this.ball.y = pos.y;
    this.giveBall(p, false);
    this.phase = 'restart';
    this.phaseTimer = 0.7;
    this.emit('restart', { kind, team });
  }

  scoreGoal(team) {
    const b = this.ball;
    const shot = b.shot;
    const t = this.teams[team];
    t.score++;
    const scorer = shot?.shooter && shot.shooter.team === team ? shot.shooter : null;
    if (scorer) scorer.m.goals++;
    const goal = { team, minute: this.clockMinutes(), scorer: scorer?.name || 'Gol en propia', scorerId: scorer?.id || null, tech: shot?.techName || null };
    this.goals.push(goal);
    this.emit('goal', goal);
    b.kind = null; b.shot = null; b.vx = b.vy = 0; b.owner = null;
    b.x = team === 0 ? L + 8 : -8;
    this.phase = 'goal';
    this.phaseTimer = 2.6;
    this.kickoffTeam = 1 - team;
    this.ai[1 - team].onConcede?.();
  }

  // ------------------------------------------------------------------ acciones

  /** Pase a un compañero. */
  pass(p, target, { lead = true } = {}) {
    if (this.ball.owner !== p || !target) return false;
    const b = this.ball;
    const tx = target.x + (lead ? target.vx * 0.35 : 0);
    const ty = target.y + (lead ? target.vy * 0.35 : 0);
    const d = Math.hypot(tx - p.x, ty - p.y);
    const accuracy = clamp(p.stats.control / 120, 0.35, 1);
    const err = (1 - accuracy) * (d / 8) * (this.rng.next() * 2 - 1);
    const ang = Math.atan2(ty - p.y, tx - p.x) + err * 0.01;
    const speed = clamp(MATCH.passSpeedBase * (0.55 + d / 600), 260, 620);
    b.owner = null;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.vz = d > 260 ? 220 : 40;
    b.kind = 'pass';
    b.passTarget = target;
    b.passer = p;
    b.lastTouch = p.team;
    b.interceptTried = new Set();
    p.kickCd = 0.35;
    this.emit('pass', { team: p.team, from: p.name, to: target.name });
    if (this.userTeam === p.team) this.switchCd = 0;
    return true;
  }

  /** Tiro a puerta (normal, con técnica o combinado). aimY: -1..1 */
  shoot(p, { tech = null, partners = [], aimY = 0 } = {}) {
    if (this.ball.owner !== p) return false;
    const goal = this.goalOf(p.team);
    let techInfo = null;
    if (tech) {
      const t = getTechnique(tech.id);
      const cost = t.combo ? Math.round(t.tp * 0.6) : t.tp;
      if (p.tp < cost || partners.some((q) => q.tp < cost)) return false;
      p.tp -= cost;
      partners.forEach((q) => { q.tp -= cost; q.m.techs++; });
      p.m.techs++;
      p.techUses[t.id] = (p.techUses[t.id] || 0) + 1;
      techInfo = { id: t.id, level: tech.level, name: t.name, element: t.element, anim: t.anim, combo: !!t.combo };
    }
    p.m.shots++;
    this.teams[p.team].shots++;
    const launch = () => {
      if (this.ball.owner !== p) return;
      const spreadBase = (1 - clamp(p.stats.shoot / 140, 0.3, 0.95)) * MATCH.goalWidth * 0.55;
      const aim = clamp(goal.y + aimY * MATCH.goalWidth * 0.38 + (this.rng.next() * 2 - 1) * spreadBase, GOAL_TOP - 30, GOAL_BOT + 30);
      const d = Math.hypot(goal.x - p.x, aim - p.y);
      const speed = (techInfo ? MATCH.techShotSpeed : MATCH.shotSpeedBase) * (0.85 + p.stats.shoot / 400);
      const b = this.ball;
      b.owner = null;
      b.vx = ((goal.x - p.x) / d) * speed;
      b.vy = ((aim - p.y) / d) * speed;
      b.vz = techInfo ? 80 : 120;
      b.kind = 'shot';
      b.lastTouch = p.team;
      b.element = techInfo?.element || null;
      // Para combos, se suma el apoyo de los compañeros a las estadísticas del tirador.
      const shooterStats = { ...p.stats };
      for (const q of partners) for (const k of Object.keys(shooterStats)) shooterStats[k] += Math.round(q.stats[k] * 0.35);
      b.shot = {
        shooter: p,
        team: p.team,
        tech: techInfo ? { id: techInfo.id, level: techInfo.level } : null,
        techName: techInfo?.name || null,
        stats: shooterStats,
        element: p.element,
        origin: { x: p.x, y: p.y },
        shotMul: 1,
        blockTried: new Set(),
        keeperResolved: false,
        staminaMul: this.staminaMul(p),
      };
      p.kickCd = 0.5;
      this.emit('shot', { team: p.team, player: p.name, tech: techInfo });
    };
    if (techInfo) {
      this.freeze = MATCH.cinematicTime * (techInfo.combo ? 1.3 : 1);
      this.pendingAction = launch;
      this.emit('tech', { team: p.team, player: p.name, playerId: p.id, partners: partners.map((q) => q.name), tech: techInfo, category: 'shoot', x: p.x, y: p.y });
    } else {
      launch();
    }
    return true;
  }

  updateShot(prev) {
    const b = this.ball;
    const s = b.shot;
    if (!s) return;
    const defTeam = 1 - s.team;
    // Bloqueos de defensores en la trayectoria.
    for (const d of this.teams[defTeam].players) {
      if (d.role === 'GK' || d.stun > 0 || s.blockTried.has(d)) continue;
      if (distToSegment(d, prev, b) < 18) {
        s.blockTried.add(d);
        const blockTech = this.ai[defTeam].pickTech(d, 'block');
        if (!blockTech && !this.rng.chance(0.45)) continue;
        if (blockTech) this.useTechCost(d, blockTech);
        const r = resolveBlock(this.rng,
          { stats: s.stats, element: s.element, tech: s.tech, staminaMul: s.staminaMul },
          { stats: d.stats, element: d.element, tech: blockTech, staminaMul: this.staminaMul(d) },
          { shotMul: s.shotMul });
        this.emit('block', { team: defTeam, player: d.name, success: r.blocked, tech: blockTech ? this.techInfo(blockTech) : null, x: d.x, y: d.y });
        if (r.blocked) {
          d.m.saves++;
          b.kind = null; b.shot = null;
          b.vx = -b.vx * 0.25 + (this.rng.next() - 0.5) * 120;
          b.vy = (this.rng.next() - 0.5) * 220;
          b.lastTouch = defTeam;
          return;
        }
        s.shotMul *= r.weaken;
      }
    }
    // Portero
    const gk = this.keeper(defTeam);
    const reach = 30 + gk.stats.defense * 0.08;
    if (!s.keeperResolved && gk.stun <= 0 && dist(gk, b) < reach) this.resolveKeeper(s);
  }

  resolveKeeper(s) {
    const b = this.ball;
    const defTeam = 1 - s.team;
    const gk = this.keeper(defTeam);
    s.keeperResolved = true;
    const gkTech = this.ai[defTeam].pickTech(gk, 'keeper', { forShot: s });
    if (gkTech) this.useTechCost(gk, gkTech);
    const distance = Math.hypot(s.origin.x - this.goalOf(s.team).x, s.origin.y - W / 2);
    const r = resolveShot(this.rng,
      { stats: s.stats, element: s.element, tech: s.tech, staminaMul: s.staminaMul },
      { stats: gk.stats, element: gk.element, tech: gkTech, staminaMul: this.staminaMul(gk) },
      distance, { shotMul: s.shotMul });
    this.teams[s.team].onTarget++;
    if (gkTech) this.emit('tech', { team: defTeam, player: gk.name, playerId: gk.id, tech: this.techInfo(gkTech), category: 'keeper', x: gk.x, y: gk.y, short: true });
    if (r.goal) {
      this.emit('keeperBeaten', { team: defTeam, player: gk.name });
      // El balón sigue hacia la red.
      return;
    }
    gk.m.saves++;
    if (r.caught) {
      this.emit('save', { team: defTeam, player: gk.name, caught: true });
      this.giveBall(gk);
      gk.kickCd = 0;
      this.ai[defTeam].holdTimer = 0.8;
    } else {
      this.emit('save', { team: defTeam, player: gk.name, caught: false });
      b.kind = null; b.shot = null;
      b.vx = -b.vx * 0.35;
      b.vy = (this.rng.next() < 0.5 ? -1 : 1) * (180 + this.rng.next() * 150);
      b.lastTouch = defTeam;
      gk.kickCd = 0.4;
    }
  }

  techInfo(tech) {
    const t = getTechnique(tech.id);
    return { id: t.id, level: tech.level, name: t.name, element: t.element, anim: t.anim };
  }

  useTechCost(p, tech) {
    const t = getTechnique(tech.id);
    p.tp = Math.max(0, p.tp - t.tp);
    p.m.techs++;
    p.techUses[t.id] = (p.techUses[t.id] || 0) + 1;
  }

  canAfford(p, techId) { return p.tp >= getTechnique(techId).tp; }

  /**
   * Entrada de `def` sobre el portador. Resuelve el duelo regate vs. defensa.
   * carrierTech / defTech: { id, level } o null.
   */
  tackle(def, { defTech = null, carrierTech = null } = {}) {
    const c = this.ball.owner;
    if (!c || c.team === def.team || def.tackleCd > 0 || def.stun > 0) return false;
    def.tackleCd = MATCH.tackleCooldown;
    if (dist(def, c) > MATCH.tackleRange + (defTech ? 18 : 0)) {
      def.stun = 0.25; // entrada en falso
      this.emit('tackleMiss', { team: def.team, player: def.name });
      return false;
    }
    // ¿Activa el usuario un duelo táctico?
    if (this.userTeam === c.team && c === this.controlled && this.settings.duelPrompts && this.duelCooldown <= 0 && !carrierTech) {
      this.startDuel(c, def, defTech);
      return true;
    }
    if (!carrierTech && c.team !== this.userTeam) carrierTech = c.plannedDribbleTech || this.ai[c.team].pickTech(c, 'dribble', { duel: true });
    c.plannedDribbleTech = null;
    this.resolveTackle(def, c, defTech, carrierTech);
    return true;
  }

  resolveTackle(def, c, defTech, carrierTech) {
    if (defTech) this.useTechCost(def, defTech);
    if (carrierTech) this.useTechCost(c, carrierTech);
    const action = () => {
      const r = resolveDuel(this.rng,
        { stats: c.stats, element: c.element, tech: carrierTech, staminaMul: this.staminaMul(c) },
        { stats: def.stats, element: def.element, tech: defTech, staminaMul: this.staminaMul(def) },
        'dribble', 'tackle');
      if (r.attackerWins) {
        def.stun = MATCH.stunBeaten;
        c.m.dribblesWon++;
        const dir = this.teams[c.team].dir;
        c.vx += dir * 120; // pequeño acelerón tras ganar el duelo
        this.emit('dribble', { team: c.team, player: c.name, vs: def.name, tech: carrierTech ? this.techInfo(carrierTech) : null });
      } else {
        c.stun = MATCH.stunTackled;
        def.m.tacklesWon++;
        this.emit('tackle', { team: def.team, player: def.name, vs: c.name, tech: defTech ? this.techInfo(defTech) : null });
        this.giveBall(def);
      }
      this.ai[c.team].onDuel?.(r.attackerWins);
    };
    if (defTech || carrierTech) {
      const tech = carrierTech || defTech;
      const actor = carrierTech ? c : def;
      this.emit('tech', { team: actor.team, player: actor.name, playerId: actor.id, tech: this.techInfo(tech), category: carrierTech ? 'dribble' : 'defense', x: actor.x, y: actor.y, short: true });
      this.freeze = MATCH.cinematicTime * 0.75;
      this.pendingAction = action;
    } else {
      action();
    }
  }

  // ------------------------------------------------------------------ duelo táctico (usuario)

  startDuel(carrier, defender, defTech) {
    const goalD = dist(carrier, this.goalOf(carrier.team));
    const dribbleTech = this.ai[carrier.team].pickTech(carrier, 'dribble', { duel: true, any: true });
    this.duel = {
      carrier, defender, defTech,
      timer: MATCH.duelPromptTime,
      options: {
        dribble: true,
        tech: dribbleTech,
        pass: true,
        shoot: goalD < MATCH.shootRange * 1.1,
      },
    };
    this.emit('duelStart', { player: carrier.name, vs: defender.name });
  }

  /** El usuario elige respuesta al duelo: 'dribble' | 'tech' | 'pass' | 'shoot'. */
  chooseDuel(option) {
    const d = this.duel;
    if (!d) return;
    this.duel = null;
    this.duelCooldown = MATCH.duelPromptCooldown;
    const { carrier, defender, defTech } = d;
    this.emit('duelEnd', { option });
    if (this.ball.owner !== carrier) return;
    if (option === 'pass') {
      const target = this.ai[carrier.team].bestPassTarget(carrier);
      if (target) { this.pass(carrier, target); defender.tackleCd = MATCH.tackleCooldown; return; }
    }
    if (option === 'shoot' && d.options.shoot) {
      const shotTech = this.ai[carrier.team].pickTech(carrier, 'shoot', {});
      this.shoot(carrier, { tech: shotTech });
      return;
    }
    const tech = option === 'tech' && d.options.tech && this.canAfford(carrier, d.options.tech.id) ? d.options.tech : null;
    this.resolveTackle(defender, carrier, defTech, tech);
  }

  updateDuel(dt, input) {
    this.duel.timer -= dt;
    if (input) {
      if (input.pass) return this.chooseDuel('pass');
      if (input.shoot && this.duel.options.shoot) return this.chooseDuel('shoot');
      if (input.tech && this.duel.options.tech) return this.chooseDuel('tech');
      if (input.dribble) return this.chooseDuel('dribble');
    }
    if (this.duel.timer <= 0) this.chooseDuel('dribble');
  }

  // ------------------------------------------------------------------ control del usuario

  handleUserInput(dt, input) {
    let c = this.controlled;
    if (!c || !c.onField) return;
    if (input.switch && this.ball.owner?.team !== c.team) {
      this.switchToNearest(true);
      c = this.controlled;
    }
    c.wantSprint = !!input.sprint;
    if (c.stun <= 0) {
      const mx = input.moveX || 0, my = input.moveY || 0;
      const m = Math.hypot(mx, my);
      if (m > 0.1) {
        c.target = { x: c.x + (mx / m) * 60, y: c.y + (my / m) * 60, speedMul: 1 };
      } else {
        c.target = { x: c.x, y: c.y };
        c.vx *= 0.85; c.vy *= 0.85;
      }
    }
    const hasBall = this.ball.owner === c;
    if (hasBall) {
      if (input.pass) {
        const target = this.ai[c.team].bestPassTarget(c, { dirX: input.moveX || c.face.x, dirY: input.moveY || c.face.y });
        if (target) this.pass(c, target);
      } else if (input.shoot) {
        this.shoot(c, { aimY: input.moveY || 0 });
      } else if (input.special) {
        const combo = this.ai[c.team].findCombo(c);
        if (combo) this.shoot(c, { tech: combo.tech, partners: combo.partners, aimY: input.moveY || 0 });
        else {
          const t = this.ai[c.team].pickTech(c, 'shoot', { any: true });
          if (t) this.shoot(c, { tech: t, aimY: input.moveY || 0 });
          else this.emit('noTp', { player: c.name });
        }
      } else if (input.tech) {
        // Regate especial contra el rival más cercano.
        const near = this.opponents(c.team).filter((o) => o.stun <= 0).sort((a, b) => dist(a, c) - dist(b, c))[0];
        const t = this.ai[c.team].pickTech(c, 'dribble', { any: true });
        if (!t) this.emit('noTp', { player: c.name });
        else if (near && dist(near, c) < 70) this.resolveTackle(near, c, null, t);
        else { this.useTechCost(c, t); c.vx += this.teams[c.team].dir * 220; this.emit('tech', { team: c.team, player: c.name, playerId: c.id, tech: this.techInfo(t), category: 'dribble', x: c.x, y: c.y, short: true }); this.freeze = 0.5; }
      }
    } else {
      const carrier = this.ball.owner;
      if (input.shoot && carrier && carrier.team !== c.team) {
        this.tackle(c, {});
      } else if (input.tech && carrier && carrier.team !== c.team) {
        const t = this.ai[c.team].pickTech(c, 'defense', { any: true });
        if (t) this.tackle(c, { defTech: t });
        else this.emit('noTp', { player: c.name });
      } else if (input.shoot && !carrier) {
        // Disparo/despeje de primeras si el balón está cerca.
        if (dist(c, this.ball) < MATCH.pickupRadius * 2) this.giveBall(c);
      }
    }
  }

  switchToNearest(force = false) {
    if (this.userTeam === null) return;
    const team = this.teams[this.userTeam];
    const candidates = team.players.filter((p) => p.role !== 'GK' && p !== (force ? this.controlled : null));
    const target = this.ball.owner && this.ball.owner.team !== this.userTeam ? this.ball.owner : this.ball;
    candidates.sort((a, b) => dist(a, target) - dist(b, target));
    if (candidates[0]) { this.controlled = candidates[0]; this.switchCd = 0.8; }
  }

  autoSwitch() {
    if (this.userTeam === null) return;
    const owner = this.ball.owner;
    if (owner && owner.team === this.userTeam && owner.role !== 'GK') { this.controlled = owner; return; }
    if (this.ball.kind === 'pass' && this.ball.passTarget && this.ball.lastTouch === this.userTeam) {
      this.controlled = this.ball.passTarget;
      return;
    }
    if (!this.settings.autoSwitch || this.switchCd > 0) return;
    const team = this.teams[this.userTeam];
    const target = owner || this.ball;
    const nearest = team.players.filter((p) => p.role !== 'GK').sort((a, b) => dist(a, target) - dist(b, target))[0];
    if (nearest && this.controlled && nearest !== this.controlled && dist(nearest, target) + 60 < dist(this.controlled, target)) {
      this.controlled = nearest;
      this.switchCd = 1.0;
    }
  }

  // ------------------------------------------------------------------ cambios / tácticas

  substitute(team, fieldIdx, benchIdx) {
    const t = this.teams[team];
    if (t.subsLeft <= 0) return { ok: false, reason: 'No quedan cambios.' };
    const out = t.players[fieldIdx];
    const inn = t.bench[benchIdx];
    if (!out || !inn) return { ok: false, reason: 'Selección inválida.' };
    inn.x = out.x; inn.y = out.y; inn.slot = out.slot; inn.role = out.role; inn.idx = out.idx;
    inn.onField = true; out.onField = false;
    t.players[fieldIdx] = inn;
    t.bench.splice(benchIdx, 1, out);
    t.subsLeft--;
    if (this.controlled === out) this.controlled = inn;
    if (this.ball.owner === out) this.giveBall(inn, false);
    this.emit('sub', { team, out: out.name, in: inn.name });
    return { ok: true };
  }

  setStrategy(team, strategy) {
    Object.assign(this.teams[team].spec.strategy, strategy);
    this.ai[team].refreshParams();
  }

  // ------------------------------------------------------------------ resultados

  result() {
    const [a, b] = this.teams;
    const total = a.possessionTime + b.possessionTime || 1;
    const ratings = {};
    for (const t of this.teams) {
      for (const p of t.players.concat(t.bench)) {
        const m = p.m;
        const played = p.onField || Object.values(m).some((v) => v > 0);
        if (!played) continue;
        const goalsAgainst = this.teams[1 - p.team].score;
        let r = 6 + m.goals * 1.2 + m.assists * 0.6 + m.tacklesWon * 0.25 + m.saves * 0.35 + m.dribblesWon * 0.2 + m.techs * 0.1 + m.passes * 0.05;
        if (p.role === 'GK' || p.role === 'DF') r -= goalsAgainst * 0.3;
        ratings[p.id] = clamp(Math.round(r * 10) / 10, 3, 10);
      }
    }
    const mvp = Object.entries(ratings).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    const techUses = [];
    for (const t of this.teams) for (const p of t.players.concat(t.bench)) {
      for (const [id, n] of Object.entries(p.techUses)) techUses.push({ team: p.team, playerId: p.id, techId: id, count: n });
    }
    return {
      score: [a.score, b.score],
      goals: this.goals,
      possession: [Math.round((a.possessionTime / total) * 100), Math.round((b.possessionTime / total) * 100)],
      shots: [a.shots, b.shots],
      onTarget: [a.onTarget, b.onTarget],
      ratings,
      mvp,
      techUses,
      winner: a.score > b.score ? 0 : b.score > a.score ? 1 : null,
    };
  }
}

/** Simula un partido completo sin interfaz (IA contra IA). */
export function simulateMatch({ home, away, seed = 1, halfDurationSec = 90, difficulty = 'normal' }) {
  const engine = new MatchEngine({ home, away, userTeam: null, seed, settings: { halfDurationSec, difficulty, duelPrompts: false } });
  const dt = 1 / 30;
  let guard = 0;
  while (!engine.finished && guard++ < 200000) {
    engine.update(dt, null);
    if (engine.phase === 'halftime') engine.resumeSecondHalf();
    engine.drainEvents();
  }
  return engine.result();
}

export const FIELD = { L, W, GOAL_TOP, GOAL_BOT };
