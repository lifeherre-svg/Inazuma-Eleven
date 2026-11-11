// Tests del sistema de guardado: guardar, cargar, copia de seguridad,
// detección de corrupción, migraciones e importación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, MemoryStorage, migrate, validateState } from '../src/systems/save.js';
import { newGame } from './helpers.js';
import { addPlayerToRoster } from '../src/systems/game-state.js';
import { GAME } from '../src/config.js';

test('guardar y cargar conserva todo el estado', () => {
  const g = newGame();
  addPlayerToRoster(g, 'aki_sato', 5);
  g.state.flags.prueba = true;
  g.state.roster[0].trained.shoot = 7;
  const sm = new SaveManager(new MemoryStorage());
  assert.ok(sm.save('slot1', g.state).ok);
  const r = sm.load('slot1');
  assert.ok(r.ok);
  assert.equal(r.state.roster.length, g.state.roster.length);
  assert.equal(r.state.flags.prueba, true);
  assert.equal(r.state.roster[0].trained.shoot, 7);
  assert.deepEqual(r.state.team.lineup, g.state.team.lineup);
  assert.equal(sm.meta('slot1').players, g.state.roster.length);
});

test('una partida dañada se recupera desde la copia de seguridad', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  const g = newGame();
  sm.save('slot2', g.state);
  g.state.money = 9999;
  sm.save('slot2', g.state);
  // Corromper la ranura principal
  const raw = JSON.parse(storage.getItem('ul_save_slot2'));
  raw.data = raw.data.replace('9999', '1');
  storage.setItem('ul_save_slot2', JSON.stringify(raw));
  const r = sm.load('slot2');
  assert.ok(r.ok);
  assert.ok(r.recovered);
  assert.ok(r.warning);
});

test('ranura vacía o basura devuelve error controlado', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  assert.equal(sm.load('slot3').ok, false);
  storage.setItem('ul_save_slot3', '{no es json');
  assert.equal(sm.load('slot3').ok, false);
  assert.equal(sm.meta('slot3').corrupt, true);
});

test('migración desde versión 0 y reparación de campos', () => {
  const g = newGame();
  const old = JSON.parse(JSON.stringify(g.state));
  old.version = 0;
  delete old.settings;
  delete old.encyclopedia;
  old.roster.push({ uid: 'x', templateId: 'jugador_eliminado', level: 3 });
  const s = validateState(migrate(old));
  assert.equal(s.version, GAME.saveVersion);
  assert.ok(s.settings.musicVolume !== undefined);
  assert.ok(!s.roster.some((p) => p.templateId === 'jugador_eliminado'), 'elimina jugadores inexistentes');
});

test('exportar e importar', () => {
  const sm = new SaveManager(new MemoryStorage());
  const g = newGame();
  sm.save('slot1', g.state);
  const raw = sm.exportSlot('slot1');
  assert.ok(sm.importToSlot('slot3', raw).ok);
  assert.equal(sm.load('slot3').state.profile.name, 'Test');
  assert.throws(() => sm.importToSlot('slot2', '{"data":"x","checksum":"y"}'));
  assert.equal(sm.latestSlot() !== null, true);
});
