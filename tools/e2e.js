// Prueba de extremo a extremo en navegador real (Playwright/Chromium).
// Recorre: título → nueva partida → diálogo → menú (todas las pestañas) →
// desafío por turnos → partido jugable (con técnica) → resultados → guardado.
// Uso: npm run e2e  [-- --shots=directorio]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsArg = process.argv.find((a) => a.startsWith('--shots='));
const SHOTS = shotsArg ? shotsArg.split('=')[1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900);

const server = spawn(process.execPath, [path.join(ROOT, 'tools/server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) failures++; };

try {
  await sleep(600);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
  // Avanza el diálogo hasta que el guion termine (sin volver a hablar con nadie).
  const advanceDialogue = async () => {
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      const busy = await page.evaluate(() => window.__app.scene?.busy);
      if (!busy) return;
      if (await page.$('.dialogue:not(.hidden)')) await page.keyboard.press('Space');
    }
  };
  const closeModals = async () => { for (let i = 0; i < 5 && await page.$('.modal-overlay'); i++) { await page.keyboard.press('Escape'); await sleep(150); } };
  // El menú del juego no debe reabrirse por la misma pulsación de Escape.
  const menuOpen = () => page.evaluate(() => !!document.querySelector('.menu-overlay'));

  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.title-screen');
  check(true, 'Pantalla de título cargada');
  await shot('01_title');

  await page.click('text=Nueva partida');
  await page.fill('.text-input', 'Tester');
  await page.click('.coach-card >> nth=2');
  await page.click('.starter-card >> nth=1');
  await shot('02_newgame');
  await page.click('text=Empezar la aventura');
  await page.waitForSelector('.dialogue:not(.hidden)', { timeout: 8000 });
  await advanceDialogue();
  check(await page.evaluate(() => !!window.__app.game && window.__app.game.state.profile.name === 'Tester'), 'Partida creada con nombre y entrenador');
  await shot('03_world');

  // Moverse: hablar con Tetsuo (x=10,y=8) desde (10,9) mirando arriba.
  await page.evaluate(() => { const w = window.__app.scene.world; w.load('villa_rayo', 10, 9, 'up'); });
  await page.keyboard.press('Space');
  await advanceDialogue();
  check(await page.evaluate(() => window.__app.game.state.flags.got_key === true), 'Prólogo: Tetsuo entrega la llave (flag got_key)');
  check(await page.evaluate(() => !!window.__app.game.state.quests.active.mq_once), 'Misión principal "Reúne a once" activa');

  await shot('03b_after_tetsuo');
  // Menú y pestañas
  await page.keyboard.press('Escape');
  await page.waitForSelector('.menu-overlay');
  for (const tab of ['Equipo', 'Jugadores', 'Técnicas', 'Inventario', 'Misiones', 'Mapa', 'Torneos', 'Libreta', 'Guardar', 'Ajustes']) {
    await page.click(`.nav-btn:has-text("${tab}")`);
    await sleep(150);
    await shot(`04_menu_${tab}`);
  }
  check(errors.length === 0, 'Todas las pestañas del menú se renderizan sin errores');
  await page.click('.nav-btn.close');

  // Desafío por turnos
  const encP = page.evaluate(() => window.__app.startEncounter({ templateId: 'aki_sato', level: 2, kind: 'wild' }));
  await page.waitForSelector('.encounter');
  await shot('05_encounter');
  for (let i = 0; i < 25; i++) {
    const done = await page.$('.enc-actions .btn.big');
    if (done) break;
    await page.click('.enc-actions .btn.action >> nth=0').catch(() => {});
    await sleep(250);
  }
  await shot('06_encounter_end');
  const status = await page.evaluate(() => window.__app.scene.enc?.status);
  check(['won', 'lost', 'recruited'].includes(status), `Desafío terminado (estado: ${status})`);
  if (status === 'won') {
    await page.click('text=Invitar al equipo');
    await page.click('text=Enviar invitación');
    await sleep(300);
  }
  await page.click('.enc-actions .btn.big >> nth=-1').catch(() => {});
  await encP;
  check(true, 'Volver al mundo tras el desafío');

  // Completar el equipo para jugar partidos
  await page.evaluate(async () => {
    const gs = await import('/src/systems/game-state.js');
    for (const id of ['goro_tanaka', 'jun_ito', 'nao_fujita', 'koji_saito', 'taro_yamada']) gs.addPlayerToRoster(window.__app.game, id, 4);
    window.__app.game.state.settings.halfDurationSec = 20;
  });
  check(await page.evaluate(() => window.__app.game.state.roster.length >= 11), 'Plantilla con 11+ jugadores');
  check(await page.evaluate(() => window.__app.game.state.flags.team_complete === true), 'Misión "Reúne a once" completada automáticamente');

  // Partido jugable
  const matchP = page.evaluate(() => window.__app.playMatch({ team: 'pandilla_parque', level: 3, context: 'friendly' }));
  await page.waitForSelector('text=¡Jugar!');
  await shot('07_prematch');
  await page.click('text=¡Jugar!');
  await page.waitForSelector('.scoreboard');
  await sleep(1500);
  await shot('08_match');
  // Pulsar teclas de juego: correr hacia la portería y usar técnica
  await page.keyboard.down('KeyD');
  await sleep(1200);
  await page.keyboard.press('KeyI');
  await sleep(500);
  await shot('09_technique');
  await page.keyboard.up('KeyD');
  await sleep(1500);
  await page.keyboard.press('KeyJ');
  await sleep(500);
  // Esperar descanso y final (20 s por parte)
  for (let i = 0; i < 80; i++) {
    if (await page.$('text=Segunda parte')) { await shot('10_halftime'); await page.click('text=Segunda parte'); }
    if (await page.$('.results')) break;
    await page.keyboard.press(i % 2 ? 'KeyK' : 'KeyJ');
    await sleep(500);
  }
  await page.waitForSelector('.results', { timeout: 30000 });
  await shot('11_results');
  const res = await page.evaluate(() => document.querySelector('.res-num')?.textContent);
  check(!!res, `Resultados mostrados (${res})`);
  await page.click('.modal-buttons .btn.primary');
  await sleep(400);
  if (await page.$('text=Ojeo tras el partido')) { await shot('12_scouting'); await page.click('text=No, gracias'); }
  await matchP;
  check(await page.evaluate(() => window.__app.game.state.stats.matches === 1), 'Estadísticas del partido registradas');

  // Guardado / carga
  const saved = await page.evaluate(() => window.__app.saveSlot('slot1'));
  check(saved, 'Guardado manual en ranura 1');
  const loaded = await page.evaluate(() => { const r = window.__app.saves.load('slot1'); return r.ok && r.state.roster.length; });
  check(loaded >= 11, 'Carga de la ranura 1 verificada');

  // Instalaciones: tienda, entrenamiento (minijuego), torneos y ojeadores
  const shopP = page.evaluate(() => window.__app.facilities.shop('tienda_villa'));
  await page.waitForSelector('text=Comprar');
  const money0 = await page.evaluate(() => window.__app.game.state.money);
  await page.click('.item-card .btn.primary >> nth=0');
  check(await page.evaluate((m) => window.__app.game.state.money < m, money0), 'Compra en la tienda');
  await shot('13_shop');
  await closeModals(); await shopP;

  const trP = page.evaluate(() => window.__app.facilities.training());
  await page.waitForSelector('.drills');
  await page.click('.training .player-card >> nth=0');
  await page.click('text=¡Entrenar!');
  await page.waitForSelector('.minigame');
  await shot('14_minigame');
  for (let i = 0; i < 3; i++) { await sleep(400); await page.keyboard.press('Space'); }
  await sleep(1200);
  check(await page.evaluate(() => window.__app.game.state.stats.trainings === 1), 'Sesión de entrenamiento completada');
  await closeModals(); await trP;

  const tP = page.evaluate(() => window.__app.facilities.tournaments());
  await page.waitForSelector('.tour-grid');
  await shot('15_tournaments');
  await closeModals(); await tP;
  await sleep(200);
  check(!(await menuOpen()), 'Cerrar un modal con Escape no abre el menú del juego');

  const sP = page.evaluate(() => window.__app.facilities.scout());
  await page.waitForSelector('text=Red de ojeadores');
  await page.click('text=Buscar');
  await sleep(300);
  check(await page.evaluate(() => window.__app.game.state.scout.leads.length >= 1), 'Búsqueda de ojeadores genera una pista');
  await closeModals(); await sP;

  // Vista móvil
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(300);
  await page.evaluate(() => { window.__app.openMenu('players'); });
  await sleep(300);
  await shot('16_mobile_menu');
  await page.evaluate(() => window.__app.menu.close());

  await closeModals();
  await shot('17_end');
  check(errors.length === 0, `Sin errores de consola${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
  await browser.close();
} catch (err) {
  console.error('✘ Excepción en e2e:', err);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} comprobaciones fallidas` : '\nE2E OK');
process.exit(failures ? 1 : 0);
