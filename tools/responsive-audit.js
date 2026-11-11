// Auditoría responsive: recorre las pantallas principales del juego en
// distintos dispositivos (móvil vertical/horizontal, tablet, escritorio) y
// comprueba que nada se desborda, que los botones son visibles y que tienen
// tamaño táctil suficiente. Guarda capturas para revisión visual.
// Uso: node tools/responsive-audit.js [--shots=dir] [--only=nombreDispositivo]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const SHOTS = arg('shots');
const ONLY = arg('only');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 9000 + Math.floor(Math.random() * 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEVICES = {
  'movil-vertical': devices['iPhone SE'],
  'movil-horizontal': devices['Pixel 7 landscape'],
  'movil-pequeno-horizontal': { ...devices['Galaxy S5 landscape'] },
  'tablet-vertical': devices['iPad Mini'],
  'tablet-horizontal': devices['iPad Mini landscape'],
  'portatil': { viewport: { width: 1280, height: 720 } },
  'escritorio-fullhd': { viewport: { width: 1920, height: 1080 } },
};

// Pantallas: cada una prepara el estado y devuelve el selector de su contenedor.
const SCREENS = [
  ['titulo', async (p) => { await p.goto(url()); await p.waitForSelector('.title-screen'); }],
  ['nueva-partida', async (p) => { await p.evaluate(() => document.querySelector('.title-menu .btn.primary, .title-menu .btn')?.click()); await p.waitForSelector('.newgame'); }],
  ['mundo', async (p) => {
    // newGame() resuelve al terminar la introducción: no se espera, se avanza el diálogo.
    await p.evaluate(() => { window.__app.newGame({ name: 'Audit', coachId: 'estratega', starterId: 'kenta_hoshino' }); });
    await sleep(3200);
    for (let i = 0; i < 60 && await p.evaluate(() => window.__app.scene?.busy); i++) { await p.evaluate(() => window.__app.scene.dialogue.advance()); await sleep(80); }
  }],
  ['dialogo', async (p) => { await p.evaluate(() => { window.__app.scene.runScript([{ say: 'Para competir necesitáis ONCE jugadores. Recorre la hierba alta del parque y de la Ribera: hay talento escondido por todas partes.', who: 'Abuelo Tetsuo', portrait: 'oldman' }]); }); await sleep(1500); }],
  ['eleccion', async (p) => { await p.evaluate(() => window.__app.scene.dialogue.advance()); await p.evaluate(() => { window.__app.scene.runScript([{ choice: '¿Aceptas la oferta del Proyecto Zenith?', who: 'Director Kuze', options: [{ text: 'Aceptar el trato' }, { text: 'Rechazar: jugamos a nuestra manera' }] }]); }); await sleep(400); }],
  ['menu-equipo', async (p) => { await p.evaluate(() => document.querySelector('.dlg-choices .btn')?.click()); await sleep(200); await p.evaluate(async () => {
    const gs = await import('./src/systems/game-state.js');
    for (const id of ['goro_tanaka', 'aki_sato', 'jun_ito', 'nao_fujita']) gs.addPlayerToRoster(window.__app.game, id, 4);
    window.__app.openMenu('team');
  }); await sleep(400); }],
  ['menu-jugadores', async (p) => { await p.evaluate(() => window.__app.menu.show('players')); await sleep(300); }],
  ['menu-libreta', async (p) => { await p.evaluate(() => window.__app.menu.show('dex')); await sleep(300); }],
  ['menu-ajustes', async (p) => { await p.evaluate(() => window.__app.menu.show('settings')); await sleep(200); }],
  ['entrenamiento', async (p) => { await p.evaluate(() => { window.__app.menu.close(); window.__app.facilities.training(); }); await sleep(400); }],
  ['desafio', async (p) => { await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((m) => m.closeModal?.(null)); window.__app.startEncounter({ templateId: 'aki_sato', level: 3, kind: 'wild' }); }); await sleep(900); }],
  ['previa', async (p) => { await p.evaluate(() => { window.__app.scene.onEnd('fled'); window.__app.playMatch({ team: 'pandilla_parque', level: 3, context: 'friendly' }); }); await sleep(500); }],
  ['partido', async (p) => { await p.evaluate(() => [...document.querySelectorAll('.modal-buttons .btn')].find((b) => b.textContent.includes('Jugar'))?.click()); await sleep(2200); }],
  ['pausa', async (p) => { await p.evaluate(() => { window.__app.scene.pause(); }); await sleep(400); }],
];

