// The screenshot scenes behind ?shot=title|cover|win|loss. Each one plays
// the real rules forward from a fresh game, steered by the same brain the
// Ash Baron uses, so every frame is what a real game looks like and the
// same seed always gives the same frame. The win and loss seeds were found
// by simulating 500 games: seed 3 wins in 10 rounds, seed 2 loses in 8.
import { combat, createGame, startRound } from './engine.js';
import { playRandomTurn, playSmartTurn } from './ai.js';

const WIN_SEED = 3;
const LOSS_SEED = 2;
const COVER_SEED = 7;
const COVER_ROUNDS = 4;
const MAX_ROUNDS = 40;

function playRound(state, youSmart) {
  if (youSmart) playSmartTurn(state, 0);
  else playRandomTurn(state, 0, state.rand);
  if (state.phase !== 'play') return;
  playSmartTurn(state, 1);
  if (state.phase !== 'play') return;
  combat(state);
  if (state.phase !== 'play') return;
  startRound(state);
}

/** Set `state` to the named scene and say which screen goes over it. */
export function stageShot(name) {
  if (name === 'win') {
    const state = createGame(WIN_SEED);
    for (let i = 0; i < MAX_ROUNDS && state.phase === 'play'; i += 1) playRound(state, true);
    return { state, screen: 'over' };
  }
  if (name === 'loss') {
    const state = createGame(LOSS_SEED);
    for (let i = 0; i < MAX_ROUNDS && state.phase === 'play'; i += 1) playRound(state, false);
    return { state, screen: 'over' };
  }
  if (name === 'cover') {
    const state = createGame(COVER_SEED);
    for (let i = 0; i < COVER_ROUNDS && state.phase === 'play'; i += 1) playRound(state, true);
    // One more turn of your plays, so the table is full and your hand is live.
    if (state.phase === 'play') playSmartTurn(state, 0);
    return { state, screen: 'play' };
  }
  // Title (and anything unknown): a fresh game under the title screen.
  return { state: createGame(COVER_SEED), screen: 'title' };
}
