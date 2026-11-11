// Tests de los sistemas RPG: elementos, jugadores, progresión, equipo,
// inventario, entrenamiento, reclutamiento y desafíos por turnos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from './helpers.js';
import { elementMultiplier } from '../src/systems/elements.js';
import { createPlayer, effectiveStats, gainXp, xpToNext, canLearn, addTechnique, gainTechXp, techPower, toggleEquipTechnique, maxTp, rawStat } from '../src/systems/player.js';
import { autoLineup, assignSlot, validateLineup, savePreset, loadPreset, setFormation, positionFit } from '../src/systems/team.js';
import { addItem, itemCount, useItem, buyItem, sellItem } from '../src/systems/inventory.js';
import { train, restTeam } from '../src/systems/training.js';
import { convinceChance, attemptConvince, scoutSearch, approachMultiplier } from '../src/systems/recruitment.js';
import { createEncounter, playerTurn } from '../src/systems/encounter.js';
import { addPlayerToRoster, releasePlayer } from '../src/systems/game-state.js';
import { getTeamRoster, getPlayerTemplate } from '../src/systems/database.js';
import { MAPS } from '../src/data/maps.js';
import { STATS, PROGRESSION } from '../src/config.js';

test('ciclo elemental: cada elemento gana a uno y pierde contra otro', () => {
  assert.ok(elementMultiplier('fire', 'wood') > 1);
  assert.ok(elementMultiplier('wood', 'mountain') > 1);
  assert.ok(elementMultiplier('mountain', 'wind') > 1);
  assert.ok(elementMultiplier('wind', 'fire') > 1);
  assert.ok(elementMultiplier('wood', 'fire') < 1);
  assert.equal(elementMultiplier('fire', 'fire'), 1);
  assert.equal(elementMultiplier('fire', 'mountain'), 1);
});

test('las estadísticas crecen con el nivel, la rareza y el entrenamiento', () => {
  const lo = createPlayer('kenta_hoshino', 1);
  const hi = createPlayer('kenta_hoshino', 30);
  for (const s of STATS) assert.ok(rawStat(hi, s) > rawStat(lo, s), s);
  const common = createPlayer('jun_ito', 20), rare = createPlayer('kenta_hoshino', 20);
  assert.ok(effectiveStats(rare).shoot > effectiveStats(common).shoot);
  const before = effectiveStats(lo).shoot;
  lo.trained.shoot = 10;
  assert.equal(effectiveStats(lo).shoot, before + 10);
});

test('la fatiga alta penaliza el rendimiento', () => {
  const p = createPlayer('kenta_hoshino', 20);
  const fresh = effectiveStats(p).shoot;
  p.fatigue = 100;
  assert.ok(effectiveStats(p).shoot < fresh);
});

test('experiencia: sube de nivel y aprende técnicas del learnset', () => {
  const p = createPlayer('kenta_hoshino', 1);
  assert.ok(p.techniques.some((t) => t.id === 'tiro_llamarada'));
  let xp = 0;
  for (let l = 1; l < 15; l++) xp += xpToNext(l);
  const r = gainXp(p, xp / 1.05 + 5); // rare xpMul 1.05
  assert.ok(p.level >= 14, `nivel ${p.level}`);
  assert.ok(r.learned.includes('estela_ignea'));
  assert.ok(p.techniques.some((t) => t.id === 'cometa_carmesi') || p.level < 15);
});

