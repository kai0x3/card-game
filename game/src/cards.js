// The cards of Ember Lanes. Ten original types, two copies each, twenty cards
// in a deck. Four elements, told apart by colour AND shape, never by text
// alone: Flame is a red triangle, Tide a blue circle, Gale a green diamond,
// Stone a amber square.
import { shuffleInPlace } from './rng.js';

export const ELEMENTS = {
  flame: { name: 'Flame', color: '#e2483d', dark: '#8f1d16', shape: 'triangle', glyph: '▲' },
  tide: { name: 'Tide', color: '#3d8fe2', dark: '#174a8f', shape: 'circle', glyph: '●' },
  gale: { name: 'Gale', color: '#3fae6a', dark: '#1c5c33', shape: 'diamond', glyph: '◆' },
  stone: { name: 'Stone', color: '#d9a441', dark: '#7a5514', shape: 'square', glyph: '■' },
};

// ability: 'spark' deals 1 to the enemy hero when played; 'heal' restores 2 to
// your hero when played; 'draw' draws a card when played; 'swift' strikes
// first in its lane and takes no damage if it kills; 'chill' makes the enemy
// creature in the same lane lose 1 attack while this lives; 'thorns' deals 1
// damage back to any creature that fights it.
export const CARD_TYPES = [
  { id: 'imp', name: 'Spark Imp', element: 'flame', cost: 1, atk: 2, hp: 1, text: 'A quick little ember.' },
  { id: 'sprite', name: 'Ember Sprite', element: 'flame', cost: 1, atk: 1, hp: 1, text: 'Spark: deal 1 to the enemy hero.', ability: 'spark' },
  { id: 'pup', name: 'Cinder Pup', element: 'flame', cost: 2, atk: 3, hp: 2, text: 'Bites first, asks never.' },
  { id: 'wisp', name: 'Frost Wisp', element: 'tide', cost: 2, atk: 2, hp: 3, text: 'Chill: enemy in this lane −1 attack.', ability: 'chill' },
  { id: 'hawk', name: 'Gale Hawk', element: 'gale', cost: 2, atk: 3, hp: 2, text: 'Swift: strikes first in its lane.', ability: 'swift' },
  { id: 'serpent', name: 'Tide Serpent', element: 'tide', cost: 3, atk: 3, hp: 4, text: 'Heal your hero for 2.', ability: 'heal' },
  { id: 'bramble', name: 'Thorn Bramble', element: 'gale', cost: 3, atk: 2, hp: 5, text: 'Thorns: 1 damage back when fought.', ability: 'thorns' },
  { id: 'golem', name: 'Stone Golem', element: 'stone', cost: 4, atk: 2, hp: 6, text: 'It has never once hurried.' },
  { id: 'moth', name: 'Moon Moth', element: 'gale', cost: 4, atk: 4, hp: 4, text: 'Draw a card when played.', ability: 'draw' },
  { id: 'colossus', name: 'Molten Colossus', element: 'flame', cost: 6, atk: 6, hp: 6, text: 'The mountain, awake.' },
];

const BY_ID = new Map(CARD_TYPES.map((t) => [t.id, t]));

export function cardDef(id) {
  return BY_ID.get(id);
}

/** A fresh 20-card deck (two copies of each type), shuffled with the seed. */
export function buildDeck(rand) {
  const cards = [];
  let uid = 0;
  for (const type of CARD_TYPES) {
    for (let copy = 0; copy < 2; copy += 1) {
      cards.push({ uid: uid++, type: type.id, hp: type.hp });
    }
  }
  return shuffleInPlace(cards, rand);
}

/** The number in the ember gem: what a card costs to play. */
export function cardCost(card) {
  return cardDef(card.type).cost;
}
