// The rules of Ember Lanes, with no DOM in them: a pure state machine the
// browser renders and Node can play headlessly. Three lanes, two heroes at
// 20 life, ember that grows by one each round (cap 10). A round is: you play
// cards into empty lanes, press End Turn, the Ash Baron plays, then every
// lane fights at once — creatures trade blows, and a creature facing an
// empty lane hits the enemy hero instead.
import { buildDeck, cardCost, cardDef } from './cards.js';
import { mulberry32 } from './rng.js';

export const LANES = 3;
export const HERO_LIFE = 20;
export const MAX_EMBER = 10;
export const HAND_LIMIT = 7;
export const START_HAND = 3;

// Each lane has its own blessing, shown on the table: the Vent sharpens
// attack, the Circle hardens health, the Gate mends what stands in it.
export const LANE_BONUS = [
  { id: 'vent', name: 'Ember Vent', text: '+1 attack', atk: 1, hp: 0, heal: 0 },
  { id: 'circle', name: 'Stone Circle', text: '+1 health', atk: 0, hp: 1, heal: 0 },
  { id: 'gate', name: 'Moon Gate', text: 'Heals 1 each round', atk: 0, hp: 0, heal: 1 },
];

const YOU = 0;
const FOE = 1;

function freshSide(name, rand) {
  return {
    name,
    hero: HERO_LIFE,
    maxHero: HERO_LIFE,
    ember: 1,
    maxEmber: 1,
    hand: [],
    deck: buildDeck(rand),
    discard: [],
    lanes: [null, null, null],
    fatigue: 1,
  };
}

export function createGame(seed) {
  const rand = mulberry32(seed);
  const state = {
    seed,
    turn: 1,
    phase: 'play',
    winner: null,
    players: [freshSide('You', rand), freshSide('Ash Baron', rand)],
    log: [],
    rand,
  };
  for (let i = 0; i < START_HAND; i += 1) {
    drawCard(state, YOU);
    drawCard(state, FOE);
  }
  // The Baron moves second, so it opens with one card more — the same
  // courtesy every duel gives the player who answers first blood.
  drawCard(state, FOE);
  return state;
}

export function other(side) {
  return side === YOU ? FOE : YOU;
}

/** Move the top card of a deck into its hand (a full hand burns the draw). */
export function drawCard(state, side) {
  const p = state.players[side];
  if (p.deck.length === 0) {
    // Fatigue: an empty deck bites harder every round, so no game can stall.
    p.hero -= p.fatigue;
    say(state, `${p.name} is out of cards and takes ${p.fatigue} fatigue.`);
    p.fatigue += 1;
    checkEnd(state);
    return null;
  }
  const card = p.deck.shift();
  if (p.hand.length >= HAND_LIMIT) {
    p.discard.push(card);
    return null;
  }
  p.hand.push(card);
  return card;
}

/** Every (card, lane) a side can legally play right now. */
export function legalPlays(state, side) {
  const p = state.players[side];
  const plays = [];
  for (const card of p.hand) {
    if (cardCost(card) > p.ember) continue;
    for (let lane = 0; lane < LANES; lane += 1) {
      if (p.lanes[lane] === null) plays.push({ uid: card.uid, lane });
    }
  }
  return plays;
}

function laneCreature(state, side, lane) {
  return state.players[side].lanes[lane];
}

/** Attack after lane blessing and Chill: the Vent adds 1, a Frost Wisp saps 1. */
export function effectiveAttack(state, side, lane) {
  const creature = laneCreature(state, side, lane);
  if (!creature) return 0;
  const foe = laneCreature(state, other(side), lane);
  const chilled = foe !== null && cardDef(foe.type).ability === 'chill';
  return Math.max(0, cardDef(creature.type).atk + LANE_BONUS[lane].atk - (chilled ? 1 : 0));
}

/** Whether a creature strikes first: its own Swift ability. */
export function strikesFirst(state, side, lane) {
  const creature = laneCreature(state, side, lane);
  if (!creature) return false;
  return cardDef(creature.type).ability === 'swift';
}

function say(state, text) {
  state.log.push(text);
  if (state.log.length > 40) state.log.shift();
}

/**
 * Play a card from a hand into an empty lane. Returns the events the render
 * turns into animation and sound, or null when the play is illegal.
 */
export function playCard(state, side, uid, lane) {
  if (state.phase !== 'play') return null;
  const p = state.players[side];
  const foe = state.players[other(side)];
  const index = p.hand.findIndex((c) => c.uid === uid);
  if (index === -1 || lane < 0 || lane >= LANES || p.lanes[lane] !== null) return null;
  const card = p.hand[index];
  const def = cardDef(card.type);
  if (def.cost > p.ember) return null;

  p.hand.splice(index, 1);
  p.ember -= def.cost;
  // The Stone Circle hardens a creature as it enters the lane.
  card.hp = def.hp + LANE_BONUS[lane].hp;
  card.maxHp = card.hp;
  p.lanes[lane] = card;
  const events = [{ kind: 'play', side, lane, uid: card.uid, name: def.name }];
  say(state, `${p.name} plays ${def.name} in lane ${lane + 1}.`);

  // On-play abilities.
  if (def.ability === 'spark') {
    foe.hero -= 1;
    events.push({ kind: 'hero', side: other(side), amount: 1 });
    say(state, `Spark! ${foe.name} takes 1.`);
  } else if (def.ability === 'heal') {
    const healed = Math.min(2, p.maxHero - p.hero);
    p.hero += healed;
    events.push({ kind: 'heal', side, amount: healed });
    say(state, `${p.name} heals ${healed}.`);
  } else if (def.ability === 'draw') {
    const drawn = drawCard(state, side);
    events.push({ kind: 'draw', side, drew: drawn !== null });
    say(state, `${p.name} draws a card.`);
  }
  checkEnd(state);
  return events;
}

