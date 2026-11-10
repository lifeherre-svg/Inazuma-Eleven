// Validador de datos: comprueba referencias cruzadas (jugadores, técnicas,
// equipos, objetos, misiones, mapas) y que todo lo colocado en los mapas
// esté en casillas válidas. Uso: npm run check
import { PLAYERS } from '../src/data/players.js';
import { TECHNIQUE_MAP } from '../src/data/techniques.js';
import { TEAMS } from '../src/data/teams.js';
import { ITEMS, ITEM_MAP, SHOPS } from '../src/data/items.js';
import { QUESTS, QUEST_MAP } from '../src/data/quests.js';
import { TOURNAMENTS } from '../src/data/tournaments.js';
import { MAPS } from '../src/data/maps.js';
import { FORMATION_MAP } from '../src/data/formations.js';
import { PERSONALITIES } from '../src/data/personalities.js';
import { ELEMENTS } from '../src/data/elements.js';
import { RARITY, POSITIONS, STATS } from '../src/config.js';
import { getTeamRoster, hasPlayerTemplate } from '../src/systems/database.js';
import { buildMap } from '../src/world/map-builder.js';

const errors = [];
const warn = [];
const err = (m) => errors.push(m);

const ids = new Set();
for (const p of PLAYERS) {
  if (ids.has(p.id)) err(`Jugador duplicado ${p.id}`);
  ids.add(p.id);
  if (!POSITIONS.includes(p.position)) err(`${p.id}: posición ${p.position}`);
  if (!ELEMENTS[p.element]) err(`${p.id}: elemento ${p.element}`);
  if (!RARITY[p.rarity]) err(`${p.id}: rareza ${p.rarity}`);
  if (!PERSONALITIES[p.personality]) err(`${p.id}: personalidad ${p.personality}`);
  for (const s of STATS) if (!(p.base[s] > 0)) err(`${p.id}: estadística ${s} inválida`);
  for (const l of p.learnset) {
    if (!TECHNIQUE_MAP[l.tech]) err(`${p.id}: técnica desconocida ${l.tech}`);
    else if (TECHNIQUE_MAP[l.tech].category === 'keeper' && p.position !== 'GK') err(`${p.id}: técnica de portero en no-portero`);
  }
}
for (const t of TEAMS) {
  if (!FORMATION_MAP[t.formation]) err(`${t.id}: formación ${t.formation}`);
  for (const s of t.stars) if (!ids.has(s)) err(`${t.id}: estrella ${s}`);
  try { if (getTeamRoster(t.id).length < 11) err(`${t.id}: plantilla < 11`); } catch (e) { err(`${t.id}: ${e.message}`); }
}
for (const [shop, list] of Object.entries(SHOPS)) for (const i of list) if (!ITEM_MAP[i]) err(`Tienda ${shop}: objeto ${i}`);
for (const i of ITEMS) if (i.type === 'manual' && !TECHNIQUE_MAP[i.tech]) err(`Manual ${i.id}: técnica ${i.tech}`);
for (const q of QUESTS) {
  for (const it of Object.keys(q.rewards?.items || {})) if (!ITEM_MAP[it]) err(`Misión ${q.id}: objeto ${it}`);
  if (q.rewards?.player && !ids.has(q.rewards.player.id)) err(`Misión ${q.id}: jugador ${q.rewards.player.id}`);
  for (const o of q.objectives) {
    if (o.team && o.team !== '*' && !TEAMS.find((t) => t.id === o.team)) err(`Misión ${q.id}: equipo ${o.team}`);
    if ((o.player) && !ids.has(o.player)) err(`Misión ${q.id}: jugador ${o.player}`);
    if (o.type === 'tournament' && !TOURNAMENTS.find((t) => t.id === o.id)) err(`Misión ${q.id}: torneo ${o.id}`);
  }
}
for (const t of TOURNAMENTS) {
  for (const r of t.rounds) if (!TEAMS.find((x) => x.id === r.team)) err(`Torneo ${t.id}: equipo ${r.team}`);
  for (const it of Object.keys(t.rewards.items || {})) if (!ITEM_MAP[it]) err(`Torneo ${t.id}: objeto ${it}`);
}

