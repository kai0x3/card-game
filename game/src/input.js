// Mouse and keyboard for Ember Lanes. Clicks arrive through one delegated
// listener on the table (render marks every clickable thing with a
// data-action); keys are 1–7 to pick a hand card, Q/W/E to pick a lane,
// Enter to end the turn, Esc to pause, R to restart after the game ends.
export function installInput(handlers) {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'select-card') handlers.onSelectCard(Number(target.dataset.uid));
    else if (action === 'play-lane') handlers.onPlayLane(Number(target.dataset.lane));
    else if (action === 'end-turn') handlers.onEndTurn();
    else if (action === 'start') handlers.onStart();
    else if (action === 'restart') handlers.onRestart();
    else if (action === 'resume') handlers.onResume();
    else if (action === 'toggle-sound') handlers.onToggleSound();
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key >= '1' && key <= '7') handlers.onSelectCardIndex(Number(key) - 1);
    else if (key === 'q') handlers.onPlayLane(0);
    else if (key === 'w') handlers.onPlayLane(1);
    else if (key === 'e') handlers.onPlayLane(2);
    else if (key === 'enter') handlers.onEndTurn();
    else if (key === 'escape') handlers.onPause();
    else if (key === 'r') handlers.onRestart();
  });
}
