// ============ STATE ============
let chipSets = [];
let inventory = [];
let chipColors = {};
let stackConfigs = [];
let blindSchedules = [];
let tournaments = [];
let currentLevels = [];
let editingScheduleId = null;
let editingStackId = null;

// Preserve stack designer inputs across page switches
let savedStackInputs = null;

function saveStackInputState() {
  savedStackInputs = {
    name: $('#stack-name')?.value || '',
    entrants: $('#stack-entrants')?.value || '30',
    rebuy1Count: $('#rebuy1-count')?.value || '30',
    rebuy2Count: $('#rebuy2-count')?.value || '120',
    start: {},
    rebuy1: {},
    rebuy2: {}
  };
  $$('.stack-qty-input').forEach(i => { savedStackInputs.start[i.dataset.denom] = i.value; });
  $$('.rebuy1-qty-input').forEach(i => { savedStackInputs.rebuy1[i.dataset.denom] = i.value; });
  $$('.rebuy2-qty-input').forEach(i => { savedStackInputs.rebuy2[i.dataset.denom] = i.value; });
}

function restoreStackInputState() {
  if (!savedStackInputs) return;
  $('#stack-name').value = savedStackInputs.name;
  $('#stack-entrants').value = savedStackInputs.entrants;
  $('#rebuy1-count').value = savedStackInputs.rebuy1Count;
  $('#rebuy2-count').value = savedStackInputs.rebuy2Count;
  $$('.stack-qty-input').forEach(i => { if (savedStackInputs.start[i.dataset.denom] !== undefined) i.value = savedStackInputs.start[i.dataset.denom]; });
  $$('.rebuy1-qty-input').forEach(i => { if (savedStackInputs.rebuy1[i.dataset.denom] !== undefined) i.value = savedStackInputs.rebuy1[i.dataset.denom]; });
  $$('.rebuy2-qty-input').forEach(i => { if (savedStackInputs.rebuy2[i.dataset.denom] !== undefined) i.value = savedStackInputs.rebuy2[i.dataset.denom]; });
}

// ============ HELPERS ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function fmt(n) {
  if (n >= 1000) return '$' + n.toLocaleString();
  if (n === Math.floor(n)) return '$' + n;
  return '$' + n.toFixed(2);
}

function fmtShort(n) {
  if (n >= 1000) return (n/1000) + 'K';
  return '' + n;
}

async function api(url, opts = {}) {
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
    opts.headers = { 'Content-Type': 'application/json', ...opts.headers };
  }
  const res = await fetch('/api/' + url, opts);
  return res.json();
}

function getChipColor(denom) {
  return chipColors[denom] || chipColors[Math.floor(denom)] || '#888';
}

