---
title: "Jigsaw Sudoku Solver"
---

A jigsaw Sudoku solver using [GLPK](https://www.gnu.org/software/glpk/). Paint the subgrid regions, fill in the known values, and then solve.

<div id="jigsaw-app" style="font-family: inherit; max-width: 600px; margin: 0 auto;">

  <div style="display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb;">
    <button id="tab-subgrid" onclick="setMode('subgrid')"
      style="padding: 8px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #3b82f6; border-bottom: 2px solid #3b82f6; margin-bottom: -2px;">
      1. Paint Subgrids
    </button>
    <button id="tab-values" onclick="setMode('values')"
      style="padding: 8px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px;">
      2. Enter Values
    </button>
  </div>

  <div id="palette" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center;">
    <span style="font-size: 13px; color: #6b7280; margin-right: 4px;">Subgrid:</span>
  </div>

  <!-- Subgrid counts -->
  <div id="counts" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; font-size: 12px;"></div>

  <!-- Instructions line -->
  <div id="instructions" style="font-size: 13px; color: #6b7280; margin-bottom: 10px;">
    Select a color, then click or drag cells to assign them to that subgrid. Each subgrid needs exactly 9 cells.
  </div>

  <!-- Grid -->
  <div id="grid" style="display: inline-grid; grid-template-columns: repeat(9, 1fr); gap: 0; border: 3px solid #1f2937; border-radius: 4px; user-select: none; margin-bottom: 16px;">
  </div>

  <!-- Controls -->
  <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 16px;">
    <button onclick="resetAll()"
      style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Reset
    </button>
    <button onclick="resetValues()"
      style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Clear Values
    </button>
    <button id="solve-btn" onclick="solve()"
      style="padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; opacity: 0.4; pointer-events: none;">
      Solve
    </button>
    <span id="status" style="font-size: 13px; color: #6b7280;"></span>
  </div>

  <!-- Result -->
  <div id="result-section" style="display: none;">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1f2937;">Solution</div>
    <div id="result-grid" style="display: inline-grid; grid-template-columns: repeat(9, 1fr); gap: 0; border: 3px solid #1f2937; border-radius: 4px; margin-bottom: 8px;"></div>
    <div style="font-size: 12px; color: #6b7280;">Bold = given &nbsp;·&nbsp; Regular = solved</div>
  </div>

</div>

<script>
(function() {

const COLORS = [
  { bg: '#fecaca', border: '#dc2626', text: '#7f1d1d', name: 'Red'    },
  { bg: '#fed7aa', border: '#ea580c', text: '#7c2d12', name: 'Orange' },
  { bg: '#fef08a', border: '#ca8a04', text: '#713f12', name: 'Yellow' },
  { bg: '#bbf7d0', border: '#16a34a', text: '#14532d', name: 'Green'  },
  { bg: '#99f6e4', border: '#0d9488', text: '#134e4a', name: 'Teal'   },
  { bg: '#bfdbfe', border: '#2563eb', text: '#1e3a8a', name: 'Blue'   },
  { bg: '#ddd6fe', border: '#7c3aed', text: '#4c1d95', name: 'Purple' },
  { bg: '#fbcfe8', border: '#db2777', text: '#831843', name: 'Pink'   },
  { bg: '#d1d5db', border: '#4b5563', text: '#111827', name: 'Gray'   },
];

const CELL_SIZE = 52;
const API_URL = 'https://robby-jigsaw.fly.dev';

let mode = 'subgrid';
let selectedSubgrid = 0;
let subgridMap = Array.from({length: 9}, () => Array(9).fill(-1));
let valueMap   = Array.from({length: 9}, () => Array(9).fill(0));
let solutionMap = null;
let isPainting = false;
let selectedCell = null; // [r, c]

// ── Build palette ────────────────────────────────────────────────────────────

const palette = document.getElementById('palette');
COLORS.forEach((c, i) => {
  const btn = document.createElement('button');
  btn.id = `palette-${i}`;
  btn.title = c.name;
  btn.style.cssText = `
    width: 32px; height: 32px; border-radius: 6px; cursor: pointer;
    background: ${c.bg}; border: 3px solid ${i === 0 ? c.border : '#d1d5db'};
    transition: border-color 0.1s;
  `;
  btn.onclick = () => selectSubgrid(i);
  palette.appendChild(btn);
});

// ── Build counts ─────────────────────────────────────────────────────────────

function renderCounts() {
  const counts = Array(9).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (subgridMap[r][c] >= 0) counts[subgridMap[r][c]]++;

  const el = document.getElementById('counts');
  el.innerHTML = '';
  COLORS.forEach((col, i) => {
    const span = document.createElement('span');
    span.style.cssText = `
      display: inline-flex; align-items: center; gap: 4px;
      background: ${col.bg}; border: 1px solid ${col.border};
      border-radius: 4px; padding: 2px 6px; color: ${col.text};
    `;
    const ok = counts[i] === 9;
    span.innerHTML = `<span style="font-size:11px;">${col.name}</span>
      <span style="font-weight:700; color:${ok ? '#16a34a' : counts[i] > 9 ? '#dc2626' : col.text};">
        ${counts[i]}/9
      </span>`;
    el.appendChild(span);
  });

  updateSolveButton(counts);
}

function updateSolveButton(counts) {
  const allGood = counts.every(c => c === 9);
  const btn = document.getElementById('solve-btn');
  btn.style.opacity = allGood ? '1' : '0.4';
  btn.style.pointerEvents = allGood ? 'auto' : 'none';
}

// ── Build grid ───────────────────────────────────────────────────────────────

const gridEl = document.getElementById('grid');

function buildGrid() {
  gridEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.id = `cell-${r}-${c}`;
      cell.style.cssText = `
        width: ${CELL_SIZE}px; height: ${CELL_SIZE}px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: 600;
        cursor: pointer; box-sizing: border-box;
        transition: filter 0.1s;
      `;
      cell.addEventListener('mousedown', e => { e.preventDefault(); onCellDown(r, c); });
      cell.addEventListener('mouseenter', () => { if (isPainting) onCellDown(r, c); });
      cell.addEventListener('click', () => onCellClick(r, c));
      gridEl.appendChild(cell);
    }
  }
  renderGrid();
}

function renderGrid() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.getElementById(`cell-${r}-${c}`);
      const sg = subgridMap[r][c];
      const val = valueMap[r][c];
      const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;

      // Background
      const bg = sg >= 0 ? COLORS[sg].bg : '#f9fafb';
      cell.style.background = isSelected ? '#93c5fd' : bg;

      // Borders — thick where subgrid changes, thin within same subgrid
      const bt = r === 0 ? '2px' : (subgridMap[r-1][c] !== sg ? '2px' : '1px');
      const bb = r === 8 ? '0'   : (subgridMap[r+1][c] !== sg ? '2px' : '1px');
      const bl = c === 0 ? '2px' : (subgridMap[r][c-1] !== sg ? '2px' : '1px');
      const br = c === 8 ? '0'   : (subgridMap[r][c+1] !== sg ? '2px' : '1px');
      const borderColor = sg >= 0 ? COLORS[sg].border : '#9ca3af';
      cell.style.borderTop    = `${bt} solid ${borderColor}`;
      cell.style.borderBottom = `${bb} solid ${borderColor}`;
      cell.style.borderLeft   = `${bl} solid ${borderColor}`;
      cell.style.borderRight  = `${br} solid ${borderColor}`;

      // Value
      if (mode === 'values' || mode === 'subgrid') {
        cell.textContent = val > 0 ? val : '';
        cell.style.color = sg >= 0 ? COLORS[sg].text : '#374151';
      }
    }
  }
}