// Recorre guiones buscando referencias
function walkScript(where, list) {
  for (const c of list || []) {
    if (c.give && !ITEM_MAP[c.give.item]) err(`${where}: objeto ${c.give.item}`);
    if (c.take && !ITEM_MAP[c.take.item]) err(`${where}: objeto ${c.take.item}`);
    if (c.player && !hasPlayerTemplate(c.player.id)) err(`${where}: jugador ${c.player.id}`);
    if (c.quest && !QUEST_MAP[c.quest]) err(`${where}: misión ${c.quest}`);
    if (c.match && !TEAMS.find((t) => t.id === c.match.team)) err(`${where}: equipo ${c.match.team}`);
    if (c.challenge && !hasPlayerTemplate(c.challenge.player)) err(`${where}: jugador ${c.challenge.player}`);
    if (c.shop && !SHOPS[c.shop]) err(`${where}: tienda ${c.shop}`);
    if (c.warp) {
      const m = MAPS.find((x) => x.id === c.warp.map);
      if (!m) err(`${where}: mapa ${c.warp.map}`);
      else if (buildMap(m).isSolid(c.warp.x, c.warp.y)) err(`${where}: warp a casilla sólida ${c.warp.map} (${c.warp.x},${c.warp.y})`);
    }
    walkScript(where, c.then); walkScript(where, c.else);
    for (const o of c.options || []) walkScript(where, o.do);
    walkScript(where, c.match?.onWin); walkScript(where, c.match?.onLose);
    walkScript(where, c.challenge?.onWin); walkScript(where, c.challenge?.onLose);
  }
}

for (const spec of MAPS) {
  const m = buildMap(spec);
  const where = `Mapa ${m.id}`;
  if (m.isSolid(m.spawn.x, m.spawn.y)) err(`${where}: spawn sólido`);
  const occupied = new Set();
  for (const n of m.npcs) {
    walkScript(`${where}/${n.id}`, n.script);
    if (n.templateId && !hasPlayerTemplate(n.templateId)) err(`${where}/${n.id}: jugador ${n.templateId}`);
    const key = `${n.x},${n.y}`;
    if (occupied.has(key)) err(`${where}/${n.id}: casilla ocupada ${key}`);
    occupied.add(key);
    if (n.invisible) {
      // Puertas/carteles: deben ser alcanzables desde una casilla adyacente transitable.
      const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !m.isSolid(n.x + dx, n.y + dy));
      if (!adj) err(`${where}/${n.id}: puerta/cartel inalcanzable (${key})`);
    } else if (m.isSolid(n.x, n.y)) err(`${where}/${n.id}: NPC en casilla sólida (${key})`);
  }
  for (const it of m.items || []) {
    if (!ITEM_MAP[it.item]) err(`${where}: objeto ${it.item}`);
    if (m.isSolid(it.x, it.y)) err(`${where}: objeto en casilla sólida (${it.x},${it.y})`);
  }
  for (const s of m.scoutPool || []) {
    if (!ids.has(s.id)) err(`${where}: ojeo ${s.id}`);
    if (m.isSolid(s.x, s.y)) err(`${where}: pista de ojeo en casilla sólida ${s.id} (${s.x},${s.y})`);
    if (occupied.has(`${s.x},${s.y}`)) err(`${where}: pista de ojeo sobre NPC ${s.id}`);
  }
  for (const e of m.encounters?.pool || []) if (!ids.has(e.id)) err(`${where}: encuentro ${e.id}`);
  for (const w of m.warps || []) {
    const target = MAPS.find((x) => x.id === w.to);
    if (!target) { err(`${where}: warp a mapa ${w.to}`); continue; }
    if (buildMap(target).isSolid(w.tx, w.ty)) err(`${where}: warp a casilla sólida ${w.to} (${w.tx},${w.ty})`);
  }
  if (!m.tiles.some((t) => t === 1)) warn.push(`${where}: sin hierba alta`);
  // Alcanzabilidad desde el punto de aparición (BFS sobre casillas transitables).
  const seen = new Set([`${m.spawn.x},${m.spawn.y}`]);
  const queue = [[m.spawn.x, m.spawn.y]];
  const blockers = new Set(m.npcs.filter((n) => !n.invisible).map((n) => `${n.x},${n.y}`));
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || m.isSolid(nx, ny) || nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      seen.add(k);
      if (!blockers.has(k)) queue.push([nx, ny]);
    }
  }
  const reachAdj = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
  for (const n of m.npcs) if (!reachAdj(n.x, n.y)) err(`${where}/${n.id}: inalcanzable desde el spawn`);
  for (const it of m.items || []) if (!seen.has(`${it.x},${it.y}`)) err(`${where}: objeto ${it.item} inalcanzable`);
  for (const s of m.scoutPool || []) if (!reachAdj(s.x, s.y)) err(`${where}: pista ${s.id} inalcanzable`);
  for (const w of m.warps || []) if (!reachAdj(w.x, w.y)) err(`${where}: salida a ${w.to} inalcanzable`);
}

for (const w of warn) console.warn('AVISO:', w);
if (errors.length) {
  for (const e of errors) console.error('ERROR:', e);
  console.error(`\n${errors.length} errores encontrados.`);
  process.exit(1);
}
console.log(`Datos válidos: ${PLAYERS.length} jugadores, ${Object.keys(TECHNIQUE_MAP).length} técnicas, ${TEAMS.length} equipos, ${ITEMS.length} objetos, ${QUESTS.length} misiones, ${TOURNAMENTS.length} torneos, ${MAPS.length} mapas.`);
