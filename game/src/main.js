// Ember Lanes: bootstrap. Builds the table, wires input to the engine, and
// turns engine events into sound and floating numbers. A ?shot= query stages
// a screenshot scene instead of a fresh game; a ?seed= picks the shuffle.
import { combat, createGame, playCard, startRound } from './engine.js';
import { playSmartTurn } from './ai.js';
import { hideScreen, initRender, render, showBanner, showEndScreen, showPauseScreen, showTitleScreen, spawnFloat } from './render.js';
import { installInput } from './input.js';
import { stageShot } from './shots.js';
import { isMuted, setMuted, sfx } from './audio.js';

const root = document.querySelector('#app');
initRender(root);

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : (Date.now() % 2147483647);
const shot = params.get('shot');

let state;
let ui = { selectedUid: null, paused: false, started: false };
let shotMode = null;

if (shot) {
  const staged = stageShot(shot);
  state = staged.state;
  shotMode = staged.screen;
  ui.started = true;
} else {
  state = createGame(seed);
}

function refresh() {
  render(state, ui);
  const soundBtn = document.querySelector('#sound-btn');
  if (soundBtn) soundBtn.textContent = isMuted() ? '♪ Muted' : '♪ Sound';
}

/** Play the combat events back as sound and floating numbers. */
function playEvents(events) {
  for (const event of events) {
    if (event.kind === 'damage') {
      spawnFloat(event.lane, `−${event.amount}`, 'damage');
      sfx.hit();
    } else if (event.kind === 'hero') {
      spawnFloat(event.lane ?? 1, `−${event.amount}`, 'hero');
      sfx.hit();
    } else if (event.kind === 'heal') {
      sfx.heal();
    } else if (event.kind === 'play') {
      sfx.play();
    } else if (event.kind === 'draw') {
      sfx.draw();
    }
  }
}

function maybeOver() {
  if (state.phase === 'over') {
    refresh();
    window.setTimeout(() => {
      showEndScreen(state);
      if (state.winner === 'you') sfx.win();
      else if (state.winner === 'foe') sfx.lose();
    }, 650);
    return true;
  }
  return false;
}

function endTurn() {
  if (shotMode || !ui.started || ui.paused || state.phase !== 'play') return;
  ui.selectedUid = null;
  const aiEvents = playSmartTurn(state, 1);
  playEvents(aiEvents);
  if (maybeOver()) return;
  const fight = combat(state);
  playEvents(fight);
  if (maybeOver()) return;
  startRound(state);
  showBanner(`Round ${state.turn}`);
  sfx.turn();
  refresh();
}

const handlers = {
  onSelectCard(uid) {
    if (shotMode || !ui.started || ui.paused || state.phase !== 'play') return;
    const card = state.players[0].hand.find((c) => c.uid === uid);
    if (!card) return;
    ui.selectedUid = ui.selectedUid === uid ? null : uid;
    sfx.click();
    refresh();
  },
  onSelectCardIndex(index) {
    const card = state.players[0].hand[index];
    if (card) handlers.onSelectCard(card.uid);
  },
  onPlayLane(lane) {
    if (shotMode || !ui.started || ui.paused || state.phase !== 'play') return;
    if (ui.selectedUid === null) return;
    const made = playCard(state, 0, ui.selectedUid, lane);
    if (!made) {
      ui.selectedUid = null;
      refresh();
      return;
    }
    ui.selectedUid = null;
    playEvents(made);
    if (maybeOver()) return;
    refresh();
  },
  onEndTurn() {
    endTurn();
  },
  onStart() {
    ui.started = true;
    hideScreen();
    showBanner('Round 1 — your move');
    refresh();
  },
  onRestart() {
    state = createGame((Date.now() % 2147483647) || 1);
    ui = { selectedUid: null, paused: false, started: true };
    shotMode = null;
    hideScreen();
    showBanner('Round 1 — your move');
    refresh();
  },
  onResume() {
    ui.paused = false;
    hideScreen();
  },
  onPause() {
    if (shotMode || !ui.started || state.phase !== 'play') return;
    ui.paused = !ui.paused;
    if (ui.paused) showPauseScreen();
    else hideScreen();
  },
  onToggleSound() {
    setMuted(!isMuted());
    refresh();
  },
};

installInput(handlers);
refresh();
if (shotMode === 'over') showEndScreen(state);
else if (shotMode !== 'play') showTitleScreen();