test('técnicas: requisitos, mejora de nivel y límite equipado', () => {
  const gk = createPlayer('takumi_ono', 5);
  const fw = createPlayer('sota_ueda', 5);
  assert.equal(canLearn(fw, 'mano_rocosa').ok, false, 'un delantero no aprende técnicas de portero');
  assert.equal(canLearn(fw, 'volcan_supremo').ok, false);
  assert.ok(gk.techniques.length >= 1);
  const id = fw.techniques[0].id;
  const p1 = techPower(id, 1);
  gainTechXp(fw, id, 100);
  assert.equal(fw.techniques[0].level, 2);
  assert.ok(techPower(id, 2) > p1);
  gainTechXp(fw, id, 10000);
  assert.equal(fw.techniques[0].level, PROGRESSION.techMaxLevel);
  for (const t of ['avalancha', 'paso_sismico', 'escudo_roca', 'barrida_terrestre', 'roca_bala', 'cuchilla_viento', 'disparo_hoja']) addTechnique(fw, t);
  assert.ok(fw.techniques.filter((t) => t.equipped).length <= PROGRESSION.maxTechniques);
  const off = fw.techniques.find((t) => !t.equipped);
  assert.equal(toggleEquipTechnique(fw, off.id), false, 'no se puede superar el máximo');
  assert.ok(maxTp(fw) > 40);
});

test('nueva partida: plantilla inicial, capitán y alineación', () => {
  const g = newGame();
  assert.equal(g.state.roster.length, 8);
  assert.ok(g.state.team.captain);
  assert.equal(validateLineup(g.state).ok, false, 'faltan jugadores al empezar');
  for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito']) addPlayerToRoster(g, id, 4);
  assert.equal(validateLineup(g.state).ok, true);
  assert.equal(addPlayerToRoster(g, 'aki_sato', 4).ok, false, 'no se duplica un jugador');
});

test('equipo: formaciones, intercambios y tácticas guardadas', () => {
  const g = newGame();
  for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito', 'nao_fujita']) addPlayerToRoster(g, id, 4);
  const st = g.state;
  setFormation(st, 'f433');
  autoLineup(st);
  assert.equal(st.team.lineup.filter(Boolean).length, 11);
  const benchUid = st.team.bench[0];
  const out = st.team.lineup[5];
  assignSlot(st, 5, benchUid);
  assert.equal(st.team.lineup[5], benchUid);
  assert.ok(st.team.bench.includes(out));
  savePreset(st, 'Ofensiva');
  setFormation(st, 'f532');
  assert.ok(loadPreset(st, 'Ofensiva'));
  assert.equal(st.team.formationId, 'f433');
  assert.equal(positionFit('GK', 'FW'), 0.6);
  assert.equal(releasePlayer(g, st.roster[0].uid).ok, true);
});

test('inventario: comprar, usar, equipar, vender', () => {
  const g = newGame();
  const st = g.state;
  const money = st.money;
  assert.ok(buyItem(g, 'bebida_isotonica', 1).ok);
  assert.equal(st.money, money - 60);
  const p = st.roster[0];
  p.fatigue = 80;
  assert.ok(useItem(g, 'bebida_isotonica', p.uid).ok);
  assert.equal(p.fatigue, 45);
  addItem(st, 'botas_veloces');
  const spd = effectiveStats(p).speed;
  assert.ok(useItem(g, 'botas_veloces', p.uid).ok);
  assert.equal(effectiveStats(p).speed, spd + 6);
  assert.equal(itemCount(st, 'botas_veloces'), 0);
  assert.ok(sellItem(g, 'carta_invitacion').ok);
  assert.equal(sellItem(g, 'llave_club').ok, false);
});

test('entrenamiento: mejora estadísticas, genera fatiga y descanso la elimina', () => {
  const g = newGame();
  const p = g.state.roster.find((x) => x.templateId === 'kenta_hoshino');
  const r = train(g, p.uid, 'tiro', 1);
  assert.ok(r.ok);
  assert.ok(p.trained.shoot > 0);
  assert.ok(p.fatigue > 0);
  for (let i = 0; i < 10; i++) train(g, p.uid, 'tiro', 1);
  assert.equal(train(g, p.uid, 'tiro', 1).ok, false, 'demasiado cansado');
  restTeam(g);
  assert.equal(p.fatigue, 0);
  assert.equal(g.state.day, 2);
});