let currentPort = PORT;
const url = () => `http://localhost:${currentPort}/`;

/** Problemas de maquetación visibles en la página actual. */
async function inspect(page, isTouch) {
  return page.evaluate((isTouch) => {
    const issues = [];
    const vw = innerWidth, vh = innerHeight;
    const de = document.documentElement;
    if (de.scrollWidth > vw + 1) issues.push(`desbordamiento horizontal de la página (${de.scrollWidth}px > ${vw}px)`);
    const scrollParent = (el) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) return e;
      }
      return null;
    };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const seen = new Set();
    for (const el of document.querySelectorAll('button, .btn, select, input, .nav-btn, .player-card, .slot')) {
      if (!visible(el) || el.closest('.hidden')) continue;
      const r = el.getBoundingClientRect();
      const label = (el.textContent || el.getAttribute('aria-label') || el.className).trim().replace(/\s+/g, ' ').slice(0, 30);
      const sp = scrollParent(el);
      // Recortado fuera de la pantalla sin contenedor desplazable que lo permita alcanzar
      if (!sp && (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2)) {
        const k = `fuera:${label}`; if (!seen.has(k)) { seen.add(k); issues.push(`fuera de pantalla: "${label}" (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`); }
      }
      if (isTouch && (el.matches('button, .btn, .nav-btn')) && (r.height < 40 || r.width < 40)) {
        const k = `peq:${label}`; if (!seen.has(k)) { seen.add(k); issues.push(`objetivo táctil pequeño: "${label}" ${Math.round(r.width)}×${Math.round(r.height)}`); }
      }
    }
    // Texto que se sale de su caja (recortado sin elipsis)
    for (const el of document.querySelectorAll('.modal, .menu-body, .enc-card, .dialogue, .ctrl-panel, .scoreboard, .world-hud > *')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2) issues.push(`contenedor sale de la pantalla: .${el.className.split(' ')[0]} (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
    }
    // Solapamientos de controles táctiles con paneles del HUD
    const touch = [...document.querySelectorAll('.touch-controls button, .touch-controls .joy')].filter(visible).map((e) => e.getBoundingClientRect());
    for (const el of document.querySelectorAll('.ctrl-panel, .hud-goal, .scoreboard, .duel-prompt:not(.hidden)')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (touch.some((t) => t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top)) issues.push(`control táctil tapa a .${el.className.split(' ')[0]}`);
    }
    return issues;
  }, isTouch);
}

const server = spawn(process.execPath, [path.join(ROOT, 'tools/server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
let total = 0;
try {
  await sleep(600);
  const browser = await chromium.launch();
  for (const [name, dev] of Object.entries(DEVICES)) {
    if (ONLY && name !== ONLY) continue;
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const isTouch = !!dev.hasTouch;
    console.log(`\n=== ${name} (${dev.viewport.width}×${dev.viewport.height}${isTouch ? ', táctil' : ''}) ===`);
    for (const [screen, prep] of SCREENS) {
      try { await prep(page); } catch (err) { console.log(`  ✘ ${screen}: no se pudo preparar (${err.message.split('\n')[0]})`); total++; continue; }
      await sleep(250);
      const issues = await inspect(page, isTouch);
      total += issues.length;
      console.log(`  ${issues.length ? '✘' : '✔'} ${screen}${issues.length ? '\n      - ' + issues.slice(0, 8).join('\n      - ') + (issues.length > 8 ? `\n      … y ${issues.length - 8} más` : '') : ''}`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}__${screen}.png`) });
    }
    if (errors.length) { console.log(`  ✘ errores JS: ${errors.join(' | ')}`); total += errors.length; }
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`\n${total ? `${total} problemas encontrados` : 'Sin problemas de maquetación'}`);
process.exit(total ? 1 : 0);
