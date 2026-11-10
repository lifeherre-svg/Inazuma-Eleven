// Utilidades compartidas por los tests.
import { createNewState, createGameContext, addPlayerToRoster } from '../src/systems/game-state.js';
import { attachQuestSystem } from '../src/systems/quests.js';

export function newGame(opts = {}, seed = 42) {
  const state = createNewState({ name: 'Test', coachId: 'estratega', starterId: 'kenta_hoshino', ...opts });
  const game = createGameContext(state, { seed });
  game.detach = attachQuestSystem(game);
  return game;
}

/** Host de guiones simulado: elige siempre la opción indicada y gana/pierde según config. */
export function mockHost({ choice = 0, winMatches = true, winChallenges = true, game = null } = {}) {
  const log = [];
  return {
    log,
    say: async (who, text) => { log.push(['say', who, text]); },
    choice: async (q, opts) => { log.push(['choice', q, opts]); return typeof choice === 'function' ? choice(q, opts) : choice; },
    match: async (m) => { log.push(['match', m.team]); return { won: winMatches }; },
    challenge: async (c) => {
      log.push(['challenge', c.player]);
      // Como la escena real: ganar un reto incorpora al jugador.
      if (winChallenges && game) addPlayerToRoster(game, c.player, c.level, 'reto');
      return winChallenges ? 'recruited' : 'lost';
    },
    notify: async (t) => log.push(['notify', t]),
    fx: async () => {}, title: async (t) => log.push(['title', t]), warp: async (m) => log.push(['warp', m]),
    shop: async () => {}, heal: async () => log.push(['heal']), save: async () => {}, open: async (s) => log.push(['open', s]),
    npcMove: async () => {}, wait: async () => {}, sfx: () => {}, music: () => {}, itemName: (id) => id,
  };
}
