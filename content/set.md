---
title: "SET"
---

[SET](https://en.wikipedia.org/wiki/Set_(card_game)) is a card game by Marsha Falco. Each card has four features — shape, color, number, and shading — each with three values. A *set* is three cards where every feature is either all the same or all different across the three.

Play solo against a bot, take it slow in zen mode, or challenge a friend in a private room.

<div id="set-app" style="font-family: inherit; max-width: 760px; margin: 0 auto;">

  <div style="display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb;">
    <button id="tab-ai" onclick="setApp.setMode('ai')"
      style="padding: 8px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #3b82f6; border-bottom: 2px solid #3b82f6; margin-bottom: -2px;">
      Solo vs Bot
    </button>
    <button id="tab-zen" onclick="setApp.setMode('zen')"
      style="padding: 8px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 2px solid transparent; margin-bottom: -2px;">
      Zen
    </button>
    <button id="tab-versus" onclick="setApp.setMode('versus')"
      style="padding: 8px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 2px solid transparent; margin-bottom: -2px;">
      Versus
    </button>
  </div>

  <!-- Mode-specific controls -->
  <div id="mode-controls" style="margin-bottom: 14px;"></div>

  <!-- Accessibility controls -->
  <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: #6b7280; margin-bottom: 12px;">
    <span>Palette:</span>
    <button id="palette-standard" onclick="setApp.setPalette('standard')"
      style="padding: 4px 12px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 4px; cursor: pointer; font-size: 13px;">Standard</button>
    <button id="palette-cb" onclick="setApp.setPalette('cb')"
      style="padding: 4px 12px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 4px; cursor: pointer; font-size: 13px;">Color-blind friendly</button>
  </div>

  <!-- Scoreboard / status line -->
  <div id="scoreboard" style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; color: #374151; min-height: 22px;"></div>

  <!-- Board grid -->
  <div id="board" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; max-width: 540px;"></div>

  <!-- Action row -->
  <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;">
    <button id="btn-add3" onclick="setApp.addThree()"
      style="padding: 8px 16px; background: #e5e7eb; border: 1px solid #9ca3af; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: #1f2937;">
      Add 3 cards
    </button>
    <button id="btn-hint" onclick="setApp.hint()"
      style="padding: 8px 16px; background: #e5e7eb; border: 1px solid #9ca3af; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: #1f2937; display: none;">
      Hint
    </button>
    <button id="btn-restart" onclick="setApp.restart()"
      style="padding: 8px 16px; background: #e5e7eb; border: 1px solid #9ca3af; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: #1f2937;">
      New game
    </button>
    <span id="status" style="font-size: 13px; color: #6b7280;"></span>
  </div>

  <!-- Captured sets -->
  <div id="captured" style="font-size: 12px; color: #6b7280;"></div>

</div>

<script>
(function() {

// ── Constants ────────────────────────────────────────────────────────────────

const PALETTES = {
  standard: ['#dc2626', '#16a34a', '#7c3aed'],              // red, green, purple
  cb:       ['#d55e00', '#0072b2', '#000000'],              // vermillion, blue, black (Okabe-Ito)
};
const COLOR_LABELS = {
  standard: ['red', 'green', 'purple'],
  cb:       ['orange', 'blue', 'black'],
};
let COLORS = PALETTES.standard;
const SHAPES = ['diamond', 'squiggle', 'oval'];
const FILLS  = ['solid', 'striped', 'empty'];

const VERSUS_URL = 'wss://robby-set.fly.dev';               // set server (see /set-server)

// ── Deck ─────────────────────────────────────────────────────────────────────

function buildDeck() {
  const deck = [];
  let id = 0;
  for (let shape = 0; shape < 3; shape++)
    for (let color = 0; color < 3; color++)
      for (let qty = 0; qty < 3; qty++)
        for (let fill = 0; fill < 3; fill++)
          deck.push({ id: id++, shape, color, qty, fill });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isSet(a, b, c) {
  for (const k of ['shape', 'color', 'qty', 'fill']) {
    const s = new Set([a[k], b[k], c[k]]);
    if (s.size === 2) return false;
  }
  return true;
}

function findThird(a, b) {
  const t = {};
  for (const k of ['shape', 'color', 'qty', 'fill']) {
    t[k] = a[k] === b[k] ? a[k] : 3 - a[k] - b[k];
  }
  return t;
}

function findAllSets(cards) {
  const out = [];
  for (let i = 0; i < cards.length - 2; i++)
    for (let j = i + 1; j < cards.length - 1; j++)
      for (let k = j + 1; k < cards.length; k++)
        if (isSet(cards[i], cards[j], cards[k])) out.push([i, j, k]);
  return out;
}

// ── SVG card rendering ───────────────────────────────────────────────────────

const SHAPE_PATHS = {
  diamond:  'M 30 5 L 55 25 L 30 45 L 5 25 Z',
  oval:     'M 18 5 Q 5 5 5 25 Q 5 45 18 45 L 42 45 Q 55 45 55 25 Q 55 5 42 5 Z',
  squiggle: 'M 5 12 Q 15 -3 30 12 Q 45 27 55 12 L 55 38 Q 45 53 30 38 Q 15 23 5 38 Z'
};

function symbolSvg(card, w) {
  const color = COLORS[card.color];
  const shape = SHAPES[card.shape];
  const path = SHAPE_PATHS[shape];
  const fill = FILLS[card.fill];
  const stripeId = `stripe-${card.color}`;
  let fillAttr;
  if (fill === 'solid')       fillAttr = color;
  else if (fill === 'empty')  fillAttr = 'none';
  else                        fillAttr = `url(#${stripeId})`;

  return `<svg viewBox="0 0 60 50" width="${w}" style="display:block;">
    <defs>
      <pattern id="${stripeId}" patternUnits="userSpaceOnUse" width="6" height="6">
        <line x1="0" y1="0" x2="0" y2="6" stroke="${color}" stroke-width="1.6"/>
      </pattern>
    </defs>
    <path d="${path}" fill="${fillAttr}" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>`;
}

function cardSvg(card, opts = {}) {
  const w = opts.width || 120;
  // Symbols are laid out horizontally on landscape cards.
  // Each symbol's SVG has a 60:50 viewBox; render at ~28px wide so 3 fit in a 120px card with padding.
  const symW = Math.round(w * 0.24);
  const symbols = Array(card.qty + 1).fill(0).map(() => symbolSvg(card, symW)).join('');
  return `<div style="display:flex; flex-direction:row; gap:4px; align-items:center; justify-content:center; width:100%; height:100%;">${symbols}</div>`;
}

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  mode: 'ai',
  deck: [],         // remaining draw pile
  board: [],        // cards on table
  selected: [],     // selected indices into board
  scores: { user: 0, bot: 0 },
  errors: { user: 0, bot: 0 },
  capturedByUser: [],
  capturedByBot: [],
  difficulty: 'medium',
  botTimer: null,
  botSpeedMs: 1800,
  locked: false,    // input frozen during animation
  ended: false,
  // versus
  ws: null,
  room: null,
  playerId: null,
  playerName: null,
  versusState: null,
  palette: 'standard',
};

try {
  const saved = localStorage.getItem('setPalette');
  if (saved === 'standard' || saved === 'cb') {
    state.palette = saved;
    COLORS = PALETTES[saved];
  }
} catch (e) {}

// ── Board operations ─────────────────────────────────────────────────────────

function newGame() {
  clearTimeout(state.botTimer);
  state.deck = shuffle(buildDeck());
  state.board = state.deck.splice(0, 12);
  state.selected = [];
  state.scores = { user: 0, bot: 0 };
  state.errors = { user: 0, bot: 0 };
  state.capturedByUser = [];
  state.capturedByBot = [];
  state.locked = false;
  state.ended = false;
  setStatus('');
  render();
  if (state.mode === 'ai') scheduleBot();
}

function ensureBoardHasSet() {
  while (findAllSets(state.board).length === 0 && state.deck.length >= 3) {
    state.board.push(...state.deck.splice(0, 3));
  }
}

function maybeEndGame() {
  if (state.deck.length === 0 && findAllSets(state.board).length === 0) {
    state.ended = true;
    state.locked = true;
    clearTimeout(state.botTimer);
    if (state.mode === 'ai') {
      const u = state.scores.user, b = state.scores.bot;
      const msg = u > b ? `You win, ${u} – ${b}` : u < b ? `Bot wins, ${b} – ${u}` : `Tie, ${u} – ${u}`;
      setStatus(msg);
    } else if (state.mode === 'zen') {
      setStatus(`Done — you found ${state.capturedByUser.length} sets.`);
    }
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function render() {
  renderControls();
  renderPaletteButtons();
  renderScoreboard();
  renderBoard();
  renderCaptured();
  updateActionButtons();
}

function renderPaletteButtons() {
  for (const p of ['standard', 'cb']) {
    const el = document.getElementById(`palette-${p}`);
    if (!el) continue;
    const active = state.palette === p;
    el.style.borderColor = active ? '#3b82f6' : '#d1d5db';
    el.style.background = active ? '#dbeafe' : 'white';
    el.style.color = active ? '#1e3a8a' : '#374151';
  }
}

function setPalette(p) {
  if (!PALETTES[p] || p === state.palette) return;
  state.palette = p;
  COLORS = PALETTES[p];
  try { localStorage.setItem('setPalette', p); } catch (e) {}
  render();
}

function renderControls() {
  const el = document.getElementById('mode-controls');
  if (state.mode === 'ai') {
    el.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: #6b7280;">
        <span>Difficulty:</span>
        ${['easy', 'medium', 'hard'].map(d => `
          <button onclick="setApp.setDifficulty('${d}')"
            style="padding: 4px 12px; border: 1px solid ${state.difficulty === d ? '#3b82f6' : '#d1d5db'};
                   background: ${state.difficulty === d ? '#dbeafe' : 'white'};
                   color: ${state.difficulty === d ? '#1e3a8a' : '#374151'};
                   border-radius: 4px; cursor: pointer; font-size: 13px; text-transform: capitalize;">${d}</button>
        `).join('')}
      </div>`;
  } else if (state.mode === 'zen') {
    el.innerHTML = `<div style="font-size: 13px; color: #6b7280;">No timer, no opponent. Click three cards to claim a set.</div>`;
  } else if (state.mode === 'versus') {
    if (!state.ws) {
      el.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px;">
          <input id="versus-name" placeholder="Your name" maxlength="20"
            style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 140px;"
            value="${state.playerName || ''}">
          <input id="versus-room" placeholder="Room code (blank = new)" maxlength="8"
            style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 180px; text-transform: uppercase;">
          <button onclick="setApp.joinVersus()"
            style="padding: 6px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
            Join / Create
          </button>
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">
          A room code lets friends join the same game from any device.
        </div>`;
    } else {
      el.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 14px; color: #1f2937;">
          <span>Room <strong style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #1e3a8a; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 15px; letter-spacing: 1px;">${state.room}</strong></span>
          <button onclick="setApp.leaveVersus()"
            style="padding: 4px 12px; background: white; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 13px; color: #374151;">Leave</button>
        </div>`;
    }
  }
}

function renderScoreboard() {
  const el = document.getElementById('scoreboard');
  if (state.mode === 'ai') {
    el.innerHTML = `
      <span><strong>You:</strong> ${state.scores.user} ${state.scores.user === 1 ? 'set' : 'sets'} ${state.errors.user ? `(${state.errors.user} wrong)` : ''}</span>
      <span><strong>Bot:</strong> ${state.scores.bot} ${state.scores.bot === 1 ? 'set' : 'sets'}</span>
      <span style="color: #6b7280;">Deck: ${state.deck.length}</span>`;
  } else if (state.mode === 'zen') {
    el.innerHTML = `
      <span><strong>Sets found:</strong> ${state.capturedByUser.length}</span>
      <span style="color: #6b7280;">Deck: ${state.deck.length}</span>`;
  } else if (state.mode === 'versus') {
    if (!state.versusState) { el.innerHTML = ''; return; }
    const players = state.versusState.players || [];
    el.innerHTML = players.map(p => `
      <span style="${p.id === state.playerId ? 'font-weight: 600; color: #1e3a8a;' : ''}">
        ${p.name}: ${p.score} ${p.score === 1 ? 'set' : 'sets'}${p.errors ? ` (${p.errors} wrong)` : ''}
      </span>
    `).join('') + `<span style="color: #6b7280;">Deck: ${state.versusState.deckSize}</span>`;
  }
}

function renderBoard() {
  const el = document.getElementById('board');
  const cards = state.mode === 'versus' && state.versusState ? state.versusState.board : state.board;
  if (!cards || !cards.length) { el.innerHTML = ''; return; }
  el.innerHTML = cards.map((card, i) => {
    if (!card) return `<div style="width:120px; height:80px;"></div>`;
    const isSel = state.selected.includes(i);
    return `<div onclick="setApp.clickCard(${i})"
      style="width: 120px; height: 80px; border-radius: 8px; cursor: pointer;
             background: white; border: 2px solid ${isSel ? '#3b82f6' : '#e5e7eb'};
             box-shadow: ${isSel ? '0 0 0 3px #dbeafe' : '0 1px 2px rgba(0,0,0,0.04)'};
             display: flex; align-items: center; justify-content: center;
             transition: border-color 0.1s, box-shadow 0.1s;">
      ${cardSvg(card, { width: 100 })}
    </div>`;
  }).join('');
}

function renderCaptured() {
  const el = document.getElementById('captured');
  if (state.mode === 'zen' && state.capturedByUser.length > 0) {
    el.innerHTML = `<div style="margin-top:6px;">Last set: ${state.capturedByUser[state.capturedByUser.length-1].map(c => describeCard(c)).join(' · ')}</div>`;
  } else {
    el.innerHTML = '';
  }
}

function describeCard(c) {
  const colors = COLOR_LABELS[state.palette];
  const shapes = ['diamond', 'squiggle', 'oval'];
  const fills = ['solid', 'striped', 'empty'];
  return `${c.qty + 1} ${fills[c.fill]} ${colors[c.color]} ${shapes[c.shape]}${c.qty > 0 ? 's' : ''}`;
}

function updateActionButtons() {
  const add3 = document.getElementById('btn-add3');
  const hint = document.getElementById('btn-hint');
  const board = state.mode === 'versus' && state.versusState ? state.versusState.board : state.board;
  const deckSize = state.mode === 'versus' && state.versusState ? state.versusState.deckSize : state.deck.length;

  // Add 3: allowed when deck has cards and board ≤ 12 (anything more is already extended)
  const canAdd = !state.ended && deckSize > 0 && board && board.filter(Boolean).length <= 12;
  add3.disabled = !canAdd;
  add3.style.opacity = canAdd ? '1' : '0.4';
  add3.style.cursor = canAdd ? 'pointer' : 'not-allowed';

  hint.style.display = state.mode === 'zen' ? 'inline-block' : 'none';
}

function setStatus(msg, color) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = color || '#6b7280';
}

// ── Input ────────────────────────────────────────────────────────────────────

function clickCard(idx) {
  if (state.locked || state.ended) return;
  if (state.mode === 'versus' && !state.ws) return;

  const board = state.mode === 'versus' ? state.versusState.board : state.board;
  if (!board[idx]) return;

  const pos = state.selected.indexOf(idx);
  if (pos >= 0) state.selected.splice(pos, 1);
  else state.selected.push(idx);

  if (state.selected.length === 3) {
    submitSelection();
  } else {
    renderBoard();
  }
}

function submitSelection() {
  if (state.mode === 'versus') {
    state.ws.send(JSON.stringify({ type: 'claim', indices: state.selected.slice() }));
    state.locked = true;
    renderBoard();
    return;
  }

  const board = state.board;
  const [a, b, c] = state.selected;
  const cards = [board[a], board[b], board[c]];

  if (isSet(...cards)) {
    handleValidSet('user', state.selected.slice());
  } else {
    handleInvalidSet('user');
  }
}

function handleValidSet(who, indices) {
  state.locked = true;
  const cards = indices.map(i => state.board[i]);

  // Flash selected blue/green briefly, then remove
  // (simple approach: just clear and refill)
  for (const i of indices) state.board[i] = null;

  if (who === 'user') {
    state.scores.user++;
    state.capturedByUser.push(cards);
    setStatus('Nice — that\'s a set.', '#16a34a');
  } else {
    state.scores.bot++;
    state.capturedByBot.push(cards);
    setStatus('Bot found a set.', '#6b7280');
  }
  state.selected = [];

  setTimeout(() => {
    refillBoard();
    state.locked = false;
    render();
    maybeEndGame();
    if (!state.ended && state.mode === 'ai') scheduleBot();
  }, 600);
}

function refillBoard() {
  // If board has > 12 cards (i.e. someone hit Add 3 earlier), don't refill — just compact.
  const filled = state.board.filter(Boolean);
  if (state.board.length > 12) {
    state.board = filled.concat(Array(state.board.length - filled.length).fill(null));
    // Trim trailing nulls if board is now <= 12
    while (state.board.length > 12 && state.board[state.board.length - 1] === null) {
      state.board.pop();
    }
    if (state.board.length < 12) {
      // pad with new draws
      while (state.board.length < 12 && state.deck.length > 0) {
        state.board.push(state.deck.shift());
      }
    }
    ensureBoardHasSet();
    return;
  }
  // Normal 12-board: replace each removed card from deck
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null && state.deck.length > 0) {
      state.board[i] = state.deck.shift();
    }
  }
  // Compact nulls if deck is empty
  state.board = state.board.filter(c => c !== null);
  ensureBoardHasSet();
}

function handleInvalidSet(who) {
  state.locked = true;
  setStatus(who === 'user' ? 'Not a set.' : '', '#dc2626');
  if (who === 'user') state.errors.user++;
  // Briefly show red border then deselect
  const el = document.getElementById('board');
  const sel = state.selected.slice();
  state.selected.forEach(i => {
    const card = el.children[i];
    if (card) { card.style.borderColor = '#dc2626'; card.style.boxShadow = '0 0 0 3px #fecaca'; }
  });
  setTimeout(() => {
    state.selected = [];
    state.locked = false;
    render();
  }, 700);
}

function addThree() {
  if (state.mode === 'versus') {
    if (state.ws) state.ws.send(JSON.stringify({ type: 'add3' }));
    return;
  }
  if (state.ended || state.deck.length === 0) return;
  if (state.board.filter(Boolean).length > 12) return;
  state.board.push(...state.deck.splice(0, 3));
  render();
  maybeEndGame();
}

function hint() {
  if (state.mode !== 'zen') return;
  const cards = state.board.filter(Boolean);
  const sets = findAllSets(cards);
  if (sets.length === 0) { setStatus('No set on the board — try Add 3.', '#dc2626'); return; }
  // Highlight one card from a random set
  const set = sets[Math.floor(Math.random() * sets.length)];
  const hintCard = cards[set[0]];
  const idx = state.board.indexOf(hintCard);
  state.selected = [idx];
  setStatus('One card of a valid set is highlighted.', '#3b82f6');
  renderBoard();
}

function restart() {
  if (state.mode === 'versus') {
    if (state.ws) state.ws.send(JSON.stringify({ type: 'restart' }));
    return;
  }
  newGame();
}

// ── Bot ──────────────────────────────────────────────────────────────────────

function scheduleBot() {
  clearTimeout(state.botTimer);
  if (state.mode !== 'ai' || state.ended || state.locked) return;
  state.botTimer = setTimeout(botStep, state.botSpeedMs + Math.random() * 600);
}

function botStep() {
  if (state.mode !== 'ai' || state.ended || state.locked) return;
  // Random-sample approach (matches original game): pick 2 cards, compute third, check presence.
  const filled = state.board.map((c, i) => c ? i : -1).filter(i => i >= 0);
  if (filled.length < 3) { scheduleBot(); return; }
  const i = filled[Math.floor(Math.random() * filled.length)];
  let j = filled[Math.floor(Math.random() * filled.length)];
  while (j === i) j = filled[Math.floor(Math.random() * filled.length)];
  const third = findThird(state.board[i], state.board[j]);
  const k = state.board.findIndex(c => c && c.shape === third.shape && c.color === third.color && c.qty === third.qty && c.fill === third.fill);
  if (k >= 0 && k !== i && k !== j) {
    handleValidSet('bot', [i, j, k]);
  } else {
    scheduleBot();
  }
}

function setDifficulty(d) {
  state.difficulty = d;
  state.botSpeedMs = d === 'easy' ? 2400 : d === 'medium' ? 1500 : 800;
  render();
}

// ── Versus (WebSocket client) ────────────────────────────────────────────────

function joinVersus() {
  const name = (document.getElementById('versus-name').value || '').trim() || 'Player';
  const room = (document.getElementById('versus-room').value || '').trim().toUpperCase();
  state.playerName = name;
  setStatus('Connecting…', '#6b7280');

  let ws;
  try { ws = new WebSocket(VERSUS_URL); }
  catch (e) { setStatus('Could not connect to versus server.', '#dc2626'); return; }

  ws.onopen = () => {
    setStatus('Connected.', '#16a34a');
    ws.send(JSON.stringify({ type: 'join', name, room: room || null }));
  };
  ws.onmessage = (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    handleVersusMessage(msg);
  };
  ws.onclose = () => {
    setStatus('Disconnected.', '#6b7280');
    state.ws = null;
    state.versusState = null;
    render();
  };
  ws.onerror = () => {
    setStatus('Versus server unavailable.', '#dc2626');
  };
  state.ws = ws;
}

function leaveVersus() {
  if (state.ws) state.ws.close();
  state.ws = null;
  state.room = null;
  state.versusState = null;
  state.selected = [];
  render();
}

function handleVersusMessage(msg) {
  if (msg.type === 'joined') {
    state.room = msg.room;
    state.playerId = msg.playerId;
    render();
  } else if (msg.type === 'state') {
    state.versusState = msg.state;
    state.ended = !!msg.state.ended;
    state.locked = false;
    state.selected = [];
    render();
  } else if (msg.type === 'result') {
    if (msg.valid) {
      setStatus(msg.by === state.playerId ? 'You got it.' : `${msg.byName} got it.`,
                msg.by === state.playerId ? '#16a34a' : '#6b7280');
    } else {
      setStatus(msg.by === state.playerId ? 'Not a set.' : '', '#dc2626');
    }
    state.selected = [];
    state.locked = false;
  } else if (msg.type === 'ended') {
    setStatus(`Game over. Winner: ${msg.winnerName || 'tie'}.`, '#1e3a8a');
    state.ended = true;
  } else if (msg.type === 'error') {
    setStatus(msg.message || 'Error', '#dc2626');
    state.locked = false;
  }
}

// ── Mode switching ───────────────────────────────────────────────────────────

function setMode(m) {
  if (m === state.mode) return;
  // Tab styling
  ['ai', 'zen', 'versus'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const active = t === m;
    el.style.color = active ? '#3b82f6' : '#6b7280';
    el.style.borderBottom = active ? '2px solid #3b82f6' : '2px solid transparent';
  });

  // Tear down previous mode
  clearTimeout(state.botTimer);
  if (state.mode === 'versus' && state.ws) {
    state.ws.close();
    state.ws = null;
    state.versusState = null;
  }

  state.mode = m;
  state.selected = [];
  state.ended = false;
  state.locked = false;

  if (m === 'ai' || m === 'zen') newGame();
  else render();
}

// ── Public API ───────────────────────────────────────────────────────────────

window.setApp = {
  setMode, setDifficulty, setPalette, clickCard, addThree, hint, restart,
  joinVersus, leaveVersus,
};

// ── Init ─────────────────────────────────────────────────────────────────────

newGame();

})();
</script>
