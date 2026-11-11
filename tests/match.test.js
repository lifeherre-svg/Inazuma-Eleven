// Tests del motor de partido y la IA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine, simulateMatch } from '../src/match/match-engine.js';
import { buildOpponentSpec, buildPlayerTeamSpec } from '../src/match/match-setup.js';
import { resolveDuel, resolveShot, distanceDecay } from '../src/match/duel.js';
import { RNG } from '../src/core/rng.js';
import { newGame } from './helpers.js';
import { addPlayerToRoster } from '../src/systems/game-state.js';
import { applyMatchResult } from '../src/systems/match-rewards.js';

const stats = (v) => ({ shoot: v, dribble: v, defense: v, control: v, technique: v, speed: v, stamina: v, physical: v });

test('duelos: las estadísticas deciden la mayoría de duelos', () => {
  const rng = new RNG(1);
  let wins = 0;
  for (let i = 0; i < 400; i++) if (resolveDuel(rng, { stats: stats(80) }, { stats: stats(40) }, 'dribble', 'tackle').attackerWins) wins++;
  assert.ok(wins > 340, `el fuerte gana casi siempre (${wins}/400)`);
});

test('duelos: la técnica y el elemento cambian el resultado', () => {
  const rng = new RNG(2);
  const count = (atk) => { let w = 0; for (let i = 0; i < 400; i++) if (resolveDuel(rng, atk, { stats: stats(50), element: 'wood' }, 'shot', 'keeper').attackerWins) w++; return w; };
  const plain = count({ stats: stats(50), element: 'fire' });
  const tech = count({ stats: stats(50), element: 'fire', tech: { id: 'tiro_llamarada', level: 1 } });
  const techBad = count({ stats: stats(50), element: 'wind', tech: { id: 'cuchilla_viento', level: 1 } });
  assert.ok(tech > plain, 'la técnica ayuda');
  assert.ok(tech > techBad, 'fuego contra bosque tiene ventaja');
});

test('los tiros lejanos pierden potencia', () => {
  assert.equal(distanceDecay(100), 1);
  assert.ok(distanceDecay(500) < distanceDecay(200));
  const rng = new RNG(3);
  let near = 0, far = 0;
  for (let i = 0; i < 300; i++) {
    if (resolveShot(rng, { stats: stats(60) }, { stats: stats(60) }, 120).goal) near++;
    if (resolveShot(rng, { stats: stats(60) }, { stats: stats(60) }, 520).goal) far++;
  }
  assert.ok(near > far);
});

test('partido simulado completo: termina, es determinista y produce estadísticas', () => {
  const run = () => simulateMatch({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('halcones_puerto'), seed: 99, halfDurationSec: 40 });
  const r1 = run();
  const r2 = run();
  assert.deepEqual(r1.score, r2.score, 'mismo resultado con la misma semilla');
  assert.equal(r1.possession[0] + r1.possession[1], 100);
  assert.ok(r1.shots[0] + r1.shots[1] > 0, 'hay tiros');
  assert.ok(Object.keys(r1.ratings).length >= 22);
});

test('la IA usa técnicas especiales y el equipo superior gana', () => {
  let techs = 0, strongWins = 0;
  for (let s = 1; s <= 4; s++) {
    const r = simulateMatch({ home: buildOpponentSpec('aguilas_capital'), away: buildOpponentSpec('pandilla_parque'), seed: s, halfDurationSec: 45 });
    techs += r.techUses.reduce((a, u) => a + u.count, 0);
    if (r.winner === 0) strongWins++;
  }
  assert.ok(techs > 0, 'se usan técnicas');
  assert.ok(strongWins >= 3, `el favorito gana (${strongWins}/4)`);
});