// ── Interaction ──────────────────────────────────────────────────────────────

document.addEventListener('mouseup', () => { isPainting = false; });

function onCellDown(r, c) {
  if (mode !== 'subgrid') return;
  isPainting = true;
  subgridMap[r][c] = selectedSubgrid;
  solutionMap = null;
  document.getElementById('result-section').style.display = 'none';
  renderGrid();
  renderCounts();
}

function onCellClick(r, c) {
  if (mode !== 'values') return;
  selectedCell = [r, c];
  renderGrid();
}

document.addEventListener('keydown', e => {
  if (mode !== 'values' || !selectedCell) return;
  const [r, c] = selectedCell;

  if (e.key >= '1' && e.key <= '9') {
    valueMap[r][c] = parseInt(e.key);
    solutionMap = null;
    document.getElementById('result-section').style.display = 'none';
    renderGrid();
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    valueMap[r][c] = 0;
    solutionMap = null;
    document.getElementById('result-section').style.display = 'none';
    renderGrid();
  } else if (e.key === 'ArrowRight') { selectedCell = [r, Math.min(8, c+1)]; renderGrid(); }
  else if (e.key === 'ArrowLeft')    { selectedCell = [r, Math.max(0, c-1)]; renderGrid(); }
  else if (e.key === 'ArrowDown')    { selectedCell = [Math.min(8, r+1), c]; renderGrid(); }
  else if (e.key === 'ArrowUp')      { selectedCell = [Math.max(0, r-1), c]; renderGrid(); }
});

