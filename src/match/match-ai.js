// IA de equipo. Controla a todos los jugadores de un equipo excepto al que
// maneja el usuario. Comportamientos:
//  - Portador: decide entre tirar, pasar o regatear (con técnicas especiales).
//  - Apoyo ofensivo: desmarques, amplitud y desmarques de ruptura.
//  - Defensa: presión al portador (N presionadores según estrategia),
//    repliegue en bloque, marcaje individual y entradas.
//  - Portero: colocación, salidas y saques.
//  - Director adaptativo: cambia el comportamiento según el marcador y
//    según el estilo de juego del rival (bandas preferidas, abuso del regate).

import { MATCH } from '../config.js';
import { getTechnique } from '../systems/database.js';
import { OFFENSE_STRATEGIES, DEFENSE_STRATEGIES, PLAY_STYLES } from '../data/formations.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export class TeamAI {
  constructor(engine, side) {
    this.e = engine;
    this.side = side;
    this.thinkTimer = 0;
    this.holdTimer = 0;
    this.adaptTimer = 15;
    this.mood = 'normal';
    this.laneBias = 0;
    this.extraPressers = 0;
    this.styleBoost = 0;
    this.techBoost = 0;
    this.observed = { lanes: [0, 0, 0], dribbles: 0, passes: 0, shots: 0 };
    this.reaction = new Map();
    this.refreshParams();
  }

  get team() { return this.e.teams[this.side]; }
  get isUserTeam() { return this.e.userTeam === this.side; }

  refreshParams() {
    const s = this.team.spec.strategy;
    this.off = { passBias: 0, shootRangeMul: 1, tempo: 1, forwardRun: 1, width: 1, ...(OFFENSE_STRATEGIES[s.offense]?.params || {}) };
    this.def = { lineHeight: 0, pressers: 1, compact: 1, marking: false, ...(DEFENSE_STRATEGIES[s.defense]?.params || {}) };
    this.styleShift = PLAY_STYLES[s.style]?.shift || 0;
  }

  techChance() {
    const base = this.isUserTeam ? 0.6 : this.e.userTeam === null ? 0.55 : this.e.diff.aiTechChance;
    return clamp(base + this.techBoost, 0, 0.95);
  }

  reactionTime() {
    return this.isUserTeam ? 0.25 : this.e.userTeam === null ? 0.22 : this.e.diff.aiReaction;
  }

  // ------------------------------------------------------------------ técnicas

  /**
   * Elige la técnica de una categoría que el jugador puede pagar.
   * opts.any: el usuario la pide explícitamente (sin tirada de probabilidad).
   */
  pickTech(p, category, opts = {}) {
    const usable = p.techniques
      .filter((t) => t.category === category && p.tp >= getTechnique(t.id).tp)
      .sort((a, b) => getTechnique(b.id).power * (1 + 0.12 * (b.level - 1)) - getTechnique(a.id).power * (1 + 0.12 * (a.level - 1)));
    if (!usable.length) return null;
    if (opts.any) return { id: usable[0].id, level: usable[0].level };
    let chance = this.techChance();
    if (category === 'keeper') chance = opts.forShot?.tech ? 0.92 : 0.4;
    if (category === 'block') chance *= 0.6;
    if (category === 'dribble' && opts.duel) chance *= 0.8;
    if (!this.e.rng.chance(chance)) return null;
    // A veces guarda energía usando una técnica más barata.
    const pick = usable.length > 1 && this.e.rng.chance(0.3) ? usable[usable.length - 1] : usable[0];
    return { id: pick.id, level: pick.level };
  }

  findCombo(p) {
    for (const t of p.techniques) {
      if (t.category !== 'combo') continue;
      const tech = getTechnique(t.id);
      const cost = Math.round(tech.tp * 0.6);
      if (p.tp < cost) continue;
      const partners = this.team.players
        .filter((q) => q !== p && q.role !== 'GK' && q.stun <= 0 && q.tp >= cost && q.techniques.some((x) => x.id === t.id) && dist(q, p) < 300)
        .sort((a, b) => dist(a, p) - dist(b, p));
      if (partners.length >= tech.combo.participants - 1) {
        return { tech: { id: t.id, level: t.level }, partners: partners.slice(0, tech.combo.participants - 1) };
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ pases

  bestPassTarget(p, dirOpt = null) {
    const e = this.e;
    const dir = this.team.dir;
    const opp = e.opponents(this.side);
    let best = null, bestScore = -Infinity;
    for (const q of this.team.players) {
      if (q === p || q.stun > 0) continue;
      const d = dist(p, q);
      if (d < 40) continue;
      let score = 0;
      score += clamp(((q.x - p.x) * dir) / 300, -0.6, 1) * (0.6 + 0.4 * this.off.forwardRun);
      const open = Math.min(...opp.map((o) => dist(o, q)));
      score += clamp(open / 100, 0, 1.2);
      const blocked = opp.some((o) => distToSegment(o, p, q) < 20 && dist(o, p) > 15);
      if (blocked) score -= 0.9;
      if (d > 450) score -= 0.7;
      if (q.role === 'GK') score -= 1.2;
      score += this.off.passBias * (d < 200 ? 1 : -1);
      if (dirOpt) {
        const m = Math.hypot(dirOpt.dirX, dirOpt.dirY) || 1;
        const cos = ((q.x - p.x) * dirOpt.dirX + (q.y - p.y) * dirOpt.dirY) / (d * m);
        score += cos * 2.2;
        if (cos < 0.2) score -= 2;
      }
      if (score > bestScore) { bestScore = score; best = q; }
    }
    if (best) best._passScore = bestScore;
    return best;
  }

  // ------------------------------------------------------------------ posicionamiento

  /** Posición táctica de un jugador sin balón (bloque, amplitud, estrategia). */
  tacticalPosition(p, attacking) {
    const e = this.e;
    const b = e.ball;
    const L = MATCH.fieldW, W = MATCH.fieldH;
    const b01 = this.side === 0 ? b.x / L : 1 - b.x / L;
    let fx = p.slot.x + (b01 - 0.45) * 0.45 + this.styleShift + this.styleBoost;
    if (attacking) fx += 0.1 * this.off.forwardRun;
    else fx += this.def.lineHeight * 0.5 - 0.04;
    if (p.role === 'FW' && attacking) fx = Math.max(fx, Math.min(0.86, b01 + 0.1 * this.off.forwardRun));
    if (p.role === 'DF' && !attacking) fx = Math.min(fx, b01 - 0.02);
    fx = clamp(fx, 0.07, 0.9);
    let fy = p.slot.y;
    const width = attacking ? this.off.width : 1 / this.def.compact;
    fy = 0.5 + (fy - 0.5) * width;
    let x = this.side === 0 ? fx * L : (1 - fx) * L;
    let y = (this.side === 0 ? fy : 1 - fy) * W;
    y += (b.y - W / 2) * (attacking ? 0.15 : 0.3);
    if (!attacking) y += this.laneBias * W * 0.1;
    return { x: clamp(x, 15, L - 15), y: clamp(y, 15, W - 15) };
  }

  // ------------------------------------------------------------------ bucle

  update(dt) {
    const e = this.e;
    this.thinkTimer -= dt;
    this.holdTimer = Math.max(0, this.holdTimer - dt);
    const think = this.thinkTimer <= 0;
    if (think) this.thinkTimer = MATCH.aiThinkInterval / this.off.tempo;
    this.adaptTimer -= dt;
    if (this.adaptTimer <= 0) { this.adapt(); this.adaptTimer = 15; }
    this.observeOpponent();

    const b = e.ball;
    const poss = e.possessionTeam();
    const players = this.team.players;
    const userControlled = e.userTeam === this.side ? e.controlled : null;

    // Presionadores: los más cercanos al balón.
    const ref = b.owner || { x: b.x + b.vx * 0.3, y: b.y + b.vy * 0.3 };
    const byDist = players.filter((p) => p.role !== 'GK' && p !== userControlled).sort((a, c) => dist(a, ref) - dist(c, ref));
    const nPress = clamp(this.def.pressers + this.extraPressers, 1, 3);
    const pressers = new Set(byDist.slice(0, poss === null ? 1 : nPress));
    if (poss === null && b.kind === 'pass' && b.passTarget?.team === this.side) pressers.add(b.passTarget);

    for (const p of players) {
      if (p === userControlled) continue;
      p.wantSprint = false;
      if (p.role === 'GK') { this.keeperBehaviour(p, dt, think); continue; }
      if (b.owner === p) { this.carrierBehaviour(p, think); continue; }
      if (poss === this.side) this.supportBehaviour(p);
      else if (poss === null) {
        if (pressers.has(p)) { p.target = { x: ref.x, y: ref.y }; p.wantSprint = dist(p, ref) > 60; }
        else p.target = this.tacticalPosition(p, false);
      } else this.defendBehaviour(p, pressers.has(p), dt);
    }
  }

  carrierBehaviour(p, think) {
    const e = this.e;
    const goal = e.goalOf(this.side);
    const dGoal = dist(p, goal);
    const opp = e.opponents(this.side);
    const nearest = opp.reduce((m, o) => (dist(o, p) < m.d ? { o, d: dist(o, p) } : m), { o: null, d: Infinity });

    // Avance con esquiva.
    const dir = this.team.dir;
    let tx = p.x + dir * 90, ty = p.y + (goal.y - p.y) * 0.25;
    for (const o of opp) {
      const ahead = (o.x - p.x) * dir;
      const d = dist(o, p);
      if (ahead > -10 && d < 110) {
        const side = o.y > p.y ? -1 : 1;
        ty += side * (110 - d) * 0.9;
      }
    }
    if (p.y < 60) ty += 40;
    if (p.y > MATCH.fieldH - 60) ty -= 40;
    p.target = { x: clamp(tx, 10, MATCH.fieldW - 10), y: clamp(ty, 20, MATCH.fieldH - 20) };
    p.wantSprint = nearest.d > 80 && p.stamina > 40;

    if (p.role === 'GK') {
      p.target = { x: p.x, y: p.y };
      if (this.holdTimer <= 0 && think) {
        const t = this.bestPassTarget(p);
        if (t) e.pass(p, t);
      }
      return;
    }
    if (!think || p.kickCd > 0) return;

    // Planear un regate especial si el rival se echa encima.
    if (nearest.d < 50 && !p.plannedDribbleTech && this.e.rng.chance(0.5)) {
      p.plannedDribbleTech = this.pickTech(p, 'dribble', { duel: true });
    }

    const shootRange = MATCH.shootRange * this.off.shootRangeMul;
    const angleOk = Math.abs(p.y - goal.y) < 260;
    if (dGoal < shootRange && angleOk) {
      let prob = 0.12 + (1 - dGoal / shootRange) * 0.55;
      if (nearest.d < 45) prob += 0.15;
      if (dGoal < 170) prob += 0.3;
      if (e.rng.chance(prob)) {
        const combo = e.rng.chance(this.techChance()) ? this.findCombo(p) : null;
        if (combo) { e.shoot(p, { tech: combo.tech, partners: combo.partners, aimY: e.rng.float(-1, 1) }); return; }
        const tech = this.pickTech(p, 'shoot', {});
        e.shoot(p, { tech, aimY: e.rng.float(-1, 1) });
        return;
      }
    }

    const pressured = nearest.d < 55;
    const t = this.bestPassTarget(p);
    if (t) {
      const passProb = pressured ? 0.55 + this.off.passBias : 0.12 + this.off.passBias * 0.5;
      if (t._passScore > 0.7 && e.rng.chance(clamp(passProb, 0.05, 0.9))) {
        e.pass(p, t);
      }
    }
  }

  supportBehaviour(p) {
    const e = this.e;
    const b = e.ball;
    if (b.kind === 'pass' && b.passTarget === p) {
      p.target = { x: b.x + b.vx * 0.25, y: b.y + b.vy * 0.25 };
      p.wantSprint = true;
      return;
    }
    const pos = this.tacticalPosition(p, true);
    const carrier = b.owner;
    if (carrier && dist(pos, carrier) < 80) {
      const ang = Math.atan2(pos.y - carrier.y, pos.x - carrier.x);
      pos.x = carrier.x + Math.cos(ang) * 100;
      pos.y = carrier.y + Math.sin(ang) * 100;
    }
    p.target = { x: clamp(pos.x, 15, MATCH.fieldW - 15), y: clamp(pos.y, 15, MATCH.fieldH - 15) };
    p.wantSprint = p.role === 'FW' && dist(p, pos) > 120;
  }

  defendBehaviour(p, isPresser, dt) {
    const e = this.e;
    const carrier = e.ball.owner;
    if (isPresser && carrier) {
      const own = e.ownGoal(this.side);
      // Ponerse entre el portador y la portería propia.
      const ang = Math.atan2(own.y - carrier.y, own.x - carrier.x);
      const d = dist(p, carrier);
      const goalSide = d > 40 ? 18 : 0;
      p.target = { x: carrier.x + Math.cos(ang) * goalSide + carrier.vx * 0.2, y: carrier.y + Math.sin(ang) * goalSide + carrier.vy * 0.2 };
      p.wantSprint = d > 50;
      if (d < MATCH.tackleRange && p.tackleCd <= 0 && p.stun <= 0) {
        const r = (this.reaction.get(p) || 0) + dt;
        this.reaction.set(p, r);
        if (r >= this.reactionTime()) {
          this.reaction.set(p, 0);
          const defTech = this.pickTech(p, 'defense', {});
          e.tackle(p, { defTech });
        }
      } else this.reaction.set(p, 0);
      return;
    }
    let pos = this.tacticalPosition(p, false);
    if (this.def.marking && (p.role === 'DF' || p.role === 'MF')) {
      const own = e.ownGoal(this.side);
      const threat = e.opponents(this.side)
        .filter((o) => o !== carrier && dist(o, pos) < 160)
        .sort((a, c) => dist(a, pos) - dist(c, pos))[0];
      if (threat) {
        const ang = Math.atan2(own.y - threat.y, own.x - threat.x);
        pos = { x: threat.x + Math.cos(ang) * 28, y: threat.y + Math.sin(ang) * 28 };
      }
    }
    p.target = pos;
  }

  keeperBehaviour(p, dt, think) {
    const e = this.e;
    const b = e.ball;
    if (b.owner === p) { this.carrierBehaviour(p, think); return; }
    const own = e.ownGoal(this.side);
    const dir = this.team.dir;
    const ballDist = dist(b, own);
    const rush = !b.owner && b.kind !== 'shot' && ballDist < 150 && Math.hypot(b.vx, b.vy) < 250;
    if (rush) { p.target = { x: b.x, y: b.y }; p.wantSprint = true; return; }
    const ty = clamp(own.y + (b.y - own.y) * 0.35, own.y - MATCH.goalWidth / 2 + 8, own.y + MATCH.goalWidth / 2 - 8);
    const tx = own.x + dir * (16 + clamp((MATCH.fieldW - ballDist) / 30, 0, 30));
    p.target = { x: tx, y: ty };
    // Contra tiros: desplazarse hacia la trayectoria.
    if (b.kind === 'shot' && b.shot?.team !== this.side && Math.abs(b.vx) > 1) {
      const tHit = (own.x + dir * 14 - b.x) / b.vx;
      if (tHit > 0 && tHit < 1.5) {
        const yHit = b.y + b.vy * tHit;
        p.target = { x: tx, y: clamp(yHit, own.y - MATCH.goalWidth / 2 - 10, own.y + MATCH.goalWidth / 2 + 10) };
        p.wantSprint = true;
      }
    }
  }

  // ------------------------------------------------------------------ adaptación

  observeOpponent() {
    const owner = this.e.ball.owner;
    if (!owner || owner.team === this.side) return;
    // Solo observar cuando el rival está en nuestra mitad.
    const inOurHalf = this.side === 0 ? owner.x < MATCH.fieldW / 2 : owner.x > MATCH.fieldW / 2;
    if (!inOurHalf) return;
    const lane = owner.y < MATCH.fieldH / 3 ? 0 : owner.y > (2 * MATCH.fieldH) / 3 ? 2 : 1;
    this.observed.lanes[lane] += 1;
  }

  onDuel(carrierWon) {
    // Llamado sobre el equipo del portador: el rival registra el abuso del regate.
    const rival = this.e.ai[1 - this.side];
    if (carrierWon) rival.observed.dribbles++;
  }

  onConcede() {
    this.techBoost = Math.min(0.2, this.techBoost + 0.05);
  }

  adapt() {
    const e = this.e;
    const minute = e.clockMinutes();
    const diff = this.team.score - e.teams[1 - this.side].score;
    let mood = 'normal';
    this.styleBoost = 0;
    this.extraPressers = 0;
    if (diff < 0 && minute >= 55) { mood = 'ataque'; this.styleBoost = 0.1; this.extraPressers = 1; this.techBoost = Math.min(0.3, this.techBoost + 0.1); }
    else if (diff > 0 && minute >= 65) { mood = 'defensa'; this.styleBoost = -0.08; }
    // Estilo del rival: banda preferida.
    const [l0, l1, l2] = this.observed.lanes;
    const total = l0 + l1 + l2;
    if (total > 60) {
      const bias = (l2 - l0) / total;
      // Las posiciones del equipo 1 están espejadas en y.
      this.laneBias = clamp(bias * 1.5, -0.6, 0.6);
    }
    if (this.observed.dribbles >= 3) { this.extraPressers += 1; this.observed.dribbles = 0; if (mood === 'normal') mood = 'presion'; }
    if (mood !== this.mood) {
      this.mood = mood;
      const msgs = { ataque: 'se vuelca al ataque', defensa: 'se encierra atrás', presion: 'adelanta la presión', normal: 'recupera su plan inicial' };
      e.emit('aiAdapt', { team: this.side, mood, text: `${this.team.spec.name} ${msgs[mood]}` });
    }
    this.observed.lanes = [l0 * 0.5, l1 * 0.5, l2 * 0.5];
  }
}
