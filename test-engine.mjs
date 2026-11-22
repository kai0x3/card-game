// Headless tests for Ember Lanes (not shipped): run with node from the entry
// root. Simulates full games and checks each ability's rules.
import { cardDef } from './game/src/cards.js';
import { combat, createGame, drawCard, effectiveAttack, legalPlays, playCard, startRound } from './game/src/engine.js';
import { playRandomTurn, playSmartTurn } from './game/src/ai.js';
import { mulberry32 } from './game/src/rng.js';

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed += 1; } else { failed += 1; console.log('FAIL:', name); }
}

function setLane(state, side, lane, typeId, hp) {
  const def = cardDef(typeId);
  const card = { uid: 900 + lane * 10 + side, type: typeId, hp: hp ?? def.hp, maxHp: hp ?? def.hp };
  state.players[side].lanes[lane] = card;
  return card;
}

// --- Ability unit tests (hand-built boards) ---
{
  const s = createGame(1);
  setLane(s, 0, 0, 'hawk'); // swift 3/2
  setLane(s, 1, 0, 'pup');  // 3/2, no swift
  combat(s);
  check('swift kills first and takes no damage', s.players[1].lanes[0] === null && s.players[0].lanes[0] !== null && s.players[0].lanes[0].hp === 2);
}
{
  const s = createGame(1);
  setLane(s, 0, 1, 'wisp'); // chill 2/3 in the Circle (+1 hp = 4)
  setLane(s, 1, 1, 'colossus'); // 6/6 in the Circle (+1 hp = 7)
  check('chill reduces enemy attack to 5', effectiveAttack(s, 1, 1) === 5);
  combat(s);
  check('chilled colossus deals 5, wisp dies, hero unharmed', s.players[0].lanes[1] === null && s.players[0].hero === 20 && s.players[1].lanes[1].hp === 4);
}
{
  const s = createGame(1);
  setLane(s, 0, 0, 'golem'); // lone 2/6 in the Vent (+1 atk)
  combat(s);
  check('Vent gives +1 attack: lone golem hits hero for 3', s.players[1].hero === 17);
}
{
  const s = createGame(1);
  setLane(s, 0, 2, 'pup'); // 3/2 in the Moon Gate vs imp 2/1: a plain trade
  setLane(s, 1, 2, 'imp');
  combat(s);
  check('Gate lane trades normally (no free first strike)', s.players[1].lanes[2] === null && s.players[0].lanes[2] === null);
}
{
  const s = createGame(1);
  const golem = setLane(s, 0, 2, 'golem'); // 2/6 in the Moon Gate, wounded to 3
  golem.hp = 3;
  startRound(s);
  check('Moon Gate heals 1 each round', golem.hp === 4);
}
{
  const s = createGame(1);
  setLane(s, 0, 1, 'bramble'); // thorns 2/5 in the Circle (+1 hp via setLane maxHp 5)
  setLane(s, 1, 1, 'pup'); // 3/2 in the Circle (hp 2)
  combat(s);
  check('thorns deals 1 back; pup dies to 2+1', s.players[1].lanes[1] === null && s.players[0].lanes[1].hp === 2);
}
{
  const s = createGame(1);
  setLane(s, 0, 0, 'golem'); // lone 2/6 in the Vent (+1 atk = 3)
  combat(s);
  check('lone creature in the Vent hits hero for 3', s.players[1].hero === 17);
}
{
  const s = createGame(1);
  s.players[0].hero = 10;
  s.players[0].hand = [{ uid: 1, type: 'serpent', hp: 4 }];
  s.players[0].ember = 5;
  playCard(s, 0, 1, 0);
  check('serpent heals 2 on play', s.players[0].hero === 12);
  s.players[0].hand = [{ uid: 2, type: 'sprite', hp: 1 }];
  s.players[0].ember = 5;
  playCard(s, 0, 2, 1);
  check('sprite sparks 1 to enemy hero', s.players[1].hero === 19);
  const before = s.players[0].hand.length;
  s.players[0].hand = [{ uid: 3, type: 'moth', hp: 4 }];
  playCard(s, 0, 3, 2);
  check('moth draws a card on play', s.players[0].hand.length === 1 && before === 0);
}
{
  const s = createGame(1);
  const plays = legalPlays(s, 0);
  check('opening hand has legal plays', plays.length > 0);
  const bad = playCard(s, 0, 999, 0);
  check('illegal uid refused', bad === null);
  s.players[0].ember = 0;
  const broke = playCard(s, 0, s.players[0].hand[0].uid, 0);
  check('unaffordable card refused', broke === null);
}

// --- Full-game simulation: smart vs smart, random vs smart ---
function simulate(seed, youSmart) {
  const s = createGame(seed);
  let rounds = 0;
  while (s.phase === 'play' && rounds < 60) {
    if (youSmart) playSmartTurn(s, 0); else playRandomTurn(s, 0, s.rand);
    if (s.phase !== 'play') break;
    playSmartTurn(s, 1);
    if (s.phase !== 'play') break;
    combat(s);
    if (s.phase !== 'play') break;
    startRound(s);
    rounds += 1;
  }
  return { s, rounds };
}
let wins = 0, losses = 0, draws = 0, undecided = 0;
for (let seed = 1; seed <= 200; seed += 1) {
  const { s, rounds } = simulate(seed, true);
  if (s.phase !== 'over') undecided += 1;
  else if (s.winner === 'you') wins += 1;
  else if (s.winner === 'foe') losses += 1;
  else draws += 1;
  check(`game ${seed} ends within 60 rounds`, rounds < 60);
}
console.log(`smart-vs-smart over 200 seeds: you ${wins}, foe ${losses}, draw ${draws}, undecided ${undecided}`);
check('no undecided games', undecided === 0);
check('both sides can win', wins > 0 && losses > 0);

let rwins = 0;
for (let seed = 1; seed <= 100; seed += 1) {
  const { s } = simulate(seed, false);
  if (s.winner === 'you') rwins += 1;
}
console.log(`random-vs-smart over 100 seeds: random player wins ${rwins}`);
check('smart beats random (first-player edge is ~53%, so <42 counts)', rwins < 42);

// --- Find seeds for the screenshots ---
function findShot(kind) {
  for (let seed = 1; seed <= 500; seed += 1) {
    const { s, rounds } = simulate(seed, kind === 'win');
    if (kind === 'win' && s.winner === 'you' && rounds >= 4 && rounds <= 12) return { seed, rounds };
    if (kind === 'loss' && s.winner === 'foe' && rounds >= 4 && rounds <= 12) return { seed, rounds };
  }
  return null;
}
console.log('win shot seed:', JSON.stringify(findShot('win')));
console.log('loss shot seed:', JSON.stringify(findShot('loss')));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
