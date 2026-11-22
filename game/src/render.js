// Everything the player sees: the table, the hands, the hero bars, the log
// and the screens. The engine stays pure; this module turns a state into
// DOM, and turns combat events into floating numbers and shakes. All art is
// drawn here in code — simple geometric creature glyphs, one per card type.
import { CARD_TYPES, ELEMENTS, cardDef } from './cards.js';
import { LANE_BONUS, LANES, effectiveAttack, strikesFirst } from './engine.js';

/** One creature glyph per card type: simple shapes, drawn in code. */
export function glyphFor(typeId) {
  const art = {
    imp: '<path d="M32 8 L44 30 L20 30 Z" /><circle cx="32" cy="26" r="5" />',
    sprite: '<path d="M32 6 L37 26 L58 32 L37 38 L32 58 L27 38 L6 32 L27 26 Z" />',
    pup: '<circle cx="32" cy="38" r="16" /><path d="M18 28 L14 10 L30 20 Z" /><path d="M46 28 L50 10 L34 20 Z" />',
    wisp: '<circle cx="32" cy="32" r="13" /><path d="M32 12 L32 52 M12 32 L52 32 M18 18 L46 46 M46 18 L18 46" stroke-width="3" />',
    hawk: '<path d="M6 44 Q32 10 58 44 Q44 34 32 40 Q20 34 6 44 Z" />',
    serpent: '<path d="M10 44 Q20 20 32 40 Q44 56 54 30" fill="none" stroke-width="5" />',
    bramble: '<path d="M32 56 L32 26 M32 36 L18 22 M32 36 L46 22 M32 26 L24 12 M32 26 L40 12" fill="none" stroke-width="4" />',
    golem: '<rect x="20" y="34" width="24" height="22" /><rect x="26" y="14" width="12" height="12" /><rect x="14" y="46" width="10" height="10" /><rect x="40" y="46" width="10" height="10" />',
    moth: '<ellipse cx="20" cy="32" rx="13" ry="17" transform="rotate(-24 20 32)" /><ellipse cx="44" cy="32" rx="13" ry="17" transform="rotate(24 44 32)" />',
    colossus: '<path d="M6 54 L24 16 L36 38 L44 24 L58 54 Z" />',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${art[typeId] ?? art.imp}</svg>`;
}

/** A card face. `mode` is 'hand' (full text) or 'lane' (compact, with health). */
export function cardHtml(card, mode, state, side, lane) {
  const def = cardDef(card.type);
  const el = ELEMENTS[def.element];
  const atk = mode === 'lane' ? effectiveAttack(state, side, lane) : def.atk;
  const hp = card.hp;
  const maxHp = card.maxHp ?? def.hp;
  const hurt = hp < maxHp;
  const swift = mode === 'lane' && strikesFirst(state, side, lane);
  const cost = `<span class="cost" title="Ember cost">${def.cost}</span>`;
  const stats = `<span class="stat atk" title="Attack">${atk}</span><span class="stat hp${hurt ? ' hurt' : ''}" title="Health">${hp}</span>`;
  const ability = def.ability ? `<span class="ability">${def.ability.toUpperCase()}</span>` : '';
  const text = mode === 'hand' ? `<div class="card-text">${def.text}</div>` : '';
  return `<div class="card el-${def.element}${swift ? ' swift' : ''}"${mode === 'hand' ? ` data-uid="${card.uid}" data-action="select-card"` : ''}>
    ${cost}
    <div class="card-name"><span class="shape" style="color:${el.color}">${el.glyph}</span> ${def.name}</div>
    <div class="card-art" style="color:${el.color}">${glyphFor(card.type)}</div>
    ${text}
    <div class="card-stats">${stats}${ability}</div>
  </div>`;
}

function heroHtml(state, side) {
  const p = state.players[side];
  const foe = side === 1;
  const pct = Math.max(0, (p.hero / p.maxHero) * 100);
  const gems = Array.from({ length: p.maxEmber }, (_, i) =>
    `<span class="gem${i < p.ember ? ' lit' : ''}" title="Ember"></span>`).join('');
  return `<div class="hero${foe ? ' foe' : ''}">
    <div class="hero-face ${foe ? 'baron' : 'warden'}">${foe ? '♜' : '♞'}</div>
    <div class="hero-info">
      <div class="hero-name">${p.name}</div>
      <div class="hpbar"><div class="hpfill" style="width:${pct}%"></div><span class="hptext">${Math.max(0, p.hero)} / ${p.maxHero}</span></div>
      <div class="embers" title="Ember: ${p.ember} of ${p.maxEmber}">${gems}<span class="ember-num">${p.ember}✦</span></div>
    </div>
  </div>`;
}

function laneHtml(state, lane) {
  const bonus = LANE_BONUS[lane];
  const foeCard = state.players[1].lanes[lane];
  const youCard = state.players[0].lanes[lane];
  const slot = (card, side) =>
    card
      ? cardHtml(card, 'lane', state, side, lane)
      : `<div class="slot empty" data-lane="${lane}" data-action="play-lane"><span>Empty lane</span></div>`;
  return `<div class="lane" data-lane="${lane}">
    <div class="lane-bonus"><span class="bonus-name">${bonus.name}</span><span class="bonus-text">${bonus.text}</span></div>
    <div class="lane-slot foe-slot">${slot(foeCard, 1)}</div>
    <div class="lane-mid"><span class="lane-num">${lane + 1}</span></div>
    <div class="lane-slot you-slot">${slot(youCard, 0)}</div>
  </div>`;
}

function handHtml(state, ui) {
  const you = state.players[0];
  const cards = you.hand
    .map((card) => {
      const afford = cardDef(card.type).cost <= you.ember;
      const selected = ui.selectedUid === card.uid;
      return `<div class="hand-card${afford ? '' : ' poor'}${selected ? ' selected' : ''}">${cardHtml(card, 'hand', state, 0, -1)}</div>`;
    })
    .join('');
  const backs = Array.from({ length: state.players[1].hand.length }, () =>
    `<div class="card-back" title="The Baron's hand"><span>♜</span></div>`).join('');
  return { cards, backs };
}

/** Build the static skeleton once; render() refreshes the changing parts. */
export function initRender(root) {
  root.innerHTML = `
  <div id="table">
    <header id="topbar">
      <div class="brand">EMBER LANES</div>
      <div id="score-line"></div>
      <div class="top-actions">
        <button id="sound-btn" data-action="toggle-sound" title="Sound on/off">♪ Sound</button>
        <button id="restart-btn" data-action="restart" title="Start a new game">↻ New game</button>
      </div>
    </header>
    <div id="foe-row">
      <div id="foe-hero"></div>
      <div id="foe-hand"></div>
    </div>
    <div id="lanes"></div>
    <div id="you-row">
      <div id="you-hero"></div>
      <div id="hand"></div>
      <button id="end-turn" data-action="end-turn">End Turn ⏎</button>
    </div>
  </div>
  <aside id="side">
    <div id="round-box"></div>
    <div id="log"><h2>Battle log</h2><ul id="log-list"></ul></div>
    <div id="help">
      <h2>How to play</h2>
      <p>Click a card, then a lane. Creatures fight at the end of the round; a lone creature hits the enemy hero. Reduce the Ash Baron to 0.</p>
      <p>Lanes bless their creatures: <b>Ember Vent +1 attack</b>, <b>Stone Circle +1 health</b>, <b>Moon Gate heals 1</b> each round.</p>
      <p>Keys: <b>1–7</b> pick a card, <b>Q W E</b> pick a lane, <b>Enter</b> end turn, <b>Esc</b> pause.</p>
    </div>
  </aside>
  <div id="banner" class="hidden"></div>
  <div id="screen" class="hidden"></div>
  <div id="floats"></div>`;
}

/** Redraw everything that changes with the state. */
export function render(state, ui) {
  const scoreLine = document.querySelector('#score-line');
  const you = state.players[0];
  const foe = state.players[1];
  scoreLine.textContent = `You ${Math.max(0, you.hero)} — ${Math.max(0, foe.hero)} Ash Baron · Round ${state.turn}`;

  document.querySelector('#foe-hero').innerHTML = heroHtml(state, 1);
  document.querySelector('#you-hero').innerHTML = heroHtml(state, 0);

  const { cards, backs } = handHtml(state, ui);
  document.querySelector('#foe-hand').innerHTML = backs;
  document.querySelector('#hand').innerHTML = cards;

  document.querySelector('#lanes').innerHTML =
    Array.from({ length: LANES }, (_, lane) => laneHtml(state, lane)).join('');

  const endBtn = document.querySelector('#end-turn');
  endBtn.disabled = state.phase !== 'play';
  endBtn.classList.toggle('ready', state.phase === 'play' && you.hand.some((c) => cardDef(c.type).cost <= you.ember));

  const roundBox = document.querySelector('#round-box');
  roundBox.innerHTML = `<div class="round-num">ROUND ${state.turn}</div>
    <div class="deck-line">Your deck: ${you.deck.length} cards · Baron's deck: ${foe.deck.length}</div>
    <div class="deck-line">Ember banked up to ${you.maxEmber + 2} — save for the big cards.</div>`;

  const logList = document.querySelector('#log-list');
  logList.innerHTML = state.log.slice(-8).map((line) => `<li>${line}</li>`).join('');
  logList.scrollTop = logList.scrollHeight;
}

/** A damage or heal number that floats up over a lane and fades away. */
export function spawnFloat(lane, text, kind) {
  const laneEl = document.querySelector(`.lane[data-lane="${lane}"]`);
  const floats = document.querySelector('#floats');
  if (!laneEl || !floats) return;
  const box = laneEl.getBoundingClientRect();
  const host = floats.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = `float ${kind}`;
  span.textContent = text;
  span.style.left = `${box.left - host.left + box.width / 2}px`;
  span.style.top = `${box.top - host.top + box.height / 2}px`;
  floats.appendChild(span);
  window.setTimeout(() => span.remove(), 1400);
}

/** A big sweep across the table: "Round 4", "The Baron plays…". */
export function showBanner(text) {
  const banner = document.querySelector('#banner');
  banner.textContent = text;
  banner.classList.remove('hidden');
  banner.classList.remove('sweep');
  void banner.offsetWidth;
  banner.classList.add('sweep');
  window.setTimeout(() => banner.classList.add('hidden'), 1600);
}

export function showTitleScreen() {
  const screen = document.querySelector('#screen');
  screen.className = 'screen title';
  screen.innerHTML = `
    <div class="panel">
      <div class="game-title">EMBER LANES</div>
      <div class="game-sub">A duel of ember and ash — you against the Ash Baron.</div>
      <div class="title-cards">
        <div class="mini-card el-flame"><span class="cost">6</span><div class="mini-art">▲</div><div class="mini-name">Molten Colossus</div><div class="mini-stats">6 ⚔ · 6 ♥</div></div>
        <div class="mini-card el-tide"><span class="cost">3</span><div class="mini-art">●</div><div class="mini-name">Tide Serpent</div><div class="mini-stats">3 ⚔ · 4 ♥</div></div>
        <div class="mini-card el-gale"><span class="cost">2</span><div class="mini-art">◆</div><div class="mini-name">Gale Hawk</div><div class="mini-stats">3 ⚔ · 2 ♥</div></div>
      </div>
      <p class="title-rules">Play creatures into three blessed lanes. They fight at the end of each round; a lone creature strikes the enemy hero. First hero to 0 loses.</p>
      <button class="big-btn" data-action="start">▶ &nbsp;Begin the duel</button>
      <p class="title-note">Click a card, then a lane · Keys 1–7, Q W E, Enter · Sound on</p>
    </div>`;
}

export function showEndScreen(state) {
  const screen = document.querySelector('#screen');
  const won = state.winner === 'you';
  const draw = state.winner === 'draw';
  const you = state.players[0];
  const foe = state.players[1];
  screen.className = `screen end ${won ? 'win' : 'lose'}`;
  screen.innerHTML = `
    <div class="panel">
      <div class="end-title">${draw ? 'A DRAW' : won ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="end-sub">${draw
        ? 'Both heroes fall together. The lanes keep their embers.'
        : won
          ? 'The Ash Baron crumbles to cinders. The lanes are yours.'
          : 'The Ash Baron stands over the ashes. Deal again.'}</div>
      <div class="end-score">You ${Math.max(0, you.hero)} — ${Math.max(0, foe.hero)} Ash Baron · ${state.turn} rounds</div>
      <button class="big-btn" data-action="restart">↻ &nbsp;Play again</button>
    </div>`;
}

export function showPauseScreen() {
  const screen = document.querySelector('#screen');
  screen.className = 'screen pause';
  screen.innerHTML = `
    <div class="panel">
      <div class="end-title">PAUSED</div>
      <div class="end-sub">The embers wait for you.</div>
      <button class="big-btn" data-action="resume">▶ &nbsp;Resume</button>
      <button class="big-btn ghost" data-action="restart">↻ &nbsp;New game</button>
    </div>`;
}

export function hideScreen() {
  const screen = document.querySelector('#screen');
  screen.className = 'hidden';
  screen.innerHTML = '';
}
