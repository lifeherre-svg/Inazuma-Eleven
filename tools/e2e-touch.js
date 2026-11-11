// Prueba e2e de la experiencia móvil/Android (Chromium emulando un Pixel 7
// en horizontal, con pantalla táctil). Comprueba joystick analógico, botones
// táctiles contextuales, botón Atrás (handleBack) y escala de interfaz.
// Uso: npm run e2e:touch  [-- --shots=dir]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.split('=')[1];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(ROOT, 'tools/server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) failures++; };

try {
  await sleep(600);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `touch_${n}.png`) }); };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // Arrastra el joystick desde su centro (dx, dy en fracción del radio) durante ms.
  const dragJoystick = async (fx, fy, ms) => {
    const r = await page.locator('.joy').boundingBox();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + fx * r.width * 0.4, cy + fy * r.width * 0.4, { steps: 4 });
    await sleep(ms);
    const stick = await ev(() => window.__app.input.stick);
    await page.mouse.up();
    return stick;
  };

  await page.goto(`http://localhost:${PORT}/`);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.title-screen');
  check(await ev(() => document.body.classList.contains('is-touch')), 'Detecta dispositivo táctil');
  check(await ev(() => document.fonts.check('1rem "Russo One"')), 'Fuentes incluidas en el juego (sin depender de Internet)');
  check(await ev(() => window.__app.handleBack()) === false, 'Atrás en el título → salir de la app');
  check(!(await page.isVisible('.touch-controls .joy')), 'Sin controles táctiles en el título');

  await page.tap('text=Nueva partida');
  await page.tap('text=Empezar la aventura');
  await page.waitForSelector('.dialogue:not(.hidden)', { timeout: 8000 });
  check(!(await page.isVisible('.joy')), 'Controles ocultos mientras hay un diálogo');
  for (let i = 0; i < 20 && await ev(() => window.__app.scene.busy); i++) { await page.tap('.dialogue').catch(() => {}); await sleep(250); }
  check(await page.isVisible('.joy'), 'Joystick visible al explorar');
  check(await page.isVisible('.tb[data-a=confirm]') && !(await page.isVisible('.tb[data-a=shoot]')), 'Modo mundo: botón Hablar, sin botones de partido');
  await shot('mundo');

  // Joystick: derecha y luego arriba
  const x0 = await ev(() => window.__app.scene.world.player.x);
  const stick = await dragJoystick(1, 0, 900);
  const x1 = await ev(() => window.__app.scene.world.player.x);
  check(stick && stick.x > 0.8, `Joystick analógico (x=${stick?.x.toFixed(2)})`);
  check(x1 > x0, `El joystick mueve al entrenador (${x0} → ${x1})`);
  check(await ev(() => window.__app.input.stick) === null, 'Al soltar, el joystick se recentra');

  // Hablar con Tetsuo con el botón táctil
  await ev(() => window.__app.scene.world.load('villa_rayo', 10, 9, 'up'));
  await page.dispatchEvent('.tb[data-a=confirm]', 'pointerdown');
  await page.dispatchEvent('.tb[data-a=confirm]', 'pointerup');
  await page.waitForSelector('.dialogue:not(.hidden)', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('.dialogue:not(.hidden)'), 'Botón Hablar inicia la conversación');
  for (let i = 0; i < 40 && await ev(() => window.__app.scene.busy); i++) { await page.tap('.dialogue').catch(() => {}); await sleep(200); }

  // Botón Atrás: abre menú, cierra menú
  check(await ev(() => window.__app.handleBack()) === true, 'Atrás en el mundo → gestionado');
  await sleep(200);
  check(await page.isVisible('.menu-overlay'), 'Atrás abre el menú');
  check(!(await page.isVisible('.joy')), 'Controles ocultos con el menú abierto');
  await shot('menu');
  await ev(() => window.__app.handleBack());
  await sleep(200);
  check(!(await page.isVisible('.menu-overlay')), 'Atrás cierra el menú');

  // Partido
  await ev(async () => {
    const gs = await import('./src/systems/game-state.js');
    for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito', 'nao_fujita']) gs.addPlayerToRoster(window.__app.game, id, 4);
    window.__app.game.state.settings.duelPrompts = false;
  });
  await ev(() => { window.__app.playMatch({ team: 'pandilla_parque', level: 3, context: 'friendly' }); });
  await page.waitForSelector('text=¡Jugar!');
  await page.tap('text=¡Jugar!');
  await page.waitForSelector('.scoreboard');
  await sleep(1300);
  check(await page.isVisible('.tb[data-a=shoot]') && !(await page.isVisible('.tb[data-a=confirm]')), 'Modo partido: botones de acción de partido');
  const ownLabel = await ev(() => { const e = window.__app.scene.engine; return [!!(e.ball.owner && e.ball.owner === e.controlled), getComputedStyle(document.querySelector('.tb[data-a=pass] .l-own')).display !== 'none' ? 'Pase' : 'Cambiar']; });
  check((ownLabel[0] && ownLabel[1] === 'Pase') || (!ownLabel[0] && ownLabel[1] === 'Cambiar'), `Etiqueta contextual correcta (balón propio: ${ownLabel[0]} → ${ownLabel[1]})`);
  const p0 = await ev(() => window.__app.scene.engine.controlled.x);
  await dragJoystick(1, -0.3, 900);
  const p1 = await ev(() => window.__app.scene.engine.controlled.x);
  check(p1 !== p0, 'El joystick mueve al jugador en el partido');
  await page.dispatchEvent('.tb[data-a=special]', 'pointerdown');
  await page.dispatchEvent('.tb[data-a=special]', 'pointerup');
  await sleep(300);
  await shot('partido');
  await ev(() => window.__app.handleBack());
  await sleep(300);
  check(await page.isVisible('text=Simular el resto'), 'Atrás en el partido → pausa');
  await page.tap('text=Simular el resto');
  await page.waitForSelector('.results', { timeout: 30000 });
  await shot('resultados');
  check(true, 'Partido completado en táctil');
  await page.tap('.modal-buttons .btn.primary');
  await sleep(400);
  if (await page.$('text=Ojeo tras el partido')) await page.tap('text=No, gracias');

  // Escala de interfaz
  const base = await ev(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await ev(() => window.__app.applySettings({ ...window.__app.game.state.settings, uiScale: 1.3 }));
  const big = await ev(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  check(big > base * 1.25, `Ajuste "Tamaño de la interfaz" (${base}px → ${big}px)`);

  check(errors.length === 0, `Sin errores de JavaScript${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
} catch (err) {
  console.error('✘ Excepción:', err);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} comprobaciones fallidas` : '\nE2E táctil OK');
process.exit(failures ? 1 : 0);