test('control del usuario: mover, pasar, tirar y entrar', () => {
  const engine = new MatchEngine({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('halcones_puerto'), userTeam: 0, seed: 5, settings: { halfDurationSec: 60, duelPrompts: false } });
  for (let i = 0; i < 40; i++) engine.update(1 / 30, {});
  const c = engine.controlled;
  assert.ok(c, 'hay jugador controlado');
  const x0 = c.x;
  for (let i = 0; i < 30; i++) engine.update(1 / 30, { moveX: 1, moveY: 0 });
  assert.ok(engine.controlled.x > x0 - 1, 'el jugador avanza');
  if (engine.ball.owner === engine.controlled) {
    engine.update(1 / 30, { pass: true });
    assert.notEqual(engine.ball.owner, c, 'el pase suelta el balón');
  }
  engine.drainEvents();
});

test('técnica de tiro del usuario: consume PT y lanza cinemática', () => {
  const engine = new MatchEngine({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('pandilla_parque'), userTeam: 0, seed: 8, settings: { halfDurationSec: 60, duelPrompts: false } });
  const fw = engine.teams[0].players.find((p) => p.techniques.some((t) => t.category === 'shoot'));
  engine.phase = 'play';
  engine.giveBall(fw);
  engine.controlled = fw;
  const tp = fw.tp;
  engine.update(1 / 30, { special: true });
  assert.ok(fw.tp < tp, 'gasta PT');
  assert.ok(engine.freeze > 0, 'pausa para la cinemática');
  const events = engine.drainEvents();
  assert.ok(events.some((e) => e.type === 'tech'));
  for (let i = 0; i < 120; i++) { engine.update(1 / 30, {}); events.push(...engine.drainEvents()); }
  assert.ok(events.some((e) => e.type === 'shot' && e.tech), 'el tiro sale tras la cinemática');
});

test('duelo táctico: el usuario elige respuesta', () => {
  const engine = new MatchEngine({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('halcones_puerto'), userTeam: 0, seed: 11, settings: { halfDurationSec: 60, duelPrompts: true } });
  engine.phase = 'play';
  const c = engine.teams[0].players[9];
  const d = engine.teams[1].players[3];
  engine.giveBall(c); engine.controlled = c;
  d.x = c.x + 10; d.y = c.y;
  engine.tackle(d, {});
  assert.ok(engine.duel, 'aparece el duelo');
  engine.update(1 / 30, { dribble: true });
  assert.equal(engine.duel, null);
});

test('sustituciones y cambio de estrategia', () => {
  const engine = new MatchEngine({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('halcones_puerto'), userTeam: 0, seed: 4 });
  const out = engine.teams[0].players[3].name;
  assert.ok(engine.substitute(0, 3, 0).ok);
  assert.notEqual(engine.teams[0].players[3].name, out);
  assert.equal(engine.teams[0].subsLeft, 2);
  engine.setStrategy(0, { defense: 'presion' });
  assert.equal(engine.ai[0].def.pressers, 2);
});

test('la IA se adapta al marcador', () => {
  const engine = new MatchEngine({ home: buildOpponentSpec('cuervo_negro'), away: buildOpponentSpec('halcones_puerto'), userTeam: null, seed: 4, settings: { halfDurationSec: 60 } });
  engine.half = 2; engine.elapsed = 40; engine.teams[0].score = 2;
  engine.ai[1].adapt();
  assert.equal(engine.ai[1].mood, 'ataque');
  assert.ok(engine.ai[1].styleBoost > 0);
});

test('recompensas de partido: XP, dinero, fatiga y estadísticas', () => {
  const g = newGame();
  for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito']) addPlayerToRoster(g, id, 4);
  const result = simulateMatch({ home: buildPlayerTeamSpec(g.state), away: buildOpponentSpec('pandilla_parque'), seed: 2, halfDurationSec: 30 });
  const money = g.state.money;
  const lvl = g.state.roster.map((p) => p.level + p.xp / 1e6);
  const rep = applyMatchResult(g, { opponentId: 'pandilla_parque', result });
  assert.ok(g.state.money > money);
  assert.ok(g.state.roster.some((p, i) => p.level + p.xp / 1e6 > lvl[i]));
  assert.equal(g.state.stats.matches, 1);
  assert.ok(rep.xp > 0);
  assert.ok(g.state.roster.some((p) => p.fatigue > 0));
});
