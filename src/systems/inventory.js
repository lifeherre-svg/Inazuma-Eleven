// Inventario: añadir, quitar, usar y equipar objetos, y comprar en tiendas.

import { getItem } from './database.js';
import { gainXp, gainTechXp, addFatigue, equipItem, canLearn, addTechnique, template } from './player.js';
import { EVT } from '../core/events.js';

export function itemCount(state, id) { return state.inventory.items[id] || 0; }

export function addItem(state, id, qty = 1) {
  getItem(id);
  state.inventory.items[id] = (state.inventory.items[id] || 0) + qty;
}

export function removeItem(state, id, qty = 1) {
  const have = itemCount(state, id);
  if (have < qty) return false;
  const left = have - qty;
  if (left <= 0) delete state.inventory.items[id];
  else state.inventory.items[id] = left;
  return true;
}

export function giveItem(game, id, qty = 1) {
  addItem(game.state, id, qty);
  game.bus.emit(EVT.ITEM_GAINED, { id, qty });
}

export function listInventory(state) {
  return Object.entries(state.inventory.items)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item: getItem(id), qty }));
}

/**
 * Usa un objeto sobre un jugador (o el equipo). Devuelve {ok, message}.
 */
export function useItem(game, itemId, targetUid) {
  const { state } = game;
  const item = getItem(itemId);
  if (itemCount(state, itemId) <= 0) return { ok: false, message: 'No tienes ese objeto.' };
  const target = state.roster.find((p) => p.uid === targetUid);

  if (item.type === 'consumable') {
    const e = item.effect;
    if (e.team) {
      for (const p of state.roster) addFatigue(p, e.fatigue || 0);
      removeItem(state, itemId);
      game.bus.emit(EVT.ITEM_USED, { itemId });
      return { ok: true, message: 'Toda la plantilla recupera energía.' };
    }
    if (!target) return { ok: false, message: 'Elige un jugador.' };
    const msgs = [];
    if (e.fatigue) { addFatigue(target, e.fatigue); msgs.push('Fatiga recuperada.'); }
    if (e.xp) {
      const r = gainXp(target, e.xp);
      msgs.push(r.levelsGained ? `¡Sube ${r.levelsGained} nivel(es)!` : `+${e.xp} XP.`);
      if (r.levelsGained) game.bus.emit(EVT.LEVEL_UP, { uid: target.uid, report: r });
    }
    if (e.techXp) {
      for (const t of target.techniques) gainTechXp(target, t.id, e.techXp);
      msgs.push('Técnicas mejoradas.');
    }
    removeItem(state, itemId);
    game.bus.emit(EVT.ITEM_USED, { itemId, uid: target.uid });
    return { ok: true, message: msgs.join(' ') };
  }

  if (item.type === 'equipment') {
    if (!target) return { ok: false, message: 'Elige un jugador.' };
    const prev = equipItem(target, itemId);
    removeItem(state, itemId);
    if (prev) addItem(state, prev);
    return { ok: true, message: `${item.name} equipado.` };
  }

  if (item.type === 'manual') {
    if (!target) return { ok: false, message: 'Elige un jugador.' };
    const check = canLearn(target, item.tech);
    if (!check.ok) return { ok: false, message: check.reason };
    addTechnique(target, item.tech);
    removeItem(state, itemId);
    game.bus.emit(EVT.TECH_LEARNED, { uid: target.uid, techId: item.tech });
    return { ok: true, message: `${template(target).name} aprende una nueva técnica.` };
  }

  return { ok: false, message: 'Este objeto no se puede usar aquí.' };
}

export function buyItem(game, itemId, qty = 1) {
  const item = getItem(itemId);
  const cost = item.price * qty;
  if (game.state.money < cost) return { ok: false, message: 'No tienes suficiente dinero.' };
  game.state.money -= cost;
  giveItem(game, itemId, qty);
  game.bus.emit(EVT.MONEY, { amount: -cost, total: game.state.money });
  return { ok: true, message: `Has comprado ${qty}× ${item.name}.` };
}

export function sellItem(game, itemId) {
  const item = getItem(itemId);
  if (item.type === 'key' || !item.price) return { ok: false, message: 'No se puede vender.' };
  if (!removeItem(game.state, itemId)) return { ok: false, message: 'No tienes ese objeto.' };
  const value = Math.floor(item.price / 2);
  game.state.money += value;
  return { ok: true, message: `Vendido por ${value} monedas.` };
}