/** One lane's fight. Returns its events. */
function fightLane(state, lane) {
  const events = [];
  const you = state.players[YOU];
  const foe = state.players[FOE];
  const a = you.lanes[lane];
  const b = foe.lanes[lane];
  if (!a && !b) return events;

  // A lone creature hits the hero facing it.
  if (a && !b) {
    const dmg = effectiveAttack(state, YOU, lane);
    foe.hero -= dmg;
    events.push({ kind: 'hero', side: FOE, lane, amount: dmg });
    say(state, `${cardDef(a.type).name} hits ${foe.name} for ${dmg}.`);
    return events;
  }
  if (b && !a) {
    const dmg = effectiveAttack(state, FOE, lane);
    you.hero -= dmg;
    events.push({ kind: 'hero', side: YOU, lane, amount: dmg });
    say(state, `${cardDef(b.type).name} hits ${you.name} for ${dmg}.`);
    return events;
  }

  const atkA = effectiveAttack(state, YOU, lane);
  const atkB = effectiveAttack(state, FOE, lane);
  const swiftA = strikesFirst(state, YOU, lane);
  const swiftB = strikesFirst(state, FOE, lane);
  const thornA = cardDef(a.type).ability === 'thorns';
  const thornB = cardDef(b.type).ability === 'thorns';

  // Swift strikes first; a kill before the reply means no reply at all.
  let damageToB = 0;
  let damageToA = 0;
  if (swiftA && !swiftB) {
    damageToB = atkA;
    if (b.hp - damageToB > 0) damageToA = atkB;
  } else if (swiftB && !swiftA) {
    damageToA = atkB;
    if (a.hp - damageToA > 0) damageToB = atkA;
  } else {
    damageToB = atkA;
    damageToA = atkB;
  }
  if (damageToB > 0) {
    b.hp -= damageToB;
    events.push({ kind: 'damage', side: FOE, lane, amount: damageToB });
  }
  if (damageToA > 0) {
    a.hp -= damageToA;
    events.push({ kind: 'damage', side: YOU, lane, amount: damageToA });
  }
  // Thorns answers any creature that fought it, even if it falls.
  if (damageToA > 0 && thornA) {
    b.hp -= 1;
    events.push({ kind: 'damage', side: FOE, lane, amount: 1, thorns: true });
  }
  if (damageToB > 0 && thornB) {
    a.hp -= 1;
    events.push({ kind: 'damage', side: YOU, lane, amount: 1, thorns: true });
  }
  say(state, `Lane ${lane + 1}: ${cardDef(a.type).name} (${atkA}) vs ${cardDef(b.type).name} (${atkB}).`);
  for (const [side, creature] of [[YOU, a], [FOE, b]]) {
    if (creature.hp <= 0) {
      state.players[side].lanes[lane] = null;
      state.players[side].discard.push(creature);
      events.push({ kind: 'death', side, lane, name: cardDef(creature.type).name });
    }
  }
  return events;
}

/** Resolve all three lanes at once, then check for a winner. */
export function combat(state) {
  const events = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    events.push(...fightLane(state, lane));
  }
  checkEnd(state);
  return events;
}

/** Begin a new round: ember grows, unspent ember banks (cap: max + 2), both draw. */
export function startRound(state) {
  state.turn += 1;
  for (let index = 0; index < state.players.length; index += 1) {
    const p = state.players[index];
    p.maxEmber = Math.min(MAX_EMBER, state.turn);
    p.ember = Math.min(p.maxEmber + 2, p.ember + p.maxEmber);
    drawCard(state, index);
    // The Moon Gate mends the creature standing in it.
    const gate = p.lanes[2];
    if (gate !== null && gate.hp < gate.maxHp) {
      gate.hp = Math.min(gate.maxHp, gate.hp + LANE_BONUS[2].heal);
    }
  }
  say(state, `— Round ${state.turn}: ember rises to ${Math.min(MAX_EMBER, state.turn)} (banked up to +2). —`);
}

function checkEnd(state) {
  if (state.phase !== 'play') return;
  const you = state.players[YOU].hero;
  const foe = state.players[FOE].hero;
  if (foe <= 0 && you <= 0) {
    state.phase = 'over';
    state.winner = 'draw';
    say(state, 'Both heroes fall — a draw.');
  } else if (foe <= 0) {
    state.phase = 'over';
    state.winner = 'you';
    say(state, 'The Ash Baron falls. You win!');
  } else if (you <= 0) {
    state.phase = 'over';
    state.winner = 'foe';
    say(state, 'Your hero falls. The Ash Baron wins.');
  }
}

/** A short, readable snapshot for the render and for tests. */
export function scoreLine(state) {
  const you = state.players[YOU];
  const foe = state.players[FOE];
  return `You ${Math.max(0, you.hero)} — ${Math.max(0, foe.hero)} Ash Baron · Round ${state.turn}`;
}
