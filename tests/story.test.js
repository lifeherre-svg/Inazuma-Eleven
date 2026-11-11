// Tests de historia, misiones, torneos, guiones y mundo. Incluye una
// "partida automática" que recorre la campaña completa con los guiones reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, mockHost } from './helpers.js';
import { runScript, evalCond } from '../src/systems/script.js';
import { MAP_SPECS } from '../src/data/maps.js';
import { addPlayerToRoster, setFlag } from '../src/systems/game-state.js';
import { applyMatchResult } from '../src/systems/match-rewards.js';
import { enterTournament, recordTournamentMatch, canEnter, nextOpponent } from '../src/systems/tournaments.js';
import { currentChapter, syncChapter } from '../src/systems/story.js';
import { isQuestDone, startQuest, isQuestActive } from '../src/systems/quests.js';
import { World } from '../src/world/world.js';
import { EVT } from '../src/core/events.js';
import { itemCount } from '../src/systems/inventory.js';

const npc = (map, id) => MAP_SPECS[map].npcs.find((n) => n.id === id);
const fakeWin = (g, team) => applyMatchResult(g, { opponentId: team, result: { winner: 0, score: [2, 0], goals: [], ratings: {}, techUses: [] } });

test('condiciones de guion', () => {
  const g = newGame();
  assert.ok(evalCond(g.state, { item: { id: 'carta_invitacion', count: 5 } }));
  assert.ok(!evalCond(g.state, { flag: 'x' }));
  assert.ok(evalCond(g.state, { not: { flag: 'x' } }));
  assert.ok(evalCond(g.state, { any: [{ flag: 'x' }, { roster: 8 }] }));
});

test('las misiones avanzan por eventos y entregan recompensas', () => {
  const g = newGame();
  setFlag(g, 'got_key'); // inicia misiones automáticas
  assert.ok(isQuestActive(g.state, 'sq_entreno'));
  for (let i = 0; i < 5; i++) g.bus.emit(EVT.TRAINED, {});
  assert.ok(isQuestDone(g.state, 'sq_entreno'));
  assert.ok(itemCount(g.state, 'munequera_fuerza') >= 1);
});

test('torneo: rondas, eliminación y campeonato', () => {
  const g = newGame();
  for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito']) addPlayerToRoster(g, id, 4);
  assert.equal(canEnter(g.state, 't_distrito').ok, false, 'bloqueado al principio');
  setFlag(g, 'ch1_done');
  assert.ok(enterTournament(g, 't_distrito').ok);
  assert.equal(recordTournamentMatch(g, 't_distrito', true).status, 'advance');
  assert.equal(recordTournamentMatch(g, 't_distrito', false).status, 'eliminated');
  assert.equal(nextOpponent(g.state, 't_distrito').roundIndex, 0, 'vuelve a empezar');
  enterTournament(g, 't_distrito');
  recordTournamentMatch(g, 't_distrito', true);
  recordTournamentMatch(g, 't_distrito', true);
  const r = recordTournamentMatch(g, 't_distrito', true);
  assert.equal(r.status, 'champion');
  assert.ok(g.state.flags.ch2_done);
  assert.ok(itemCount(g.state, 'pase_bosque') === 1);
});

test('mundo: colisiones, NPC, objetos y transiciones', () => {
  const g = newGame();
  const w = new World(g);
  assert.equal(w.map.id, 'villa_rayo');
  w.load('villa_rayo', 4, 13, 'up');
  // Arriba está la puerta de casa (sólida): no se mueve.
  for (let i = 0; i < 10; i++) w.update(0.05, { dir: 'up' });
  assert.equal(w.player.y, 13);
  // Moverse a la derecha por el camino
  for (let i = 0; i < 20; i++) w.update(0.05, { dir: 'right' });
  assert.ok(w.player.x > 4);
  // Salida al este -> Ribera
  w.load('villa_rayo', 38, 14, 'right');
  let ev = null;
  for (let i = 0; i < 5 && !ev; i++) ev = w.update(0.05, { dir: 'right' });
  assert.equal(ev?.type, 'warp');
  assert.equal(ev.warp.to, 'ribera');
  // Salida norte bloqueada hasta el capítulo 1
  w.load('villa_rayo', 19, 1, 'up');
  ev = null;
  for (let i = 0; i < 5 && !ev; i++) ev = w.update(0.05, { dir: 'up' });
  assert.equal(ev?.type, 'locked');
  // Interacción con Tetsuo
  w.load('villa_rayo', 10, 9, 'up');
  assert.equal(w.interact()?.id, 'tetsuo');
});

test('hierba alta genera encuentros', () => {
  const g = newGame({}, 123);
  const w = new World(g);
  w.load('villa_rayo', 5, 20, 'right');
  w.grace = 0;
  let found = null;
  for (let i = 0; i < 400 && !found; i++) {
    const ev = w.update(0.2, { dir: i % 20 < 10 ? 'right' : 'left' });
    if (ev?.type === 'encounter') found = ev;
  }
  assert.ok(found, 'aparece algún jugador');
  assert.ok(found.level >= 3 && found.level <= 6);
});

