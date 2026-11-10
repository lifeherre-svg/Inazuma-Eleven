// Intérprete de guiones (diálogos, cinemáticas y eventos de historia).
//
// Un guion es una lista de comandos JSON. La lógica (condiciones, flags,
// recompensas) se ejecuta aquí; la presentación la aporta un objeto `host`
// (la interfaz real o un mock en los tests) con métodos asíncronos:
//   say, choice, match, challenge, fx, title, warp, shop, open, npcMove,
//   wait, notify, sfx, music, heal, save
//
// Comandos soportados (ver docs/SCRIPTING.md):
//   { say, who?, portrait? }            { choice, options: [{ text, do: [...] }] }
//   { flag } { unflag }                  { if: cond, then: [...], else: [...] }
//   { give: { item, qty } } { take: { item, qty } } { money: n }
//   { player: { id, level } }            { quest: id } { completeQuest: id }
//   { match: { team, level?, context?, onWin?: [...], onLose?: [...] } }
//   { challenge: { player, level, onWin?, onLose? } }
//   { fx: 'flash'|'shake'|'fade'|'lightning' } { title, subtitle? }
//   { warp: { map, x, y } } { shop: id } { open: screenName } { heal: true }
//   { npcMove: { npc, path: [[dx,dy],...] } } { wait: ms } { notify } { sfx } { music }
//   { talked: npcId } { save: true } { stop: true }

import { hasFlag, setFlag, addMoney, addPlayerToRoster, ownsTemplate } from './game-state.js';
import { giveItem, itemCount, removeItem } from './inventory.js';
import { startQuest, completeQuest, isQuestDone, isQuestActive } from './quests.js';
import { EVT } from '../core/events.js';

export function evalCond(state, cond) {
  if (!cond) return true;
  if (cond.all) return cond.all.every((c) => evalCond(state, c));
  if (cond.any) return cond.any.some((c) => evalCond(state, c));
  if (cond.not) return !evalCond(state, cond.not);
  if (cond.flag && !hasFlag(state, cond.flag)) return false;
  if (cond.notFlag && hasFlag(state, cond.notFlag)) return false;
  if (cond.item && itemCount(state, cond.item.id) < (cond.item.count || 1)) return false;
  if (cond.questDone && !isQuestDone(state, cond.questDone)) return false;
  if (cond.questActive && !isQuestActive(state, cond.questActive)) return false;
  if (cond.roster && state.roster.length < cond.roster) return false;
  if (cond.owns && !ownsTemplate(state, cond.owns)) return false;
  if (cond.notOwns && ownsTemplate(state, cond.notOwns)) return false;
  if (cond.defeated && !state.defeatedTeams[cond.defeated]) return false;
  if (cond.chapter !== undefined && state.story.chapter < cond.chapter) return false;
  if (cond.money && state.money < cond.money) return false;
  return true;
}

class StopScript extends Error {}

export async function runScript(game, script, host, ctx = {}) {
  try {
    await runList(game, script || [], host, ctx);
  } catch (err) {
    if (!(err instanceof StopScript)) throw err;
  }
}

async function runList(game, list, host, ctx) {
  for (const cmd of list) await runCommand(game, cmd, host, ctx);
}

async function runCommand(game, cmd, host, ctx) {
  const { state } = game;
  if (cmd.say !== undefined) return host.say(cmd.who ?? ctx.npcName ?? '', cmd.say, cmd.portrait ?? ctx.portrait ?? null);
  if (cmd.choice !== undefined) {
    const idx = await host.choice(cmd.choice, cmd.options.map((o) => o.text), cmd.who ?? ctx.npcName);
    const opt = cmd.options[idx];
    if (opt?.do) await runList(game, opt.do, host, ctx);
    return;
  }
  if (cmd.if !== undefined) {
    if (evalCond(state, cmd.if)) await runList(game, cmd.then || [], host, ctx);
    else await runList(game, cmd.else || [], host, ctx);
    return;
  }
  if (cmd.flag) return setFlag(game, cmd.flag);
  if (cmd.unflag) { delete state.flags[cmd.unflag]; return; }
  if (cmd.give) { giveItem(game, cmd.give.item, cmd.give.qty || 1); return; } // el aviso lo emite el bus (ITEM_GAINED)
  if (cmd.take) { removeItem(state, cmd.take.item, cmd.take.qty || 1); return; }
  if (cmd.money) {
    addMoney(game, cmd.money);
    return host.notify?.(cmd.money > 0 ? `+${cmd.money} monedas` : `${cmd.money} monedas`);
  }
  if (cmd.player) {
    const r = addPlayerToRoster(game, cmd.player.id, cmd.player.level || 5, cmd.player.source || 'historia');
    if (!r.ok) host.notify?.(r.reason); // el éxito lo anuncia el bus (RECRUITED)
    return;
  }
  if (cmd.quest) { startQuest(game, cmd.quest); return; } // aviso vía QUEST_STARTED
  if (cmd.completeQuest) { if (isQuestActive(state, cmd.completeQuest)) completeQuest(game, cmd.completeQuest); return; }
  if (cmd.match) {
    const res = await host.match(cmd.match);
    if (res?.won) await runList(game, cmd.match.onWin || [], host, ctx);
    else await runList(game, cmd.match.onLose || [], host, ctx);
    return;
  }
  if (cmd.challenge) {
    const status = await host.challenge(cmd.challenge);
    if (status === 'recruited' || status === 'won') await runList(game, cmd.challenge.onWin || [], host, ctx);
    else await runList(game, cmd.challenge.onLose || [], host, ctx);
    return;
  }
  if (cmd.fx) return host.fx?.(cmd.fx);
  if (cmd.title) return host.title?.(cmd.title, cmd.subtitle || '');
  if (cmd.warp) return host.warp?.(cmd.warp.map, cmd.warp.x, cmd.warp.y);
  if (cmd.shop) return host.shop?.(cmd.shop);
  if (cmd.open) return host.open?.(cmd.open, cmd);
  if (cmd.heal) return host.heal?.();
  if (cmd.npcMove) return host.npcMove?.(cmd.npcMove.npc, cmd.npcMove.path);
  if (cmd.wait) return host.wait?.(cmd.wait);
  if (cmd.notify) return host.notify?.(cmd.notify);
  if (cmd.sfx) return host.sfx?.(cmd.sfx);
  if (cmd.music) return host.music?.(cmd.music);
  if (cmd.save) return host.save?.();
  if (cmd.talked) { game.bus.emit(EVT.TALKED, { npc: cmd.talked }); return; }
  if (cmd.stop) throw new StopScript();
  throw new Error(`Comando de guion desconocido: ${JSON.stringify(cmd)}`);
}
