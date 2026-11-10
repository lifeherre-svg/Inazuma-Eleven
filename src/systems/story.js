// Progreso de la historia: el capítulo actual se deriva de los flags.
import { CHAPTERS } from '../data/story.js';
import { EVT } from '../core/events.js';

export function currentChapter(state) {
  let idx = 0;
  for (const ch of CHAPTERS) {
    if (ch.completeFlag && state.flags[ch.completeFlag]) idx = ch.id + 1;
    else break;
  }
  return CHAPTERS[Math.min(idx, CHAPTERS.length - 1)];
}

export function syncChapter(game) {
  const ch = currentChapter(game.state);
  const changed = ch.id !== game.state.story.chapter;
  game.state.story.chapter = ch.id;
  return { chapter: ch, changed };
}

/** Conecta la historia al bus: emite un aviso cuando empieza un nuevo capítulo. */
export function attachStorySystem(game, onChapter) {
  return game.bus.on(EVT.FLAG_SET, () => {
    const { chapter, changed } = syncChapter(game);
    if (changed) onChapter?.(chapter);
  });
}
