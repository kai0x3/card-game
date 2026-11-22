# Ember Lanes

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/kai0x3/card-game/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/kai0x3/card-game/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

**A duel of ember and ash — you against the Ash Baron.** An original
three-lane card battler that runs offline in a desktop browser from its own
static files. Built for the [best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826) on make.fun.

## How it plays

- Both heroes start at **20 life**. Reduce the Ash Baron to 0.
- Each round your **ember** grows by one (cap 10); unspent ember banks up to
  +2, so saving for the big cards is a real choice.
- Click a card, then a lane. Creatures fight at the end of the round; a lone
  creature strikes the enemy hero instead.
- Each lane blesses its creatures: **Ember Vent +1 attack**, **Stone Circle
  +1 health**, **Moon Gate heals 1** each round. Where you play matters as
  much as what you play.
- Ten original cards across four elements (Flame ▲, Tide ●, Gale ◆,
  Stone ■), with real abilities: **Swift** strikes first, **Chill** saps 1
  attack, **Thorns** answers back, **Spark** burns the hero, **Heal** and
  **Draw** on play.
- The Ash Baron plays a readable heuristic — it trades up, guards a winning
  lane, heals when hurt — and you can answer the lane it just filled.

Keys: **1–7** pick a card, **Q W E** pick a lane, **Enter** end turn,
**Esc** pause, **R** restart. Mouse works for everything too. Sound is
synthesised in code; nothing is fetched.

## Play it

Serve `game/` with any static server (or `node serve.ts`) and open
`http://localhost:8080`. No build step, no network requests.

## Layout

- `game/index.html` — the shell
- `game/styles.css` — table, cards, screens, animations
- `game/src/main.js` — bootstrap and turn flow
- `game/src/engine.js` — the pure rules (no DOM; tested headlessly)
- `game/src/cards.js` — the ten card types and the deck
- `game/src/ai.js` — the Ash Baron's heuristic
- `game/src/render.js` — the table, hands, heroes, screens
- `game/src/input.js` — mouse and keyboard
- `game/src/audio.js` — synthesised sound
- `game/src/shots.js` — the `?shot=` screenshot scenes
- `game/src/rng.js` — seeded randomness
- `main.ts` — hands the entry in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
