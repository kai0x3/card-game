// Interactive playtest for Ember Lanes (not shipped): drives the real page
// over Chrome DevTools Protocol with Node's built-in WebSocket client.
const SHELL = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell`;
const { spawn } = await import('node:child_process');

const chrome = spawn(SHELL, [
  '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=9223', '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:9223${path}`);
      if (r.ok) return r.json();
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('CDP did not come up');
}

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures += 1;
}

try {
  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description ?? ''));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:8091/?seed=11' });
  await sleep(2500);

  check('title screen shows on fresh load', await evalJs(`!!document.querySelector('#screen .game-title')`));
  check('score line renders', (await evalJs(`document.querySelector('#score-line').textContent`)).includes('Round 1'));
  check('hand has 3 cards', await evalJs(`document.querySelectorAll('#hand .card').length`) === 3);
  check('Baron has 4 card backs', await evalJs(`document.querySelectorAll('#foe-hand .card-back').length`) === 4);

  // Start the duel, play the first affordable card into lane 1, end the turn.
  await evalJs(`document.querySelector('[data-action="start"]').click()`);
  await sleep(300);
  check('title screen hides after Start', await evalJs(`document.querySelector('#screen').classList.contains('hidden')`));
  const handBefore = await evalJs(`document.querySelectorAll('#hand .card').length`);
  await evalJs(`document.querySelector('#hand .hand-card:not(.poor) .card').click()`);
  await sleep(200);
  check('clicking a hand card selects it', await evalJs(`!!document.querySelector('#hand .hand-card.selected')`));
  await evalJs(`document.querySelector('.lane[data-lane="0"] .slot.empty')?.click()`);
  await sleep(300);
  const handAfter = await evalJs(`document.querySelectorAll('#hand .card').length`);
  const laneFilled = await evalJs(`!!document.querySelector('.lane[data-lane="0"] .you-slot .card')`);
  check('card leaves hand into lane 0', handAfter === handBefore - 1 && laneFilled, `hand ${handBefore} -> ${handAfter}`);
  await evalJs(`document.querySelector('#end-turn').click()`);
  await sleep(800);
  const round = await evalJs(`document.querySelector('#score-line').textContent`);
  check('End Turn advances to round 2', round.includes('Round 2'), round);
  check('log has entries after the round', await evalJs(`document.querySelectorAll('#log-list li').length`) >= 1);
  check('no JS errors', errors.length === 0, errors.join(' | '));
  ws.close();
} finally {
  chrome.kill();
}
console.log(failures === 0 ? 'ALL INTERACTIVE CHECKS PASSED' : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