// ── Mode & subgrid selection ─────────────────────────────────────────────────

function selectSubgrid(i) {
  selectedSubgrid = i;
  COLORS.forEach((c, idx) => {
    const btn = document.getElementById(`palette-${idx}`);
    btn.style.border = `3px solid ${idx === i ? c.border : '#d1d5db'}`;
    btn.style.transform = idx === i ? 'scale(1.15)' : 'scale(1)';
  });
}

function setMode(m) {
  mode = m;
  selectedCell = null;

  document.getElementById('tab-subgrid').style.color      = m === 'subgrid' ? '#3b82f6' : '#6b7280';
  document.getElementById('tab-subgrid').style.borderBottom = m === 'subgrid' ? '2px solid #3b82f6' : '2px solid transparent';
  document.getElementById('tab-values').style.color       = m === 'values'  ? '#3b82f6' : '#6b7280';
  document.getElementById('tab-values').style.borderBottom  = m === 'values'  ? '2px solid #3b82f6' : '2px solid transparent';

  document.getElementById('palette').style.display  = m === 'subgrid' ? 'flex' : 'none';
  document.getElementById('counts').style.display   = m === 'subgrid' ? 'flex' : 'none';
  document.getElementById('instructions').textContent = m === 'subgrid'
    ? 'Select a color, then click or drag cells to assign them to that subgrid. Each subgrid needs exactly 9 cells.'
    : 'Click a cell, then type a digit (1–9). Use arrow keys to navigate. Leave unknown cells blank.';

  renderGrid();
}

// ── Solve ────────────────────────────────────────────────────────────────────

async function solve() {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Solving…';
  statusEl.style.color = '#6b7280';

  const btn = document.getElementById('solve-btn');
  btn.textContent = 'Solving…';
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';

  try {
    const resp = await fetch(`${API_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grid: valueMap, subgrids: subgridMap }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = data.error || 'Solver returned an error.';
      statusEl.style.color = '#dc2626';
    } else {
      solutionMap = data.solution;
      statusEl.textContent = 'Solved!';
      statusEl.style.color = '#16a34a';
      renderResult();
    }
  } catch (err) {
    statusEl.textContent = 'Could not reach solver. Is the server running?';
    statusEl.style.color = '#dc2626';
  } finally {
    btn.textContent = 'Solve';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

function renderResult() {
  const section = document.getElementById('result-section');
  const el = document.getElementById('result-grid');
  section.style.display = 'block';
  el.innerHTML = '';

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      const sg = subgridMap[r][c];
      const isGiven = valueMap[r][c] > 0;
      const val = solutionMap[r][c];

      const bt = r === 0 ? '2px' : (subgridMap[r-1][c] !== sg ? '2px' : '1px');
      const bb = r === 8 ? '0'   : (subgridMap[r+1][c] !== sg ? '2px' : '1px');
      const bl = c === 0 ? '2px' : (subgridMap[r][c-1] !== sg ? '2px' : '1px');
      const br = c === 8 ? '0'   : (subgridMap[r][c+1] !== sg ? '2px' : '1px');
      const col = COLORS[sg];

      cell.style.cssText = `
        width: ${CELL_SIZE}px; height: ${CELL_SIZE}px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: ${isGiven ? '800' : '400'};
        color: ${isGiven ? col.text : '#374151'};
        background: ${col.bg};
        border-top: ${bt} solid ${col.border};
        border-bottom: ${bb} solid ${col.border};
        border-left: ${bl} solid ${col.border};
        border-right: ${br} solid ${col.border};
        box-sizing: border-box;
      `;
      cell.textContent = val;
      el.appendChild(cell);
    }
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────

function resetAll() {
  subgridMap = Array.from({length: 9}, () => Array(9).fill(-1));
  valueMap   = Array.from({length: 9}, () => Array(9).fill(0));
  solutionMap = null;
  selectedCell = null;
  document.getElementById('result-section').style.display = 'none';
  document.getElementById('status').textContent = '';
  renderGrid();
  renderCounts();
}

function resetValues() {
  valueMap = Array.from({length: 9}, () => Array(9).fill(0));
  solutionMap = null;
  selectedCell = null;
  document.getElementById('result-section').style.display = 'none';
  document.getElementById('status').textContent = '';
  renderGrid();
}

// ── Init ─────────────────────────────────────────────────────────────────────

window.setMode = setMode;
window.solve = solve;
window.resetAll = resetAll;
window.resetValues = resetValues;

buildGrid();
renderCounts();
selectSubgrid(0);

})();
</script>