function chipCircleHTML(denom, size = '') {
  const color = getChipColor(denom);
  const textColor = isLightColor(color) ? '#1a1a2e' : '#fff';
  const sizeClass = size ? `chip-circle-${size}` : '';
  return `<span class="chip-circle ${sizeClass}" style="background:${color}; color:${textColor}">${fmtShort(denom)}</span>`;
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function buildStackVisual(chips, title, subtitle) {
  if (!chips || chips.length === 0 || chips.every(c => (c.quantity || 0) === 0)) return '';
  
  const totalValue = chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const totalChips = chips.reduce((sum, c) => sum + c.quantity, 0);
  
  const columns = chips.filter(c => c.quantity > 0).map(chip => {
    const color = getChipColor(chip.denomination);
    const maxDisplay = Math.min(chip.quantity, 20); // Cap visual at 20 chips high
    const chipSlices = [];
    for (let i = 0; i < maxDisplay; i++) {
      chipSlices.push(`<div class="chip-in-stack" style="background:${color}"></div>`);
    }
    
    return `
      <div class="chip-stack-column">
        <div class="chip-stack-tower">
          ${chipSlices.join('')}
        </div>
        <div class="chip-stack-label">
          <div class="denom" style="color:${color}">${fmt(chip.denomination)}</div>
          <div class="count">×${chip.quantity}</div>
        </div>
      </div>
    `;
  });
  
  return `
    <div class="stack-visual">
      <div class="stack-visual-title">${title || 'Starting Stack'}</div>
      <div class="stack-visual-subtitle">${subtitle || `${totalChips} chips`}</div>
      <div class="stack-visual-chips">
        ${columns.join('')}
      </div>
      <div class="stack-visual-total">
        <div class="total-value">${fmt(totalValue)}</div>
        <div class="total-label">Total Stack Value</div>
      </div>
    </div>
  `;
}

// ============ NAVIGATION ============
$$('.nav-item').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    $$('.nav-item').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${page}`).classList.add('active');
    
    // Save stack inputs before leaving stacks page
    saveStackInputState();
    
    if (page === 'inventory') loadInventory();
    if (page === 'stacks') loadStacks();
    if (page === 'blinds') loadBlinds();
    if (page === 'tournaments') loadTournaments();
  });
});

// ============ CHIP INVENTORY PAGE ============
async function loadInventory() {
  chipSets = await api('chip-sets');
  inventory = await api('chip-inventory');
  chipColors = await api('chip-colors');
  renderChipSets();
  renderTotalInventory();
}

function renderChipSets() {
  const container = $('#chip-sets-list');
  if (chipSets.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📦</div>No chip sets found</div>';
    return;
  }
  
  container.innerHTML = chipSets.map(s => `
    <div class="chip-set-card">
      <div class="chip-set-header">
        <h3>${s.name}</h3>
        <div class="qty-control">
          <span style="color: var(--text-dim); font-size: 0.85em; margin-right: 4px;">Qty owned:</span>
          <button onclick="updateSetQty(${s.id}, ${s.quantity_owned - 1})">−</button>
          <span>${s.quantity_owned}</span>
          <button onclick="updateSetQty(${s.id}, ${s.quantity_owned + 1})">+</button>
        </div>
      </div>
      <div class="chip-details-grid">
        ${s.details.map(d => {
          const color = d.color || getChipColor(d.denomination);
          return `
          <div class="chip-detail">
            ${chipCircleHTML(d.denomination, 'lg')}
            <div class="chip-denom" style="color:${color}; margin-top:6px">${fmt(d.denomination)}</div>
            <div class="chip-count">${d.count_per_set} per set · ${d.count_per_set * s.quantity_owned} total</div>
          </div>
        `}).join('')}
      </div>
    </div>
  `).join('');
}

function renderTotalInventory() {
  const container = $('#total-inventory');
  if (inventory.length === 0) {
    container.innerHTML = '<div class="empty-state">No chips in inventory</div>';
    return;
  }
  
  const totalValue = inventory.reduce((sum, i) => sum + i.denomination * i.total_count, 0);
  const totalChips = inventory.reduce((sum, i) => sum + i.total_count, 0);
  
  container.innerHTML = `
    <div class="inventory-grid">
      ${inventory.map(i => {
        const color = i.color || getChipColor(i.denomination);
        return `
        <div class="inventory-item">
          ${chipCircleHTML(i.denomination, 'lg')}
          <div class="inventory-denom" style="color:${color}">${fmt(i.denomination)}</div>
          <div class="inventory-count">${i.total_count} chips</div>
          <div class="inventory-value">Total: ${fmt(i.denomination * i.total_count)}</div>
        </div>
      `}).join('')}
    </div>
    <div class="summary-box" style="margin-top: 15px">
      <div class="summary-row">
        <span class="summary-label">Total Chips</span>
        <span class="summary-value good">${totalChips.toLocaleString()}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Value</span>
        <span class="summary-value">${fmt(totalValue)}</span>
      </div>
    </div>
  `;
}

async function updateSetQty(id, qty) {
  if (qty < 0) return;
  await api(`chip-sets/${id}`, { method: 'PATCH', body: { quantity_owned: qty } });
  loadInventory();
}

// ============ STACK DESIGNER PAGE ============
async function loadStacks() {
  inventory = await api('chip-inventory');
  chipColors = await api('chip-colors');
  stackConfigs = await api('stack-configs');
  renderStackDesigner();
  renderSavedStacks();
}

function renderStackDesigner() {
  const container = $('#stack-designer-chips');
  const rebuy1Container = $('#rebuy1-designer-chips');
  const rebuy2Container = $('#rebuy2-designer-chips');
  if (inventory.length === 0) {
    container.innerHTML = '<div class="empty-state">No chips available. Add chip sets in Inventory first.</div>';
    rebuy1Container.innerHTML = '';
    rebuy2Container.innerHTML = '';
    return;
  }
  
  function chipRowHTML(inv, cssClass, valClass) {
    return `
      <div class="stack-chip-row" data-denom="${inv.denomination}">
        <span class="stack-chip-denom">
          ${chipCircleHTML(inv.denomination, 'sm')}
          ${fmt(inv.denomination)}
        </span>
        <input type="number" min="0" max="${inv.total_count}" value="0" 
               onchange="updateStackSummary()" oninput="updateStackSummary()"
               class="${cssClass}" data-denom="${inv.denomination}" data-max="${inv.total_count}">
        <span class="${valClass}" data-denom="${inv.denomination}">= $0</span>
      </div>
    `;
  }
  
  container.innerHTML = inventory.map(i => chipRowHTML(i, 'stack-qty-input', 'stack-chip-value')).join('');
  rebuy1Container.innerHTML = inventory.map(i => chipRowHTML(i, 'rebuy1-qty-input', 'rebuy1-chip-value')).join('');
  rebuy2Container.innerHTML = inventory.map(i => chipRowHTML(i, 'rebuy2-qty-input', 'rebuy2-chip-value')).join('');
  
  if (editingStackId) {
    const config = stackConfigs.find(c => c.id === editingStackId);
    if (config) {
      $('#stack-name').value = config.name;
      config.chips.forEach(chip => {
        const input = $(`.stack-qty-input[data-denom="${chip.denomination}"]`);
        if (input) input.value = chip.quantity;
      });
    }
  } else {
    // Restore previously entered values when coming back to this page
    restoreStackInputState();
  }
  
  updateStackSummary();
}

function getStackChipsFromInputs() {
  const chips = [];
  $$('.stack-qty-input').forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    const qty = parseInt(input.value) || 0;
    if (qty > 0) {
      chips.push({ denomination: denom, quantity: qty });
    }
  });
  return chips;
}

function getChipsFromInputs(cssClass) {
  const chips = [];
  $$(`.${cssClass}`).forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    const qty = parseInt(input.value) || 0;
    if (qty > 0) {
      chips.push({ denomination: denom, quantity: qty });
    }
  });
  return chips;
}

function computeColumnTotal(cssClass, valClass) {
  let value = 0;
  let chips = 0;
  $$(`.${cssClass}`).forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    const qty = parseInt(input.value) || 0;
    const val = denom * qty;
    const valSpan = $(`.${valClass}[data-denom="${denom}"]`);
    if (valSpan) valSpan.textContent = `= ${fmt(val)}`;
    value += val;
    chips += qty;
  });
  return { value, chips };
}

function updateStackSummary() {
  const entrants = parseInt($('#stack-entrants').value) || 1;
  const rebuy1Count = parseInt($('#rebuy1-count').value) || 0;
  const rebuy2Count = parseInt($('#rebuy2-count').value) || 0;
  
  // Compute each column
  const start = computeColumnTotal('stack-qty-input', 'stack-chip-value');
  const r1 = computeColumnTotal('rebuy1-qty-input', 'rebuy1-chip-value');
  const r2 = computeColumnTotal('rebuy2-qty-input', 'rebuy2-chip-value');
  
  // Column totals
  $('#start-col-total').innerHTML = `${fmt(start.value)} <span style="color:var(--text-dim);font-size:0.8em">(${start.chips} chips)</span>`;
  $('#rebuy1-col-total').innerHTML = rebuy1Count > 0 && r1.value > 0 
    ? `${fmt(r1.value)} × ${rebuy1Count} = ${fmt(r1.value * rebuy1Count)} <span style="color:var(--text-dim);font-size:0.8em">(${r1.chips} chips ea)</span>`
    : `${fmt(r1.value)} <span style="color:var(--text-dim);font-size:0.8em">(${r1.chips} chips)</span>`;
  $('#rebuy2-col-total').innerHTML = rebuy2Count > 0 && r2.value > 0
    ? `${fmt(r2.value)} × ${rebuy2Count} = ${fmt(r2.value * rebuy2Count)} <span style="color:var(--text-dim);font-size:0.8em">(${r2.chips} chips ea)</span>`
    : `${fmt(r2.value)} <span style="color:var(--text-dim);font-size:0.8em">(${r2.chips} chips)</span>`;
  
  // Build per-denomination usage map
  const denomUsage = {};
  $$('.stack-qty-input').forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    denomUsage[denom] = { startQty: parseInt(input.value) || 0, r1Qty: 0, r2Qty: 0, max: parseInt(input.dataset.max) };
  });
  $$('.rebuy1-qty-input').forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    if (denomUsage[denom]) denomUsage[denom].r1Qty = parseInt(input.value) || 0;
  });
  $$('.rebuy2-qty-input').forEach(input => {
    const denom = parseFloat(input.dataset.denom);
    if (denomUsage[denom]) denomUsage[denom].r2Qty = parseInt(input.value) || 0;
  });
  
  // Max players (starting stacks only)
  let maxStartPlayers = Infinity;
  for (const [denom, u] of Object.entries(denomUsage)) {
    if (u.startQty > 0) maxStartPlayers = Math.min(maxStartPlayers, Math.floor(u.max / u.startQty));
  }
  if (maxStartPlayers === Infinity) maxStartPlayers = 0;
  
  // Max rebuys supported for each rebuy type
  const hasR1 = Object.values(denomUsage).some(u => u.r1Qty > 0);
  const hasR2 = Object.values(denomUsage).some(u => u.r2Qty > 0);
  
  function calcMaxRebuys(rebuyKey, otherKey, otherCount) {
    let max = Infinity;
    for (const [denom, u] of Object.entries(denomUsage)) {
      if (u[rebuyKey] > 0) {
        const remaining = u.max - (u.startQty * entrants) - (u[otherKey] * otherCount);
        max = Math.min(max, Math.floor(remaining / u[rebuyKey]));
      }
    }
    return max === Infinity ? 0 : Math.max(0, max);
  }
  
  const maxR1 = hasR1 ? calcMaxRebuys('r1Qty', 'r2Qty', rebuy2Count) : 0;
  const maxR2 = hasR2 ? calcMaxRebuys('r2Qty', 'r1Qty', rebuy1Count) : 0;
  
  // Summary
  const summary = $('#stack-summary');
  let s = `
    <div class="summary-row">
      <span class="summary-label">Starting Stack Value</span>
      <span class="summary-value">${fmt(start.value)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Starting (${entrants} entrants)</span>
      <span class="summary-value">${fmt(start.value * entrants)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Max Players Supported</span>
      <span class="summary-value ${maxStartPlayers >= entrants ? 'good' : 'danger'}">${maxStartPlayers}</span>
    </div>`;
  
  if (hasR1) {
    s += `
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
      <span class="summary-label">🔄 Rebuy 1: ${rebuy1Count} × ${fmt(r1.value)}</span>
      <span class="summary-value">${fmt(r1.value * rebuy1Count)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">🔄 Rebuy 1 Max Supported</span>
      <span class="summary-value ${maxR1 >= rebuy1Count ? 'good' : 'danger'}">${maxR1}</span>
    </div>`;
  }
  if (hasR2) {
    s += `
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
      <span class="summary-label">🔄 Rebuy 2: ${rebuy2Count} × ${fmt(r2.value)}</span>
      <span class="summary-value">${fmt(r2.value * rebuy2Count)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">🔄 Rebuy 2 Max Supported</span>
      <span class="summary-value ${maxR2 >= rebuy2Count ? 'good' : 'danger'}">${maxR2}</span>
    </div>`;
  }
  
  if (start.chips > 0 && entrants > maxStartPlayers) {
    s += `<div class="summary-row"><span class="summary-label"></span><span class="summary-value danger">⚠ Not enough chips for ${entrants} entrants!</span></div>`;
  }
  summary.innerHTML = s;
  
  // Remaining inventory with proportional drain bars - always show
  const remainingDiv = $('#stack-remaining-inventory');
  if (inventory.length > 0) {
    remainingDiv.style.display = 'block';
    
    // Find the max chip count across all denominations to scale bars proportionally
    const maxChipCount = Math.max(...inventory.map(inv => inv.total_count), 1);
    
    let rows = '';
    for (const inv of inventory) {
      const u = denomUsage[inv.denomination] || { startQty: 0, r1Qty: 0, r2Qty: 0 };
      const total = inv.total_count;
      const startUsed = u.startQty * entrants;
      const r1Used = u.r1Qty * rebuy1Count;
      const r2Used = u.r2Qty * rebuy2Count;
      const totalUsed = startUsed + r1Used + r2Used;
      const remaining = Math.max(0, total - totalUsed);
      const isOver = total - totalUsed < 0;
      const color = getChipColor(inv.denomination);
      
      // Bar width proportional to max denomination count
      const barWidthPct = (total / maxChipCount) * 100;
      // Remaining portion within this bar
      const remainPct = total > 0 ? (remaining / total) * 100 : 0;
      const usedPct = 100 - remainPct;
      
      const statusClass = isOver ? 'danger' : remaining === 0 ? 'warning' : 'good';
      
      let usedLabel = [];
      if (startUsed > 0) usedLabel.push(`${startUsed} start`);
      if (r1Used > 0) usedLabel.push(`${r1Used} R1`);
      if (r2Used > 0) usedLabel.push(`${r2Used} R2`);
      
      rows += `
        <div class="drain-row">
          <div class="drain-label">
            ${chipCircleHTML(inv.denomination, 'sm')}
            <span class="drain-denom">${fmt(inv.denomination)}</span>
            <span class="drain-total">${total}</span>
          </div>
          <div class="drain-bar-wrap">
            <div class="drain-bar-track" style="width:${barWidthPct}%">
              <div class="drain-bar-used" style="width:${usedPct}%"></div>
              <div class="drain-bar-remain" style="width:${remainPct}%;background:${color}"></div>
            </div>
            ${isOver ? `<div class="drain-bar-track drain-bar-overflow" style="width:${Math.min((totalUsed / maxChipCount) * 100, 100)}%"></div>` : ''}
          </div>
          <div class="drain-count ${statusClass}">
            ${isOver ? `<span class="drain-over">−${totalUsed - total}</span>` : remaining}
            <span class="drain-used-note">${usedLabel.length > 0 ? `(${usedLabel.join(' + ')} used)` : ''}</span>
          </div>
        </div>
      `;
    }
    let label = `${entrants} stacks`;
    if (rebuy1Count > 0) label += ` + ${rebuy1Count} R1`;
    if (rebuy2Count > 0) label += ` + ${rebuy2Count} R2`;
    remainingDiv.innerHTML = `
      <h3 style="color:var(--gold);font-size:0.95em;margin-bottom:12px">📦 Chip Inventory (${label})</h3>
      ${rows}
    `;
  } else {
    remainingDiv.style.display = 'none';
    remainingDiv.innerHTML = '';
  }
  
  // Live stack visuals
  const startChips = getChipsFromInputs('stack-qty-input');
  const r1Chips = getChipsFromInputs('rebuy1-qty-input');
  const r2Chips = getChipsFromInputs('rebuy2-qty-input');
  const visual = $('#stack-visual');
  let visualHTML = '';
  
  const hasVisuals = startChips.length > 0 || (r1Chips.length > 0 && rebuy1Count > 0) || (r2Chips.length > 0 && rebuy2Count > 0);
  if (hasVisuals) {
    visualHTML = '<div style="display:flex;gap:20px;flex-wrap:wrap">';
    if (startChips.length > 0) {
      const name = $('#stack-name').value || 'Starting Stack';
      visualHTML += `<div style="flex:1;min-width:250px">${buildStackVisual(startChips, name, `${start.chips} chips per player`)}</div>`;
    }
    if (r1Chips.length > 0 && rebuy1Count > 0) {
      visualHTML += `<div style="flex:1;min-width:250px">${buildStackVisual(r1Chips, '🔄 Rebuy 1', `${r1.chips} chips · ${fmt(r1.value)}`)}</div>`;
    }
    if (r2Chips.length > 0 && rebuy2Count > 0) {
      visualHTML += `<div style="flex:1;min-width:250px">${buildStackVisual(r2Chips, '🔄 Rebuy 2', `${r2.chips} chips · ${fmt(r2.value)}`)}</div>`;
    }
    visualHTML += '</div>';
  }
  visual.innerHTML = visualHTML;
}

$('#save-stack-btn').addEventListener('click', async () => {
  const name = $('#stack-name').value.trim();
  if (!name) return alert('Please enter a stack name');
  
  const chips = getChipsFromInputs('stack-qty-input');
  const rebuy1_chips = getChipsFromInputs('rebuy1-qty-input');
  const rebuy2_chips = getChipsFromInputs('rebuy2-qty-input');
  if (chips.length === 0) return alert('Add some chips to the starting stack');
  
  const body = { name, chips, rebuy1_chips, rebuy2_chips };
  
  if (editingStackId) {
    await api(`stack-configs/${editingStackId}`, { method: 'PUT', body });
    editingStackId = null;
    $('#save-stack-btn').textContent = 'Save Stack Configuration';
  } else {
    await api('stack-configs', { method: 'POST', body });
  }
  
  $('#stack-name').value = '';
  $$('.stack-qty-input, .rebuy1-qty-input, .rebuy2-qty-input').forEach(input => input.value = 0);
  updateStackSummary();
  loadStacks();
});

function chipIconsHTML(chips) {
  return chips.map(c =>
    `<span style="display:inline-flex;align-items:center;gap:2px">${chipCircleHTML(c.denomination, 'sm')}<span style="font-size:0.8em;color:var(--text-dim)">×${c.quantity}</span></span>`
  ).join(' ');
}

function renderSavedStacks() {
  const container = $('#saved-stacks-list');
  if (stackConfigs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📋</div>No saved stacks yet</div>';
    return;
  }
  
  container.innerHTML = stackConfigs.map(config => {
    const startValue = config.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    const r1Value = (config.rebuy1_chips || []).reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    const r2Value = (config.rebuy2_chips || []).reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    
    const r1Line = r1Value > 0 ? `<div style="font-size:0.8em;color:var(--text-dim);margin-top:3px">🔄 Rebuy 1: ${fmt(r1Value)} — ${chipIconsHTML(config.rebuy1_chips)}</div>` : '';
    const r2Line = r2Value > 0 ? `<div style="font-size:0.8em;color:var(--text-dim);margin-top:3px">🔄 Rebuy 2: ${fmt(r2Value)} — ${chipIconsHTML(config.rebuy2_chips)}</div>` : '';
    
    return `
      <div class="saved-item" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="saved-item-info">
            <h3>${config.name} — ${fmt(startValue)}</h3>
            <div class="saved-stack-chips">${chipIconsHTML(config.chips)}</div>
            ${r1Line}
            ${r2Line}
          </div>
          <div class="saved-item-actions">
            <button class="btn btn-secondary btn-sm" onclick="printStack(${config.id})">🖨 Export</button>
            <button class="btn btn-secondary btn-sm" onclick="editStack(${config.id})">Edit</button>
            <button class="btn btn-danger" onclick="deleteStack(${config.id})">Delete</button>
          </div>
        </div>
        <div id="stack-visual-${config.id}" style="margin-top:10px"></div>
      </div>
    `;
  }).join('');
}

function viewStackVisual(id) {
  const config = stackConfigs.find(c => c.id === id);
  if (!config) return;
  const container = $(`#stack-visual-${id}`);
  if (container.innerHTML) {
    container.innerHTML = '';
    return;
  }
  const totalValue = config.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const totalChips = config.chips.reduce((sum, c) => sum + c.quantity, 0);
  container.innerHTML = buildStackVisual(config.chips, config.name, `${totalChips} chips · ${fmt(totalValue)}`);
}

function editStack(id) {
  editingStackId = id;
  $('#save-stack-btn').textContent = 'Update Stack Configuration';
  renderStackDesigner();
  // Also restore rebuy1 and rebuy2 chips from the saved config
  const config = stackConfigs.find(c => c.id === id);
  if (config) {
    (config.rebuy1_chips || []).forEach(chip => {
      const input = $(`.rebuy1-qty-input[data-denom="${chip.denomination}"]`);
      if (input) input.value = chip.quantity;
    });
    (config.rebuy2_chips || []).forEach(chip => {
      const input = $(`.rebuy2-qty-input[data-denom="${chip.denomination}"]`);
      if (input) input.value = chip.quantity;
    });
    updateStackSummary();
  }
  $('#page-stacks').scrollIntoView({ behavior: 'smooth' });
}

async function deleteStack(id) {
  if (!confirm('Delete this stack configuration?')) return;
  await api(`stack-configs/${id}`, { method: 'DELETE' });
  loadStacks();
}

// ============ BLIND SCHEDULES PAGE ============
async function loadBlinds() {
  blindSchedules = await api('blind-schedules');
  stackConfigs = await api('stack-configs');
  chipColors = await api('chip-colors');
  
  const select = $('#schedule-stack-ref');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select a stack to see BB counts --</option>';
  stackConfigs.forEach(sc => {
    const val = sc.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    select.innerHTML += `<option value="${sc.id}">${sc.name} (${fmt(val)})</option>`;
  });
  if (currentVal) select.value = currentVal;
  
  if (currentLevels.length === 0 && !editingScheduleId) {
    currentLevels = [
      { level_number: 1, small_blind: 5, big_blind: 10, ante: 0, duration_minutes: 20, is_break: false }
    ];
  }
  
  renderLevelsTable();
  renderSavedSchedules();
}

function getRefStack() {
  const id = parseInt($('#schedule-stack-ref').value);
  if (!id) return null;
  return stackConfigs.find(c => c.id === id) || null;
}

function getRefStackValue() {
  const config = getRefStack();
  if (!config) return null;
  return config.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
}

// Returns the minimum chip denomination in a stack (smallest chip that exists in stack)
function getStackMinDenom(config) {
  if (!config || !config.chips || config.chips.length === 0) return null;
  const denoms = config.chips.filter(c => c.quantity > 0).map(c => c.denomination);
  return denoms.length > 0 ? Math.min(...denoms) : null;
}

// Check if a blind level is achievable with the current chip denominations
// A level is achievable if SB, BB, and ante are all exact multiples of available chip denominations
function isLevelAchievable(lvl, config) {
  if (!config) return true; // no stack selected — don't filter
  const minDenom = getStackMinDenom(config);
  if (!minDenom) return true;
  const denoms = config.chips.filter(c => c.quantity > 0).map(c => c.denomination).sort((a, b) => a - b);
  
  function canMakeAmount(amount) {
    if (amount === 0) return true;
    // Amount must be a multiple of the smallest denomination
    return amount % minDenom === 0;
  }
  
  return canMakeAmount(lvl.small_blind) && canMakeAmount(lvl.big_blind) && canMakeAmount(lvl.ante || 0);
}

function renderLevelsTable() {
  const tbody = $('#levels-tbody');
  const refStack = getRefStack();
  const stackValue = refStack ? refStack.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0) : null;

  // Pre-compute per-level average stacks using the same simulation as the predictor
  // This accounts for busts (fewer players = higher avg stack) and rebuy chip injection timing
  const levelAvgStacks = {};
  if (stackValue) {
    const players = parseInt($('#pred-players').value) || 20;
    const totalRebuys = parseInt($('#pred-rebuys').value) || 0;
    const rebuyValue = stackValue;
    const rebuyThroughLevel = parseInt($('#pred-rebuy-through').value) || 4;
    const handsPerHour = parseInt($('#pred-hands-hr').value) || 25;

    const playLevelsForSim = currentLevels.filter(l => !l.is_break && isLevelAchievable(l, refStack) && l.big_blind > 0);
    const rebuyWindowLevels = playLevelsForSim.filter(l => l.level_number <= rebuyThroughLevel);
    const numRebuyWindowLevels = Math.max(rebuyWindowLevels.length, 1);
    const chipsPerRebuyLevel = (totalRebuys * rebuyValue) / numRebuyWindowLevels;
    const rebuysPerWindowLevel = totalRebuys / numRebuyWindowLevels;

    let remainingPlayers = players;
    let totalChipsInPlay = players * stackValue;
    let rebuysRemaining = totalRebuys;

    for (const lvl of currentLevels) {
      if (lvl.is_break) continue;
      if (!isLevelAchievable(lvl, refStack) || lvl.big_blind === 0) continue;
      if (remainingPlayers <= 1) break;

      const inRebuyWindow = lvl.level_number <= rebuyThroughLevel && rebuysRemaining > 0;
      if (inRebuyWindow) {
        totalChipsInPlay += chipsPerRebuyLevel;
      }

      const avgStack = totalChipsInPlay / remainingPlayers;
      levelAvgStacks[lvl.level_number] = avgStack;

      // Simulate eliminations (same model as predictor)
      const orbit = lvl.small_blind + lvl.big_blind + (lvl.ante || 0);
      const M = orbit > 0 ? avgStack / orbit : 999;
      let elimRatePerHand;
      if (M > 20) elimRatePerHand = 0.004;
      else if (M > 10) elimRatePerHand = 0.010;
      else if (M > 5) elimRatePerHand = 0.025;
      else elimRatePerHand = 0.050;

      const handsThisLevel = (lvl.duration_minutes / 60) * handsPerHour;
      const survivalRate = Math.pow(1 - elimRatePerHand, handsThisLevel);
      const rawElims = remainingPlayers * (1 - survivalRate);

      let netElims = rawElims;
      if (inRebuyWindow) {
        const rebuysUsedThisLevel = Math.min(rebuysPerWindowLevel, rebuysRemaining, rawElims);
        netElims = Math.max(0, rawElims - rebuysUsedThisLevel);
        rebuysRemaining -= rebuysUsedThisLevel;
      }

      remainingPlayers = Math.max(1, remainingPlayers - netElims);
    }
  }

  let prevSmallestNeeded = null;
  let totalMinutes = 0;
  
  tbody.innerHTML = currentLevels.map((lvl, i) => {
    totalMinutes += lvl.duration_minutes;
    
    if (lvl.is_break) {
      const playLevels = currentLevels.filter(l => !l.is_break);
      const maxRound = playLevels.length;
      const afterRound = lvl.after_round || 1;
      const roundOptions = playLevels.map(pl => 
        `<option value="${pl.level_number}" ${pl.level_number === afterRound ? 'selected' : ''}>Round ${pl.level_number}</option>`
      ).join('');
      return `
        <tr class="break-row">
          <td colspan="2" style="text-align:center">☕ BREAK</td>
          <td colspan="2" style="font-size:0.85em">
            after <select onchange="updateBreakAfterRound(${i}, this.value)" style="padding:2px 4px;border-radius:4px;background:var(--bg);color:var(--text);border:1px solid var(--border)">${roundOptions}</select>
          </td>
          <td>
            <input type="number" min="1" value="${lvl.duration_minutes}" 
                   onchange="updateLevel(${i}, 'duration_minutes', this.value)" style="max-width:60px"> min
          </td>
          <td></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="insertLevel(${i})" title="Insert level above" style="padding:2px 7px;font-size:0.85em;margin-right:2px">⊕</button>
          <button class="btn btn-danger" onclick="removeLevel(${i})">✕</button>
        </td>
      </tr>
    `;
    }
    
    // Check if this level is achievable with the selected stack's chips
    const achievable = isLevelAchievable(lvl, refStack);
    const rowStyle = achievable ? '' : 'opacity:0.4;background:rgba(231,76,60,0.05)';
    const skipBadge = !achievable ? `<span title="Blind amount not achievable with chip denominations" style="color:var(--red);font-size:0.8em;margin-left:4px">⚠ skip</span>` : '';
    
    let bbStr = '—';
    let bbClass = '';
    if (stackValue && lvl.big_blind > 0 && achievable && levelAvgStacks[lvl.level_number] !== undefined) {
      const avgStackForLevel = levelAvgStacks[lvl.level_number];
      const bbs = Math.floor(avgStackForLevel / lvl.big_blind);
      bbClass = bbs >= 50 ? 'healthy' : bbs >= 20 ? 'medium' : 'short';
      bbStr = bbs + ' BB';
    }
    
    return `
      <tr style="${rowStyle}">
        <td>${lvl.level_number}${skipBadge}</td>
        <td><input type="number" min="0" value="${lvl.small_blind}" 
                   onchange="updateLevelSB(${i}, this.value)"></td>
        <td><input type="number" min="0" value="${lvl.big_blind}" 
                   onchange="updateLevel(${i}, 'big_blind', this.value)"></td>
        <td><input type="number" min="0" value="${lvl.ante}" 
                   onchange="updateLevel(${i}, 'ante', this.value)"></td>
        <td>
          <input type="number" min="1" value="${lvl.duration_minutes}" 
                 onchange="updateLevel(${i}, 'duration_minutes', this.value)" style="max-width:60px"> min
        </td>
        <td><span class="bb-count ${bbClass}">${bbStr}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="insertLevel(${i})" title="Insert level above" style="padding:2px 7px;font-size:0.85em;margin-right:2px">⊕</button>
          <button class="btn btn-danger" onclick="removeLevel(${i})">✕</button>
        </td>
      </tr>
    `;
  }).join('');
  
  const playLevels = currentLevels.filter(l => !l.is_break);
  const breakTime = currentLevels.filter(l => l.is_break).reduce((s, l) => s + l.duration_minutes, 0);
  const playTime = currentLevels.filter(l => !l.is_break).reduce((s, l) => s + l.duration_minutes, 0);
  
  // Update prediction whenever table changes
  renderPrediction();
  
  const summary = $('#schedule-summary');
  summary.innerHTML = `
    <div class="summary-row">
      <span class="summary-label">Total Play Levels</span>
      <span class="summary-value good">${playLevels.length}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Play Time</span>
      <span class="summary-value">${formatTime(playTime)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Break Time</span>
      <span class="summary-value">${formatTime(breakTime)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Duration</span>
      <span class="summary-value warning">${formatTime(totalMinutes)}</span>
    </div>
    ${stackValue ? `
    <div class="summary-row">
      <span class="summary-label">Starting Stack</span>
      <span class="summary-value">${fmt(stackValue)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Starting BB Count</span>
      <span class="summary-value good">${playLevels.length > 0 && playLevels[0].big_blind > 0 ? Math.floor(stackValue / playLevels[0].big_blind) + ' BB' : '—'}</span>
    </div>
    ` : ''}
  `;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function updateLevel(index, field, value) {
  const numVal = parseFloat(value) || 0;
  currentLevels[index][field] = numVal;
  renderLevelsTable();
}

// SB change: auto-set BB = 2×SB
function updateLevelSB(index, value) {
  const sb = parseFloat(value) || 0;
  currentLevels[index].small_blind = sb;
  currentLevels[index].big_blind = sb * 2;
  renderLevelsTable();
}

function removeLevel(index) {
  currentLevels.splice(index, 1);
  let num = 1;
  currentLevels.forEach(l => {
    if (!l.is_break) l.level_number = num++;
  });
  // Clamp break after_round values to valid range
  const maxRound = currentLevels.filter(l => !l.is_break).length;
  currentLevels.forEach(l => {
    if (l.is_break && l.after_round > maxRound) l.after_round = maxRound;
  });
  sortLevelsByPosition();
  renderLevelsTable();
}

// Insert a new play level above the given index
// Blinds are interpolated between the surrounding levels
function insertLevel(index) {
  const defaultDuration = parseInt($('#default-round-length').value) || 20;
  const target = currentLevels[index];

  // Find the previous and next play levels relative to this index
  let prevPlay = null;
  for (let i = index - 1; i >= 0; i--) {
    if (!currentLevels[i].is_break) { prevPlay = currentLevels[i]; break; }
  }
  let nextPlay = null;
  if (!target.is_break) {
    nextPlay = target;
  } else {
    for (let i = index + 1; i < currentLevels.length; i++) {
      if (!currentLevels[i].is_break) { nextPlay = currentLevels[i]; break; }
    }
  }

  let sb, bb, ante;
  if (prevPlay && nextPlay) {
    // Midpoint between surrounding levels
    sb = Math.round((prevPlay.small_blind + nextPlay.small_blind) / 2);
    bb = Math.round((prevPlay.big_blind + nextPlay.big_blind) / 2);
    ante = Math.round(((prevPlay.ante || 0) + (nextPlay.ante || 0)) / 2);
  } else if (nextPlay) {
    // Inserting before the first level — use half of next level's blinds
    sb = Math.max(1, Math.round(nextPlay.small_blind / 2));
    bb = Math.max(2, Math.round(nextPlay.big_blind / 2));
    ante = nextPlay.ante > 0 ? Math.round(nextPlay.ante / 2) : 0;
  } else if (prevPlay) {
    // Inserting after the last level — double previous
    sb = prevPlay.small_blind * 2;
    bb = prevPlay.big_blind * 2;
    ante = prevPlay.ante > 0 ? prevPlay.ante * 2 : 0;
  } else {
    sb = 5; bb = 10; ante = 0;
  }

  const newLevel = {
    level_number: 0, // will be re-numbered below
    small_blind: sb,
    big_blind: bb,
    ante: ante,
    duration_minutes: defaultDuration,
    is_break: false
  };

  currentLevels.splice(index, 0, newLevel);

  // Re-number all play levels sequentially
  let num = 1;
  currentLevels.forEach(l => {
    if (!l.is_break) l.level_number = num++;
  });

  sortLevelsByPosition();
  renderLevelsTable();
}

// Sort currentLevels so breaks appear right after their designated round
function sortLevelsByPosition() {
  // Separate play levels and breaks
  const playLevels = currentLevels.filter(l => !l.is_break);
  const breaks = currentLevels.filter(l => l.is_break);
  
  // Rebuild the array: for each play level, insert it, then any breaks that go after it
  const result = [];
  for (const pl of playLevels) {
    result.push(pl);
    // Add all breaks scheduled after this round number
    for (const br of breaks) {
      if (br.after_round === pl.level_number) {
        result.push(br);
      }
    }
  }
  // Any breaks with after_round=0 or unmatched go at the very beginning (unlikely but safe)
  for (const br of breaks) {
    if (!result.includes(br)) {
      result.push(br);
    }
  }
  
  currentLevels.length = 0;
  result.forEach(l => currentLevels.push(l));
}

function updateBreakAfterRound(breakIndex, newAfterRound) {
  currentLevels[breakIndex].after_round = parseInt(newAfterRound);
  sortLevelsByPosition();
  renderLevelsTable();
}

$('#add-level-btn').addEventListener('click', () => {
  const defaultDuration = parseInt($('#default-round-length').value) || 20;
  const playLevels = currentLevels.filter(l => !l.is_break);
  const last = playLevels[playLevels.length - 1];
  const newLevel = {
    level_number: playLevels.length + 1,
    small_blind: last ? last.small_blind * 2 : 5,
    big_blind: last ? last.big_blind * 2 : 10,
    ante: last ? (last.ante > 0 ? last.ante * 2 : 0) : 0,
    duration_minutes: defaultDuration,
    is_break: false
  };
  currentLevels.push(newLevel);
  sortLevelsByPosition();
  renderLevelsTable();
});

$('#add-break-btn').addEventListener('click', () => {
  const playLevels = currentLevels.filter(l => !l.is_break);
  const lastRound = playLevels.length > 0 ? playLevels[playLevels.length - 1].level_number : 1;
  currentLevels.push({
    level_number: 0,
    small_blind: 0,
    big_blind: 0,
    ante: 0,
    duration_minutes: 10,
    is_break: true,
    after_round: lastRound
  });
  sortLevelsByPosition();
  renderLevelsTable();
});

$('#schedule-stack-ref').addEventListener('change', () => {
  renderLevelsTable();
  renderPrediction();
});

// ============ GAME LENGTH PREDICTOR ============
// Model: simulate eliminations level-by-level using M-ratio pressure
// M = avg_stack / (SB + BB + ante_per_orbit)
// Elimination rate per hand scales with M:
//   M > 20  → ~0.4% of remaining players eliminated per hand (slow)
//   M 10-20 → ~1.0% per hand (medium)
//   M 5-10  → ~2.5% per hand (fast)
//   M < 5   → ~5.0% per hand (very fast / shove-fest)
//
// Rebuy model:
//   - Rebuys occur DURING the rebuy window (not all at the end)
//   - Each play level in the rebuy window gets a proportional share of rebuy chips added
//   - Rebuys also slow eliminations during the window — when a player is eliminated
//     and rebuys are still available, they re-enter (net player count stays higher)
//   - After the rebuy window closes, the full chip pool is locked in

function renderPrediction() {
  const output = $('#prediction-output');
  const refStack = getRefStack();
  
  if (!refStack) {
    output.innerHTML = '<p style="color:var(--text-dim)">Select a reference stack above to run the prediction.</p>';
    return;
  }
  
  const startingStack = refStack.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const players = parseInt($('#pred-players').value) || 20;
  const totalRebuys = parseInt($('#pred-rebuys').value) || 0;
  // Rebuy stack value = same as starting stack (same chips)
  const rebuyValue = startingStack;
  const rebuyThroughLevel = parseInt($('#pred-rebuy-through').value) || 4;
  const handsPerHour = parseInt($('#pred-hands-hr').value) || 25;
  
  const playLevels = currentLevels.filter(l => !l.is_break && isLevelAchievable(l, refStack) && l.big_blind > 0);
  
  if (playLevels.length === 0) {
    output.innerHTML = '<p style="color:var(--text-dim)">Add play levels to the schedule above.</p>';
    return;
  }
  
  // How many play levels are inside the rebuy window?
  const rebuyWindowLevels = playLevels.filter(l => l.level_number <= rebuyThroughLevel);
  const numRebuyWindowLevels = Math.max(rebuyWindowLevels.length, 1);
  
  // Chips injected per rebuy window level (spread evenly)
  const chipsPerRebuyLevel = (totalRebuys * rebuyValue) / numRebuyWindowLevels;
  
  // Rebuys consumed per window level (spread evenly — used to track remaining rebuy budget)
  const rebuysPerWindowLevel = totalRebuys / numRebuyWindowLevels;
  
  // Simulate level by level
  let remainingPlayers = players;
  let totalChipsInPlay = players * startingStack;
  let rebuysRemaining = totalRebuys;
  let cumulativeMinutes = 0;
  let finishLevel = null;
  let finishMinutes = null;
  
  const levelData = [];
  
  for (let i = 0; i < currentLevels.length; i++) {
    const lvl = currentLevels[i];
    const levelStartMinute = cumulativeMinutes;
    cumulativeMinutes += lvl.duration_minutes;
    
    if (lvl.is_break) {
      levelData.push({ isBreak: true, duration: lvl.duration_minutes, cumulative: cumulativeMinutes });
      continue;
    }
    
    if (!isLevelAchievable(lvl, refStack) || lvl.big_blind === 0) continue;
    
    if (remainingPlayers <= 1) break;
    
    const inRebuyWindow = lvl.level_number <= rebuyThroughLevel && rebuysRemaining > 0;
    
    // Inject this level's share of rebuy chips into the pool
    if (inRebuyWindow) {
      totalChipsInPlay += chipsPerRebuyLevel;
    }
    
    const avgStack = totalChipsInPlay / remainingPlayers;
    const orbit = lvl.small_blind + lvl.big_blind + (lvl.ante || 0);
    const M = orbit > 0 ? avgStack / orbit : 999;
    
    // Elimination rate per hand (fraction of remaining players eliminated)
    let elimRatePerHand;
    if (M > 20) elimRatePerHand = 0.004;
    else if (M > 10) elimRatePerHand = 0.010;
    else if (M > 5)  elimRatePerHand = 0.025;
    else             elimRatePerHand = 0.050;
    
    const handsThisLevel = (lvl.duration_minutes / 60) * handsPerHour;
    // Compound survival: remaining_after = remaining * (1 - elimRate)^hands
    const survivalRate = Math.pow(1 - elimRatePerHand, handsThisLevel);
    let rawElims = remainingPlayers * (1 - survivalRate);
    
    // During the rebuy window, eliminated players can re-enter.
    // Net eliminations = max(0, rawElims - rebuysThisLevel)
    let netElims = rawElims;
    let rebuysUsedThisLevel = 0;
    if (inRebuyWindow) {
      rebuysUsedThisLevel = Math.min(rebuysPerWindowLevel, rebuysRemaining, rawElims);
      netElims = Math.max(0, rawElims - rebuysUsedThisLevel);
      rebuysRemaining -= rebuysUsedThisLevel;
    }
    
    const playersAfter = Math.max(1, remainingPlayers - netElims);
    
    const mClass = M > 20 ? 'healthy' : M > 10 ? 'medium' : 'short';
    
    levelData.push({
      isBreak: false,
      levelNum: lvl.level_number,
      sb: lvl.small_blind,
      bb: lvl.big_blind,
      ante: lvl.ante,
      duration: lvl.duration_minutes,
      cumulative: cumulativeMinutes,
      levelStart: levelStartMinute,
      avgStack: Math.round(avgStack),
      M: M,
      mClass,
      playersStart: Math.round(remainingPlayers),
      playersEnd: Math.round(playersAfter),
      elimsThisLevel: Math.round(netElims),
      rebuysThisLevel: Math.round(rebuysUsedThisLevel),
      handsThisLevel: Math.round(handsThisLevel),
      inRebuyWindow,
    });
    
    remainingPlayers = playersAfter;
    
    if (remainingPlayers <= 1.5 && finishLevel === null) {
      finishLevel = lvl.level_number;
      finishMinutes = cumulativeMinutes;
    }
  }
  
  if (finishLevel === null) {
    finishLevel = '>' + (playLevels[playLevels.length - 1]?.level_number || '?');
    finishMinutes = cumulativeMinutes;
  }
  
  // Total chips at end of rebuy window (for summary display)
  const totalStartChips = players * startingStack;
  const totalRebuyChips = totalRebuys * rebuyValue;

  // Build the output
  const rebuyNote = totalRebuys > 0
    ? `<div class="summary-row">
        <span class="summary-label">Rebuys (${totalRebuys} × ${fmt(rebuyValue)})</span>
        <span class="summary-value">${fmt(totalRebuyChips)}</span>
      </div>`
    : '';

  const summaryHTML = `
    <div class="summary-box" style="margin-bottom:16px">
      <div class="summary-row">
        <span class="summary-label">Entrants</span>
        <span class="summary-value">${players}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Starting Chips in Play</span>
        <span class="summary-value">${fmt(totalStartChips)}</span>
      </div>
      ${rebuyNote}
      <div class="summary-row">
        <span class="summary-label">Total Chips (incl. rebuys)</span>
        <span class="summary-value">${fmt(totalStartChips + totalRebuyChips)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Starting Stack / BB Ratio</span>
        <span class="summary-value good">${playLevels[0]?.big_blind > 0 ? Math.round(startingStack / playLevels[0].big_blind) + ' BB' : '—'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Est. Final Table (≈ 9 left)</span>
        <span class="summary-value warning">${estimateLevelForPlayers(levelData, 9)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Est. Heads-Up (≈ 2 left)</span>
        <span class="summary-value warning">${estimateLevelForPlayers(levelData, 2)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Est. Finish Level</span>
        <span class="summary-value ${finishMinutes <= 240 ? 'good' : finishMinutes <= 360 ? 'warning' : 'danger'}">Level ${finishLevel} (~${formatTime(finishMinutes)})</span>
      </div>
    </div>
  `;
  
  // Pressure bar at top
  const pressureHTML = buildPressureBar(levelData, players);
  
  // Per-level table — add Rebuys column if rebuys are in play
  const showRebuys = totalRebuys > 0;
  const colCount = showRebuys ? 9 : 8;

  const tableRows = levelData.map(d => {
    if (d.isBreak) {
      return `<tr class="break-row"><td colspan="${colCount}" style="text-align:center">☕ Break (${d.duration} min) — ${formatTime(d.cumulative)}</td></tr>`;
    }
    const mStr = d.M > 50 ? '>50' : d.M.toFixed(1);
    const rebuyCell = showRebuys
      ? `<td style="color:var(--gold)">${d.rebuysThisLevel > 0 ? '+' + d.rebuysThisLevel + ' 🔄' : '—'}</td>`
      : '';
    const rebuyRowStyle = d.inRebuyWindow ? 'border-left:3px solid var(--gold)' : '';
    return `
      <tr style="${rebuyRowStyle}">
        <td>${d.levelNum}</td>
        <td>${fmt(d.sb)}/${fmt(d.bb)}${d.ante > 0 ? '+' + fmt(d.ante) : ''}</td>
        <td>${formatTime(d.levelStart)}–${formatTime(d.cumulative)}</td>
        <td>${fmt(d.avgStack)}</td>
        <td><span class="bb-count ${d.mClass}">M=${mStr}</span></td>
        <td>${d.playersStart}</td>
        <td style="color:var(--red)">−${d.elimsThisLevel}</td>
        ${rebuyCell}
        <td><b>${d.playersEnd}</b></td>
      </tr>
    `;
  }).join('');

  const rebuyHeader = showRebuys ? '<th>Rebuys</th>' : '';

  output.innerHTML = `
    ${summaryHTML}
    ${pressureHTML}
    <div style="overflow-x:auto;margin-top:16px">
      <table class="levels-table">
        <thead><tr>
          <th>Lvl</th><th>Blinds</th><th>Time</th><th>Avg Stack</th><th>Avg M</th>
          <th>Players Start</th><th>Elims</th>${rebuyHeader}<th>Players End</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <p style="color:var(--text-dim);font-size:0.75em;margin-top:8px">
      ⚠ Estimates only. Actual game length varies with player skill, table dynamics, and luck.
      Model assumes ${handsPerHour} hands/hour with elimination rate scaling by average M-ratio.
      ${showRebuys ? 'Gold border = rebuy window open. Rebuys shown are re-entries modeled as offset to eliminations.' : ''}
    </p>
  `;
}

function estimateLevelForPlayers(levelData, targetPlayers) {
  for (const d of levelData) {
    if (!d.isBreak && d.playersEnd <= targetPlayers) {
      return `Level ${d.levelNum} (~${formatTime(d.cumulative)})`;
    }
  }
  return 'After schedule ends';
}

function buildPressureBar(levelData, startPlayers) {
  const playLevels = levelData.filter(d => !d.isBreak);
  if (playLevels.length === 0) return '';
  
  // Each level gets a segment proportional to its duration
  const totalDuration = levelData.reduce((s, d) => s + d.duration, 0);
  
  const segments = levelData.map(d => {
    const widthPct = (d.duration / totalDuration) * 100;
    if (d.isBreak) {
      return `<div class="pressure-seg pressure-break" style="width:${widthPct}%" title="Break"></div>`;
    }
    const colorClass = d.mClass === 'healthy' ? 'pressure-low' : d.mClass === 'medium' ? 'pressure-mid' : 'pressure-high';
    const label = d.playersEnd <= 2 ? '🏆' : d.playersEnd <= 9 ? '🎯' : '';
    return `<div class="pressure-seg ${colorClass}" style="width:${widthPct}%" title="Level ${d.levelNum}: M=${d.M.toFixed(1)}, ${d.playersEnd} players">${label}</div>`;
  }).join('');
  
  // Player count sparkline below
  const playerDots = playLevels.map(d => {
    const pct = d.playersEnd / startPlayers;
    return `<div class="player-dot" style="left:${(d.cumulative / (totalDuration || 1)) * 100}%;bottom:${pct * 100}%" title="Lvl ${d.levelNum}: ~${d.playersEnd} players"></div>`;
  }).join('');
  
  return `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:0.75em;color:var(--text-dim);margin-bottom:3px">
        <span>🟢 Low pressure (M>20)</span>
        <span>🟡 Medium (M 10-20)</span>
        <span>🔴 High pressure (M&lt;10)</span>
      </div>
      <div class="pressure-bar">${segments}</div>
      <div style="display:flex;justify-content:space-between;font-size:0.72em;color:var(--text-dim);margin-top:3px">
        <span>Start</span>
        <span>← Blind pressure over time →</span>
        <span>${formatTime(totalDuration)}</span>
      </div>
    </div>
  `;
}

$('#save-schedule-btn').addEventListener('click', async () => {
  const name = $('#schedule-name').value.trim();
  if (!name) return alert('Please enter a schedule name');
  if (currentLevels.length === 0) return alert('Add at least one level');
  
  const levels = currentLevels.map((l, i) => ({
    level_number: l.is_break ? 0 : l.level_number,
    small_blind: l.small_blind,
    big_blind: l.big_blind,
    ante: l.ante,
    duration_minutes: l.duration_minutes,
    is_break: l.is_break,
    after_round: l.is_break ? (l.after_round || 0) : 0
  }));
  
  if (editingScheduleId) {
    await api(`blind-schedules/${editingScheduleId}`, { method: 'PUT', body: { name, levels } });
    editingScheduleId = null;
    $('#save-schedule-btn').textContent = 'Save Schedule';
  } else {
    await api('blind-schedules', { method: 'POST', body: { name, levels } });
  }
  
  $('#schedule-name').value = '';
  currentLevels = [
    { level_number: 1, small_blind: 5, big_blind: 10, ante: 0, duration_minutes: 20, is_break: false }
  ];
  loadBlinds();
});

function renderSavedSchedules() {
  const container = $('#saved-schedules-list');
  if (blindSchedules.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📋</div>No saved schedules yet</div>';
    return;
  }
  
  container.innerHTML = blindSchedules.map(sched => {
    const playLevels = sched.levels.filter(l => !l.is_break);
    const totalMin = sched.levels.reduce((s, l) => s + l.duration_minutes, 0);
    const maxBB = playLevels.length > 0 ? playLevels[playLevels.length - 1].big_blind : 0;
    return `
      <div class="saved-item">
        <div class="saved-item-info">
          <h3>${sched.name}</h3>
          <p>${playLevels.length} levels · ${formatTime(totalMin)} · Blinds up to ${fmt(maxBB)}</p>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="printSchedule(${sched.id})">🖨 Export</button>
          <button class="btn btn-secondary btn-sm" onclick="copySchedule(${sched.id})">📋 Copy</button>
          <button class="btn btn-secondary btn-sm" onclick="renameSchedule(${sched.id})">✏️ Rename</button>
          <button class="btn btn-secondary btn-sm" onclick="editSchedule(${sched.id})">Edit</button>
          <button class="btn btn-danger" onclick="deleteSchedule(${sched.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function editSchedule(id) {
  const sched = blindSchedules.find(s => s.id === id);
  if (!sched) return;
  editingScheduleId = id;
  $('#schedule-name').value = sched.name;
  
  // Reconstruct levels with after_round for breaks
  // For legacy data without after_round, infer from position
  let lastPlayLevel = 0;
  currentLevels = sched.levels.map(l => {
    if (!l.is_break) {
      lastPlayLevel = l.level_number;
      return {
        level_number: l.level_number,
        small_blind: l.small_blind,
        big_blind: l.big_blind,
        ante: l.ante,
        duration_minutes: l.duration_minutes,
        is_break: false
      };
    } else {
      return {
        level_number: 0,
        small_blind: 0,
        big_blind: 0,
        ante: 0,
        duration_minutes: l.duration_minutes,
        is_break: true,
        after_round: l.after_round || lastPlayLevel || 1
      };
    }
  });
  
  $('#save-schedule-btn').textContent = 'Update Schedule';
  
  // Set default round length to the most common duration in the loaded schedule
  const playDurations = currentLevels.filter(l => !l.is_break).map(l => l.duration_minutes);
  if (playDurations.length > 0) {
    // Find the most common duration
    const freq = {};
    playDurations.forEach(d => freq[d] = (freq[d] || 0) + 1);
    const mostCommon = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    $('#default-round-length').value = mostCommon;
  }
  
  // Set rebuy-through to the number of play levels if it exceeds current value
  const numPlayLevels = currentLevels.filter(l => !l.is_break).length;
  const currentRebuyThrough = parseInt($('#pred-rebuy-through').value) || 4;
  if (currentRebuyThrough > numPlayLevels) {
    $('#pred-rebuy-through').value = Math.min(numPlayLevels, 4);
  }
  
  renderLevelsTable();
  $('#page-blinds').scrollIntoView({ behavior: 'smooth' });
}

async function deleteSchedule(id) {
  if (!confirm('Delete this blind schedule?')) return;
  await api(`blind-schedules/${id}`, { method: 'DELETE' });
  loadBlinds();
}

async function copySchedule(id) {
  const sched = blindSchedules.find(s => s.id === id);
  if (!sched) return;
  const newName = prompt('Name for the copy:', sched.name + ' (Copy)');
  if (!newName) return;
  const levels = sched.levels.map(l => ({
    level_number: l.is_break ? 0 : l.level_number,
    small_blind: l.small_blind,
    big_blind: l.big_blind,
    ante: l.ante,
    duration_minutes: l.duration_minutes,
    is_break: l.is_break,
    after_round: l.after_round || 0
  }));
  await api('blind-schedules', { method: 'POST', body: { name: newName, levels } });
  loadBlinds();
}

async function renameSchedule(id) {
  const sched = blindSchedules.find(s => s.id === id);
  if (!sched) return;
  const newName = prompt('New name:', sched.name);
  if (!newName || newName === sched.name) return;
  const levels = sched.levels.map(l => ({
    level_number: l.is_break ? 0 : l.level_number,
    small_blind: l.small_blind,
    big_blind: l.big_blind,
    ante: l.ante,
    duration_minutes: l.duration_minutes,
    is_break: l.is_break,
    after_round: l.after_round || 0
  }));
  await api(`blind-schedules/${id}`, { method: 'PUT', body: { name: newName, levels } });
  loadBlinds();
}

// ============ TOURNAMENTS PAGE ============

// Rebuy checkbox toggle
$('#tourney-rebuy-allowed').addEventListener('change', function() {
  $('#rebuy-fields').style.display = this.checked ? 'block' : 'none';
});

async function loadTournaments() {
  stackConfigs = await api('stack-configs');
  blindSchedules = await api('blind-schedules');
  tournaments = await api('tournaments');
  chipColors = await api('chip-colors');
  
  // Populate dropdowns
  const stackSelect = $('#tourney-stack');
  stackSelect.innerHTML = '<option value="">-- Select Stack --</option>';
  stackConfigs.forEach(sc => {
    const val = sc.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    stackSelect.innerHTML += `<option value="${sc.id}">${sc.name} (${fmt(val)})</option>`;
  });
  
  const schedSelect = $('#tourney-schedule');
  schedSelect.innerHTML = '<option value="">-- Select Schedule --</option>';
  blindSchedules.forEach(bs => {
    const totalMin = bs.levels.reduce((s, l) => s + l.duration_minutes, 0);
    schedSelect.innerHTML += `<option value="${bs.id}">${bs.name} (${formatTime(totalMin)})</option>`;
  });
  
  // Rebuy stack dropdown
  const rebuyStackSelect = $('#tourney-rebuy-stack');
  rebuyStackSelect.innerHTML = '<option value="">-- Same as starting stack --</option>';
  stackConfigs.forEach(sc => {
    const val = sc.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    rebuyStackSelect.innerHTML += `<option value="${sc.id}">${sc.name} (${fmt(val)})</option>`;
  });
  
  renderSavedTournaments();
}

$('#save-tourney-btn').addEventListener('click', async () => {
  const name = $('#tourney-name').value.trim();
  const stack_config_id = parseInt($('#tourney-stack').value) || null;
  const blind_schedule_id = parseInt($('#tourney-schedule').value) || null;
  const num_players = parseInt($('#tourney-players').value) || 9;
  const rebuy_allowed = $('#tourney-rebuy-allowed').checked;
  const rebuy_stack_config_id = parseInt($('#tourney-rebuy-stack').value) || stack_config_id;
  const rebuy_cost = parseFloat($('#tourney-rebuy-cost').value) || 0;
  const rebuy_max = parseInt($('#tourney-rebuy-max').value) || 1;
  const rebuy_through_level = parseInt($('#tourney-rebuy-through').value) || 4;
  
  if (!name) return alert('Enter a tournament name');
  if (!stack_config_id) return alert('Select a starting stack');
  if (!blind_schedule_id) return alert('Select a blind schedule');
  
  await api('tournaments', { method: 'POST', body: { 
    name, stack_config_id, blind_schedule_id, num_players,
    rebuy_allowed, rebuy_stack_config_id, rebuy_max, rebuy_through_level, rebuy_cost
  }});
  $('#tourney-name').value = '';
  loadTournaments();
});

function renderSavedTournaments() {
  const container = $('#saved-tournaments-list');
  if (tournaments.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">🏆</div>No tournaments yet. Create stacks and schedules first!</div>';
    return;
  }
  
  container.innerHTML = tournaments.map(t => {
    const rebuyInfo = t.rebuy_allowed ? ` · 🔄 Rebuys (max ${t.rebuy_max}, through lvl ${t.rebuy_through_level})` : '';
    return `
      <div class="saved-item">
        <div class="saved-item-info">
          <h3>${t.name}</h3>
          <p>${t.num_players} players · ${t.stack_name || 'No stack'} · ${t.schedule_name || 'No schedule'}${rebuyInfo}</p>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewTournament(${t.id})">View Details</button>
          <button class="btn btn-danger" onclick="deleteTournament(${t.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function viewTournament(id) {
  const data = await api(`tournaments/${id}/details`);
  
  const section = $('#tourney-detail-section');
  section.style.display = 'block';
  $('#tourney-detail-title').textContent = data.name;
  
  if (!data.stack || !data.schedule) {
    $('#tourney-detail-content').innerHTML = '<p>Missing stack or schedule configuration.</p>';
    return;
  }
  
  const stackValue = data.stack.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const chipsPerPlayer = data.stack.chips.reduce((sum, c) => sum + c.quantity, 0);
  
  // Calculate max players based on inventory
  let maxPlayers = Infinity;
  for (const stackChip of data.stack.chips) {
    const inv = data.inventory.find(i => i.denomination === stackChip.denomination);
    if (inv && stackChip.quantity > 0) {
      maxPlayers = Math.min(maxPlayers, Math.floor(inv.total_count / stackChip.quantity));
    }
  }
  if (maxPlayers === Infinity) maxPlayers = 0;
  
  // Factor in rebuys for chip calculation
  let rebuyChipsNeeded = '';
  let maxPlayersWithRebuys = maxPlayers;
  if (data.rebuy_allowed && data.rebuy_stack) {
    const rebuyStackValue = data.rebuy_stack.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    // Worst case: every player rebuys max times
    let maxRebuyPlayers = Infinity;
    for (const stackChip of data.stack.chips) {
      const rebuyChip = data.rebuy_stack.chips.find(r => r.denomination === stackChip.denomination);
      const rebuyQtyPerPlayer = rebuyChip ? rebuyChip.quantity * data.rebuy_max : 0;
      const totalPerPlayer = stackChip.quantity + rebuyQtyPerPlayer;
      const inv = data.inventory.find(i => i.denomination === stackChip.denomination);
      if (inv && totalPerPlayer > 0) {
        maxRebuyPlayers = Math.min(maxRebuyPlayers, Math.floor(inv.total_count / totalPerPlayer));
      }
    }
    if (maxRebuyPlayers === Infinity) maxRebuyPlayers = 0;
    maxPlayersWithRebuys = maxRebuyPlayers;
    
    rebuyChipsNeeded = `
      <div class="summary-row">
        <span class="summary-label">Rebuy Stack</span>
        <span class="summary-value">${fmt(rebuyStackValue)} · Max ${data.rebuy_max} per player</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Rebuy Cost</span>
        <span class="summary-value">${fmt(data.rebuy_cost)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Rebuy Window</span>
        <span class="summary-value">Through Level ${data.rebuy_through_level}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Max Players (with all rebuys)</span>
        <span class="summary-value ${maxPlayersWithRebuys >= data.num_players ? 'good' : 'danger'}">${maxPlayersWithRebuys}</span>
      </div>
    `;
  }
  
  const totalChipsInPlay = stackValue * data.num_players;
  
  // Build timeline
  let cumulativeMinutes = 0;
  const totalMinutes = data.schedule.levels.reduce((s, l) => s + l.duration_minutes, 0);
  
  let prevSmallest = null;
  
  const timelineRows = data.schedule.levels.map(lvl => {
    const startMin = cumulativeMinutes;
    cumulativeMinutes += lvl.duration_minutes;
    
    const isRebuyWindow = data.rebuy_allowed && !lvl.is_break && lvl.level_number <= data.rebuy_through_level;
    const rebuyClass = isRebuyWindow ? ' rebuy-window' : '';
    
    if (lvl.is_break) {
      return `
        <div class="timeline-level break-level">
          <div>☕</div>
          <div>BREAK</div>
          <div>${lvl.duration_minutes} min</div>
          <div>${formatTime(cumulativeMinutes)}</div>
          <div></div>
        </div>
      `;
    }
    
    const bbs = lvl.big_blind > 0 ? Math.floor(stackValue / lvl.big_blind) : 0;
    const bbClass = bbs >= 50 ? 'healthy' : bbs >= 20 ? 'medium' : 'short';
    
    const smallest = Math.min(lvl.small_blind, lvl.big_blind, lvl.ante || Infinity);
    let chipUp = '';
    if (prevSmallest !== null && smallest > prevSmallest) {
      chipUp = `↑ ${fmt(prevSmallest)}`;
    }
    prevSmallest = smallest;
    
    const rebuyTag = isRebuyWindow ? '<span style="color:var(--gold);font-size:0.8em"> 🔄</span>' : '';
    
    return `
      <div class="timeline-level${rebuyClass}">
        <div>Lvl ${lvl.level_number}${rebuyTag}</div>
        <div>${fmt(lvl.small_blind)}/${fmt(lvl.big_blind)}${lvl.ante > 0 ? ' + ' + fmt(lvl.ante) : ''}</div>
        <div>${lvl.duration_minutes} min</div>
        <div><span class="bb-count ${bbClass}">${bbs} BB</span></div>
        <div class="chip-up-yes">${chipUp}</div>
      </div>
    `;
  });
  
  const playerWarning = data.num_players > maxPlayers 
    ? `<span class="summary-value danger">⚠ Not enough chips! Max ${maxPlayers} players</span>`
    : `<span class="summary-value good">✓ ${maxPlayers} max supported</span>`;
  
  // Build stack visual for the tournament
  const stackVisualHTML = buildStackVisual(data.stack.chips, data.stack.name, `${chipsPerPlayer} chips · ${fmt(stackValue)}`);
  
  // Rebuy stack visual
  let rebuyVisualHTML = '';
  if (data.rebuy_allowed && data.rebuy_stack) {
    const rebuyValue = data.rebuy_stack.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
    const rebuyChipCount = data.rebuy_stack.chips.reduce((sum, c) => sum + c.quantity, 0);
    rebuyVisualHTML = buildStackVisual(data.rebuy_stack.chips, '🔄 Rebuy Stack', `${rebuyChipCount} chips · ${fmt(rebuyValue)}`);
  }
  
  $('#tourney-detail-content').innerHTML = `
    <div class="summary-box">
      <div class="summary-row">
        <span class="summary-label">Players</span>
        <span class="summary-value">${data.num_players}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Starting Stack</span>
        <span class="summary-value">${fmt(stackValue)} (${chipsPerPlayer} chips)</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Chips in Play</span>
        <span class="summary-value">${fmt(totalChipsInPlay)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Chip Inventory Check</span>
        ${playerWarning}
      </div>
      ${rebuyChipsNeeded}
      <div class="summary-row">
        <span class="summary-label">Estimated Duration</span>
        <span class="summary-value warning">${formatTime(totalMinutes)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Starting BB</span>
        <span class="summary-value good">${data.schedule.levels.length > 0 && data.schedule.levels[0].big_blind > 0 ? Math.floor(stackValue / data.schedule.levels[0].big_blind) + ' BB' : '—'}</span>
      </div>
    </div>
    
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:20px">
      <div style="flex:1;min-width:300px">${stackVisualHTML}</div>
      ${rebuyVisualHTML ? `<div style="flex:1;min-width:300px">${rebuyVisualHTML}</div>` : ''}
    </div>
    
    <h3 style="margin-top: 20px; color: var(--green);">Tournament Timeline</h3>
    ${data.rebuy_allowed ? '<p style="color:var(--gold);font-size:0.85em;margin-bottom:8px">🔄 Gold border = rebuy window open</p>' : ''}
    <div class="tourney-timeline">
      <div class="timeline-level" style="font-weight:600; color: var(--text-dim); font-size: 0.85em;">
        <div>Level</div>
        <div>Blinds</div>
        <div>Duration</div>
        <div>BB Count</div>
        <div>Chip-Up</div>
      </div>
      ${timelineRows.join('')}
    </div>
    
    <div style="text-align:center;margin-top:20px">
      <button class="btn btn-print" onclick="window.print()">🖨 Print Tournament Sheet</button>
    </div>
  `;
  
  section.scrollIntoView({ behavior: 'smooth' });
}

// ============ PRINT / EXPORT ============

function printSchedule(id) {
  const sched = blindSchedules.find(s => s.id === id);
  if (!sched) return;
  
  const playLevels = sched.levels.filter(l => !l.is_break);
  const breakLevels = sched.levels.filter(l => l.is_break);
  const totalMin = sched.levels.reduce((s, l) => s + l.duration_minutes, 0);
  const playMin = playLevels.reduce((s, l) => s + l.duration_minutes, 0);
  const breakMin = breakLevels.reduce((s, l) => s + l.duration_minutes, 0);
  const maxBB = playLevels.length > 0 ? playLevels[playLevels.length - 1].big_blind : 0;
  
  // Get rebuy settings from predictor inputs
  const totalRebuys = parseInt($('#pred-rebuys')?.value) || 0;
  const rebuyThroughLevel = parseInt($('#pred-rebuy-through')?.value) || 4;
  const hasRebuys = totalRebuys > 0;
  
  let cumMin = 0;
  let rowIndex = 0;
  let rebuyEndInserted = false;
  
  const rows = sched.levels.map(lvl => {
    let prefix = '';
    // Insert "REBUYS END" marker after the last rebuy-eligible level
    if (hasRebuys && !lvl.is_break && !rebuyEndInserted && lvl.level_number > rebuyThroughLevel) {
      rebuyEndInserted = true;
      prefix = `<tr class="rebuy-end-row"><td colspan="6">🔄 REBUYS END — No more re-entries after Level ${rebuyThroughLevel}</td></tr>`;
    }
    
    const start = cumMin;
    cumMin += lvl.duration_minutes;
    if (lvl.is_break) {
      return prefix + `<tr class="break-row"><td colspan="6">☕ BREAK — ${lvl.duration_minutes} min <span class="break-time">(${formatTime(start)} → ${formatTime(cumMin)})</span></td></tr>`;
    }
    rowIndex++;
    const stripe = rowIndex % 2 === 0 ? ' even' : '';
    const rebuyClass = hasRebuys && lvl.level_number <= rebuyThroughLevel ? ' rebuy-window' : '';
    // Color-code the level number based on blind pressure progression
    const pct = playLevels.indexOf(lvl) / Math.max(playLevels.length - 1, 1);
    const r = Math.round(46 + pct * 185);  // 2e → e3
    const g = Math.round(204 - pct * 128);  // cc → 4c
    const b = Math.round(113 - pct * 73);   // 71 → 3c
    const levelColor = `rgb(${r},${g},${b})`;
    
    return prefix + `<tr class="${stripe}${rebuyClass}">
      <td class="lvl-cell"><span class="lvl-badge" style="background:${levelColor}">${lvl.level_number}</span></td>
      <td class="blinds-cell">${fmt(lvl.small_blind)} / ${fmt(lvl.big_blind)}${lvl.ante > 0 ? `<span class="ante"> + ${fmt(lvl.ante)}</span>` : ''}</td>
      <td>${lvl.duration_minutes} min</td>
      <td class="time-cell">${formatTime(start)}</td>
      <td class="time-cell">${formatTime(cumMin)}</td>
      <td class="cumulative">${formatTime(cumMin)}</td>
    </tr>`;
  }).join('');
  
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${sched.name} — Blind Schedule</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 12px 20px;
      color: #1a1a2e;
      background: linear-gradient(170deg, #eef4fb 0%, #e4eef8 40%, #dde8f4 100%);
      min-height: 100vh;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #2ecc71;
    }
    .header-icon { font-size: 1.4em; margin-bottom: 0; }
    h1 { font-size: 1.3em; font-weight: 700; color: #1a1a2e; margin-bottom: 1px; }
    .subtitle { color: #6b7a86; font-size: 0.85em; }
    .stats-bar {
      display: flex; gap: 10px; justify-content: center;
      margin: 6px 0 8px; flex-wrap: wrap;
    }
    .stat {
      text-align: center; padding: 4px 10px;
      background: white; border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .stat-value { font-size: 1.1em; font-weight: 700; color: #2ecc71; }
    .stat-label { font-size: 0.7em; color: #8895a5; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 1px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 8px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    thead th {
      background: linear-gradient(135deg, #1a3a1a 0%, #2a5a2a 100%);
      color: white; padding: 6px 10px; text-align: left;
      font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
    }
    thead th:first-child { border-radius: 10px 0 0 0; }
    thead th:last-child { border-radius: 0 10px 0 0; }
    tbody td {
      padding: 5px 10px; font-size: 0.9em; background: white;
      border-bottom: 1px solid #f0f2f5;
    }
    tbody tr.even td { background: #f7faf7; }
    tbody tr:hover td { background: #e8f5e8; }
    tbody tr:last-child td:first-child { border-radius: 0 0 0 10px; }
    tbody tr:last-child td:last-child { border-radius: 0 0 10px 0; }
    .lvl-cell { text-align: center; width: 40px; }
    .lvl-badge {
      display: inline-block; width: 22px; height: 22px; line-height: 22px;
      border-radius: 50%; color: white; font-weight: 700; font-size: 0.75em;
      text-align: center;
    }
    .blinds-cell { font-weight: 600; font-size: 0.9em; color: #1a1a2e; }
    .ante { color: #8895a5; font-weight: 400; font-size: 0.85em; }
    .time-cell { color: #5a6a76; }
    .cumulative { color: #8895a5; font-size: 0.85em; }
    .break-row td {
      background: linear-gradient(90deg, #fef9e7 0%, #fdf2d5 100%) !important;
      text-align: center; font-style: italic; color: #9a7b2e;
      font-weight: 500; letter-spacing: 0.3px;
      border-bottom: 1px solid #f0e6c0;
    }
    .break-time { font-weight: 400; font-size: 0.85em; opacity: 0.7; }
    tr.rebuy-window td { border-left: 3px solid #f0c040; }
    tr.rebuy-window td:first-child { border-left: 3px solid #f0c040; }
    .rebuy-end-row td {
      background: linear-gradient(90deg, #fce4e4 0%, #fdeaea 50%, #fce4e4 100%) !important;
      text-align: center; font-weight: 600; color: #c0392b;
      letter-spacing: 0.3px; font-size: 0.85em;
      border-bottom: 2px solid #e74c3c;
      border-top: 2px solid #e74c3c;
      padding: 6px 10px;
    }
    .footer {
      margin-top: 20px; font-size: 0.78em; color: #a0a8b0;
      text-align: center; padding-top: 12px;
      border-top: 1px solid #e8ecf0;
    }
    @media print {
      body { padding: 15px 20px; background: white; }
      button { display:none !important; }
      .stat { box-shadow: none; border: 1px solid #ddd; }
      table { box-shadow: none; }
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  </style></head><body>
  <div class="header">
    <div class="header-icon">♠</div>
    <h1>${sched.name}</h1>
    <div class="subtitle">Blind Schedule</div>
  </div>
  <div class="stats-bar">
    <div class="stat"><div class="stat-value">${playLevels.length}</div><div class="stat-label">Levels</div></div>
    <div class="stat"><div class="stat-value">${formatTime(playMin)}</div><div class="stat-label">Play Time</div></div>
    <div class="stat"><div class="stat-value">${breakLevels.length}</div><div class="stat-label">Breaks</div></div>
    <div class="stat"><div class="stat-value">${formatTime(totalMin)}</div><div class="stat-label">Total</div></div>
    <div class="stat"><div class="stat-value">${fmt(maxBB)}</div><div class="stat-label">Max BB</div></div>
  </div>
  <table>
    <thead><tr><th>Lvl</th><th>Blinds</th><th>Duration</th><th>Start</th><th>End</th><th>Elapsed</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">♠ Poker Tournament Designer · ${new Date().toLocaleDateString()}</div>
  <br><button onclick="window.print()" style="display:block;margin:12px auto 0;padding:10px 28px;background:linear-gradient(135deg,#1a3a1a,#2a5a2a);color:white;border:none;border-radius:6px;cursor:pointer;font-size:1em;font-weight:600">🖨 Print / Save PDF</button>
  <script>setTimeout(() => window.print(), 400);</script>
  </body></html>`;
  
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

function printStack(id) {
  const config = stackConfigs.find(c => c.id === id);
  if (!config) return;
  
  // Chip color map (inline for print window)
  const COLORS = {1:'#e8e8e8',5:'#d4a843',25:'#e8a0b4',100:'#4a7fbf',500:'#8b5fbf',1000:'#2a8a7a'};
  function chipColor(denom) { return COLORS[denom] || COLORS[Math.floor(denom)] || '#aaa'; }
  function isLight(hex) {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000 > 150;
  }
  function fmtD(n) { return n>=1000?'$'+n.toLocaleString():'$'+n; }
  function shortD(n) { return n>=1000?(n/1000)+'K':''+n; }
  
  // Build SVG chip tower for a chip+quantity
  function chipTowerSVG(denom, qty) {
    const color = chipColor(denom);
    const text = isLight(color) ? '#1a1a1a' : '#ffffff';
    const chipH = 8;   // smaller slices
    const chipW = 38;  // narrower
    const rx = chipW / 2 - 1;
    const ry = 4;
    const maxShow = Math.min(qty, 12);
    const totalH = maxShow * chipH + 16;
    
    let slices = '';
    for (let i = 0; i < maxShow; i++) {
      const y = totalH - 16 - (i + 1) * chipH;
      slices += `<ellipse cx="${chipW/2}" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>`;
      slices += `<rect x="1" y="${y}" width="${chipW-2}" height="${chipH}" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="0.5"/>`;
    }
    const topY = totalH - 16 - maxShow * chipH;
    slices += `<ellipse cx="${chipW/2}" cy="${totalH-16}" rx="${rx}" ry="${ry}" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"/>`;
    slices += `<ellipse cx="${chipW/2}" cy="${topY}" rx="${rx}" ry="${ry}" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.8"/>`;
    slices += `<ellipse cx="${chipW/2}" cy="${topY}" rx="${rx-6}" ry="${ry-1.5}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="0.8" stroke-dasharray="2,1.5"/>`;
    slices += `<text x="${chipW/2}" y="${topY+1.5}" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="bold" font-family="Arial,sans-serif" fill="${text}">${shortD(denom)}</text>`;
    
    return `<svg width="${chipW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
  }
  
  // Build a visual stack section
  function stackSection(chips, title, value) {
    if (!chips || chips.length === 0 || chips.every(c => c.quantity === 0)) return '';
    
    const towers = chips.filter(c => c.quantity > 0).map(chip => {
      const color = chipColor(chip.denomination);
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          ${chipTowerSVG(chip.denomination, chip.quantity)}
          <div style="font-size:10px;font-weight:700;color:${color}">${fmtD(chip.denomination)}</div>
          <div style="font-size:10px;color:#9ba8b4">× ${chip.quantity}</div>
          <div style="font-size:9px;color:#6b7a86">${fmtD(chip.denomination * chip.quantity)}</div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="stack-section">
        <div class="section-header">
          <span class="section-title">${title}</span>
          <span class="section-value">${fmtD(value)}</span>
        </div>
        <div class="chip-towers">${towers}</div>
      </div>
    `;
  }
  
  const startValue = config.chips.reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const r1Value = (config.rebuy1_chips || []).reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  const r2Value = (config.rebuy2_chips || []).reduce((sum, c) => sum + c.denomination * c.quantity, 0);
  
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${config.name} — Stack Sheet</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #ecf0f1;
      padding: 30px 40px;
      min-height: 100vh;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 2px solid #2ecc71;
    }
    .header-spade { font-size: 2em; color: #2ecc71; display:block; margin-bottom:4px; }
    .header-title { font-size: 2em; font-weight: 700; color: #ecf0f1; }
    .header-sub { color: #95a5a6; font-size: 0.9em; margin-top: 4px; }
    .stack-section {
      margin-bottom: 22px;
      background: #16213e;
      border-radius: 10px;
      padding: 16px 20px;
      border: 1px solid #2c3e50;
    }
    .section-header {
      display:flex; justify-content:space-between; align-items:center;
      margin-bottom: 14px; padding-bottom: 8px;
      border-bottom: 1px solid #2ecc71;
    }
    .section-title { font-size: 1em; font-weight: 700; color: #2ecc71; }
    .section-value { font-size: 1.2em; font-weight: 700; color: #f39c12; }
    .chip-towers { display:flex; gap:18px; align-items:flex-end; flex-wrap:wrap; padding: 6px 0; }
    .footer { margin-top: 20px; font-size: 0.75em; color: #636e72; text-align: center; border-top: 1px solid #2c3e50; padding-top: 10px; }
    @media print {
      body { padding: 15px 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      button { display:none !important; }
    }
  </style></head><body>
  <div class="header">
    <span class="header-spade">♠</span>
    <div class="header-title">${config.name}</div>
    <div class="header-sub">Starting Stack: ${fmtD(startValue)}${r1Value > 0 ? ` &nbsp;·&nbsp; Rebuy 1: ${fmtD(r1Value)}` : ''}${r2Value > 0 ? ` &nbsp;·&nbsp; Rebuy 2: ${fmtD(r2Value)}` : ''}</div>
  </div>
  ${stackSection(config.chips, '🎯 Starting Stack', startValue)}
  ${r1Value > 0 ? stackSection(config.rebuy1_chips, '🔄 Rebuy 1', r1Value) : ''}
  ${r2Value > 0 ? stackSection(config.rebuy2_chips, '🔄 Rebuy 2', r2Value) : ''}
  <div class="footer">Poker Tournament Designer &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}</div>
  <br><button onclick="window.print()" style="display:block;margin:12px auto 0;padding:8px 24px;background:#2ecc71;color:#1a1a2e;border:none;border-radius:6px;cursor:pointer;font-size:1em;font-weight:700">🖨 Print / Save PDF</button>
  <script>setTimeout(() => window.print(), 400);</script>
  </body></html>`;
  
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

async function deleteTournament(id) {
  if (!confirm('Delete this tournament?')) return;
  await api(`tournaments/${id}`, { method: 'DELETE' });
  $('#tourney-detail-section').style.display = 'none';
  loadTournaments();
}

// ============ INIT ============
loadInventory();
