// The Ash Baron's brain: a readable heuristic, not a search. It scores every
// card it could play into every empty lane and plays the best one while the
// play is worth more than holding the ember. A player can read it — it
// trades up, protects a winning lane, heals when hurt, and cycles when its
// hand is thin — and can counter it by answering the lane it just filled.
// The same brain drives either side; the screenshots use it for the player.
import { cardCost, cardDef } from './cards.js';
import { legalPlays, other, playCard } from './engine.js';

/** How good is putting `card` into `lane` for `side` right now? Higher is better. */
export function scorePlay(state, side, card, lane) {
  const def = cardDef(card.type);
  const me = state.players[side];
  const them = state.players[other(side)];
  const enemy = them.lanes[lane];
  let score = def.atk + def.hp * 0.6 - def.cost * 0.4;

  // The lane's blessing is worth playing into on purpose: the Vent rewards
  // attackers, the Circle rewards walls, the Gate rewards things that last.
  if (lane === 0) score += def.atk * 0.5;
  else score += def.hp * 0.5;

  if (!enemy) {
    // An open lane is free hero damage every round.
    score += def.atk * 1.5;
    if (them.hero <= def.atk) score += 50;
  } else {
    const enemyDef = cardDef(enemy.type);
    const myAtk = def.atk - (enemyDef.ability === 'chill' ? 1 : 0);
    const theirAtk = Math.max(0, enemyDef.atk - (def.ability === 'chill' ? 1 : 0));
    const kills = myAtk >= enemy.hp;
    const survives = theirAtk < def.hp;
    if (kills) score += enemyDef.cost * 2 + 3;
    if (survives) score += 3;
    if (!kills && !survives) score -= 5;
    if (def.ability === 'swift' && kills) score += 2;
  }
  if (def.ability === 'heal' && me.hero <= 12) score += 4;
  if (def.ability === 'draw' && me.hand.length <= 2) score += 3;
  if (def.ability === 'spark' && them.hero <= 1) score += 50;
  if (def.cost > me.ember) score -= 100;
  return score;
}

/** Play one side's turn: best play, then the next, until nothing is worth it. */
export function playSmartTurn(state, side) {
  const events = [];
  const me = state.players[side];
  // If a big card is one round of banking away, hold weak plays for it.
  const nextMax = Math.min(10, state.turn + 1);
  const saving = me.hand.some((c) => {
    const cost = cardCost(c);
    return cost > me.ember && cost <= me.ember + nextMax;
  });
  const bar = saving ? 3.5 : 1.5;
  for (;;) {
    const plays = legalPlays(state, side);
    if (plays.length === 0) break;
    let best = null;
    let bestScore = bar;
    for (const play of plays) {
      const card = state.players[side].hand.find((c) => c.uid === play.uid);
      const score = scorePlay(state, side, card, play.lane);
      if (score > bestScore) {
        bestScore = score;
        best = play;
      }
    }
    if (!best) break;
    const made = playCard(state, side, best.uid, best.lane);
    if (!made) break;
    events.push(...made);
    if (state.phase !== 'play') break;
  }
  return events;
}

/** A weak pilot for screenshots and tests: any legal play, chosen at random. */
export function playRandomTurn(state, side, rand) {
  const events = [];
  for (;;) {
    const plays = legalPlays(state, side);
    if (plays.length === 0) break;
    const choice = plays[Math.floor(rand() * plays.length)];
    const made = playCard(state, side, choice.uid, choice.lane);
    if (!made) break;
    events.push(...made);
    if (state.phase !== 'play') break;
    if (rand() < 0.35) break;
  }
  return events;
}