test('CAMPAÑA COMPLETA: del prólogo al desafío legendario con los guiones reales', async () => {
  const g = newGame({}, 2024);
  const st = g.state;
  const run = (map, id, opts = {}) => runScript(g, npc(map, id).script, mockHost({ game: g, ...opts }), { npcName: id });
  // Simula el entrenamiento del equipo entre capítulos.
  const levelUp = (lvl) => { for (const p of st.roster) if (p.level < lvl) p.level = lvl; };

  // Prólogo
  assert.equal(currentChapter(st).id, 0);
  await run('villa_rayo', 'tetsuo');
  assert.ok(st.flags.got_key && itemCount(st, 'llave_club') === 1);
  assert.equal(syncChapter(g).chapter.id, 1);

  // Capítulo 1: reunir 11 (Midori por reto + Goro por misión + reclutas)
  await run('ribera', 'midori');
  assert.ok(st.roster.some((p) => p.templateId === 'midori_asahina'));
  assert.ok(isQuestDone(st, 'sq_midori'));
  for (const id of ['aki_sato', 'jun_ito']) addPlayerToRoster(g, id, 4);
  assert.ok(st.flags.team_complete, 'misión "Reúne a once" completada');
  assert.ok(isQuestActive(st, 'mq_halcones'));
  // Halcones: el guion lanza el partido; la victoria la registra applyMatchResult
  const host = mockHost();
  host.match = async (m) => { fakeWin(g, m.team); return { won: true }; };
  await runScript(g, npc('ribera', 'umino').script, host);
  assert.ok(st.flags.halcones_beaten);
  await runScript(g, npc('villa_rayo', 'kuro').script, host);
  assert.ok(st.flags.ch1_done, 'capítulo 1 completado');
  assert.equal(syncChapter(g).chapter.id, 2);

  // Capítulo 2: torneo del distrito
  levelUp(16);
  enterTournament(g, 't_distrito');
  for (let i = 0; i < 3; i++) recordTournamentMatch(g, 't_distrito', true);
  assert.ok(st.flags.ch2_done && itemCount(st, 'pase_bosque') === 1);

  // Capítulo 3: Guardianes del bosque
  await runScript(g, npc('bosque', 'guardian_1').script, host);
  assert.ok(st.flags.ch3_done, 'capítulo 3 completado');
  assert.equal(itemCount(st, 'pase_cumbre'), 1);

  // Capítulo 4: Titanes + Regional
  await runScript(g, npc('cumbre', 'ganseki').script, host);
  assert.ok(st.flags.titanes_beaten);
  enterTournament(g, 't_regional');
  for (let i = 0; i < 2; i++) recordTournamentMatch(g, 't_regional', true);
  assert.ok(st.flags.ch4_done && itemCount(st, 'billete_capital') === 1);

  // Capítulo 5: decisión Zenith (rechazar -> Kaito se une) + Nacional
  const zenith = MAP_SPECS.capital.npcs.find((n) => n.id === 'zenith');
  await runScript(g, zenith.script, mockHost({ choice: 1 }));
  assert.ok(st.flags.zenith_refused && st.flags.zenith_decision);
  assert.ok(st.roster.some((p) => p.templateId === 'kaito_ren'), 'Kaito se une al rechazar a Zenith');
  levelUp(45);
  assert.ok(canEnter(st, 't_nacional').ok, canEnter(st, 't_nacional').reason);
  enterTournament(g, 't_nacional');
  for (let i = 0; i < 3; i++) recordTournamentMatch(g, 't_nacional', true);
  assert.ok(st.flags.ch5_done && itemCount(st, 'billete_isla') === 1);

  // Capítulo 6: Copa internacional + Desafío legendario
  levelUp(55);
  enterTournament(g, 't_internacional');
  for (let i = 0; i < 3; i++) recordTournamentMatch(g, 't_internacional', true);
  assert.ok(st.flags.ch6_cup);
  enterTournament(g, 't_leyenda');
  assert.equal(recordTournamentMatch(g, 't_leyenda', true).status, 'champion');
  assert.ok(st.flags.game_cleared, 'juego completado');
  assert.ok(isQuestDone(st, 'mq_tempestad'));
  assert.equal(currentChapter(st).id, 7, 'epílogo desbloqueado');
  // Postpartida: los míticos aparecen en la isla
  const zero = MAP_SPECS.isla.npcs.find((n) => n.id === 'zero');
  assert.ok(evalCond(st, zero.showIf));
});

test('decisión alternativa: aceptar a Zenith cambia la historia', async () => {
  const g = newGame();
  const zenith = MAP_SPECS.capital.npcs.find((n) => n.id === 'zenith');
  const money = g.state.money;
  await runScript(g, zenith.script, mockHost({ choice: 0 }));
  assert.ok(g.state.flags.zenith_accepted);
  assert.ok(!g.state.roster.some((p) => p.templateId === 'kaito_ren'));
  assert.ok(g.state.money >= money + 5000);
  assert.equal(itemCount(g.state, 'insignia_zenith'), 1);
  startQuest(g, 'mq_zenith');
});
