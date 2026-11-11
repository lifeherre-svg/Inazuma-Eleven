// Bus de eventos desacoplado. Los sistemas (misiones, historia, logros, UI)
// se comunican emitiendo y escuchando eventos en lugar de llamarse entre sí.

export class EventBus {
  constructor() { this.handlers = new Map(); }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off(type, fn) { this.handlers.get(type)?.delete(fn); }

  emit(type, payload = {}) {
    for (const fn of [...(this.handlers.get(type) ?? [])]) {
      try { fn(payload); } catch (err) { console.error(`[EventBus] Error en handler de "${type}"`, err); }
    }
    for (const fn of [...(this.handlers.get('*') ?? [])]) {
      try { fn({ type, ...payload }); } catch (err) { console.error('[EventBus] Error en handler comodín', err); }
    }
  }

  clear() { this.handlers.clear(); }
}

// Catálogo de eventos de juego (documentación viva de los tipos usados).
export const EVT = {
  MATCH_END: 'match:end',
  GOAL: 'match:goal',
  TECH_USED: 'match:tech',
  RECRUITED: 'player:recruited',
  SEEN: 'player:seen',
  LEVEL_UP: 'player:levelup',
  TECH_LEARNED: 'tech:learned',
  TRAINED: 'player:trained',
  ITEM_GAINED: 'item:gained',
  ITEM_USED: 'item:used',
  TALKED: 'npc:talked',
  ENTER_MAP: 'world:enter',
  FLAG_SET: 'flag:set',
  QUEST_STARTED: 'quest:started',
  QUEST_COMPLETED: 'quest:completed',
  TOURNAMENT_WON: 'tournament:won',
  ENCOUNTER_WON: 'encounter:won',
  MONEY: 'money:changed',
  NOTIFY: 'ui:notify',
};