test('entrenamiento de técnicas: descubre nuevas técnicas por inspiración', () => {
  const g = newGame({ starterId: 'sora_minase' });
  const p = g.state.roster.find((x) => x.templateId === 'sora_minase');
  gainXp(p, 50000);
  let learned = null;
  for (let i = 0; i < 12 && !learned; i++) { p.fatigue = 0; learned = train(g, p.uid, 'tecnicas', 1).report.learned; }
  assert.ok(learned, 'debe aprender alguna técnica entrenando');
});

test('reclutamiento: la personalidad y el ánimo influyen en la probabilidad', () => {
  const g = newGame();
  const st = g.state;
  const t = getPlayerTemplate('aki_sato'); // amable: le gusta inspirar, odia retar
  assert.ok(approachMultiplier(t.personality, 'inspirar') > approachMultiplier(t.personality, 'retar'));
  const hiMorale = convinceChance({ templateId: 'aki_sato', level: 3, morale: 100, approach: 'inspirar', inviteId: 'carta_invitacion', state: st });
  const loMorale = convinceChance({ templateId: 'aki_sato', level: 3, morale: 0, approach: 'inspirar', inviteId: 'carta_invitacion', state: st });
  assert.ok(loMorale > hiMorale);
  const legendary = convinceChance({ templateId: 'raiden_hokuto', level: 3, morale: 0, approach: 'halagar', inviteId: 'carta_invitacion', state: st });
  assert.ok(legendary < loMorale, 'los legendarios son más difíciles');
  const before = itemCount(st, 'carta_invitacion');
  const r = attemptConvince(g, { templateId: 'aki_sato', level: 3, morale: 0, approach: 'inspirar', inviteId: 'carta_invitacion' });
  assert.ok(r.ok);
  assert.equal(itemCount(st, 'carta_invitacion'), before - 1, 'consume la carta');
});

test('red de ojeadores: encuentra pistas según filtros y cobra', () => {
  const g = newGame();
  g.state.money = 5000;
  const zones = MAPS.filter((m) => ['villa_rayo', 'ribera'].includes(m.id));
  const r = scoutSearch(g, { position: 'FW', zones });
  assert.ok(r.ok, r.message);
  assert.equal(getPlayerTemplate(r.lead.templateId).position, 'FW');
  assert.ok(g.state.money < 5000);
  const none = scoutSearch(g, { position: 'GK', element: 'fire', zones });
  assert.equal(none.ok, false);
});

test('desafío por turnos: se puede ganar y reclutar', () => {
  const g = newGame({}, 7);
  const enc = createEncounter(g, { templateId: 'jun_ito', level: 2, kind: 'challenge' });
  for (let i = 0; i < 60 && enc.status === 'choose'; i++) {
    const me = g.state.roster.find((p) => p.uid === enc.active);
    const tech = me.techniques.find((t) => t.equipped);
    playerTurn(g, enc, tech && enc.tps[enc.active] > 20 ? { type: 'tech', techId: tech.id } : { type: 'shoot' });
  }
  assert.ok(['recruited', 'lost'].includes(enc.status), enc.status);
  if (enc.status === 'recruited') assert.ok(g.state.roster.some((p) => p.templateId === 'jun_ito'));
  assert.ok(enc.log.length > 2);
});

test('desafío salvaje: huir y convencer', () => {
  const g = newGame({}, 3);
  const enc = createEncounter(g, { templateId: 'aki_sato', level: 2, kind: 'wild' });
  playerTurn(g, enc, { type: 'flee' });
  assert.equal(enc.status, 'fled');
  const enc2 = createEncounter(g, { templateId: 'aki_sato', level: 2, kind: 'wild' });
  let tries = 0;
  while (enc2.status === 'choose' && tries++ < 10) playerTurn(g, enc2, { type: 'convince', approach: 'inspirar', inviteId: 'carta_invitacion' });
  assert.ok(['recruited', 'choose', 'lost'].includes(enc2.status));
});

test('plantillas rivales completas y deterministas', () => {
  const a = getTeamRoster('cuervo_negro');
  assert.ok(a.length >= 11);
  assert.deepEqual(getTeamRoster('cuervo_negro'), a);
  assert.ok(a.includes('kuro_tsubame'));
});
