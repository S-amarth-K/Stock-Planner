/**
 * journal.js — Trade Journal: record, review, and learn from every trade.
 * A good process can produce a losing trade. The journal separates
 * bad process from bad outcome so you can improve.
 */

const JOURNAL_KEY = 'imlep_journal';

/**
 * Load all journal entries from localStorage.
 */
function loadJournal() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save journal to localStorage.
 */
function saveJournal(entries) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

/**
 * Add a new trade record.
 * @param {Object} trade
 */
function addTrade(trade) {
  const entries = loadJournal();
  const newEntry = {
    id: Date.now(),
    date: trade.date || new Date().toISOString().slice(0, 10),
    symbol: trade.symbol || '',
    sector: trade.sector || '',
    setupType: trade.setupType || '',       // Breakout | Pullback | Momentum
    marketRegime: trade.marketRegime || '', // Strong Uptrend | Moderate | Choppy | Weak
    entry: +trade.entry || 0,
    stop: +trade.stop || 0,
    target1: +trade.target1 || 0,
    target2: +trade.target2 || 0,
    quantity: +trade.quantity || 0,
    rr: +trade.rr || 0,
    followedRules: trade.followedRules !== undefined ? trade.followedRules : true,
    thesis: trade.thesis || '',             // Why I entered in plain English
    chartNote: trade.chartNote || '',       // Observation at entry
    // ── Filled after exit ──
    exitDate: trade.exitDate || '',
    exitPrice: +trade.exitPrice || 0,
    outcome: trade.outcome || 'Open',       // Win | Loss | Breakeven | Open
    pnl: +trade.pnl || 0,
    lesson: trade.lesson || '',
    rating: +trade.rating || 0,             // Self rating: 1–5 (process quality, not outcome)
  };
  entries.unshift(newEntry);  // newest first
  saveJournal(entries);
  return newEntry;
}

/**
 * Update an existing trade (e.g., fill in exit data).
 */
function updateTrade(id, updates) {
  const entries = loadJournal();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  Object.assign(entries[idx], updates);
  // Auto-calculate P&L if exit info provided
  if (updates.exitPrice && entries[idx].quantity) {
    const pnlGross = (updates.exitPrice - entries[idx].entry) * entries[idx].quantity;
    entries[idx].pnl = +(pnlGross - CONFIG.brokeragePerTrade * 2).toFixed(2);
    entries[idx].outcome = entries[idx].pnl > 0 ? 'Win' : entries[idx].pnl < -10 ? 'Loss' : 'Breakeven';
  }
  saveJournal(entries);
  return entries[idx];
}

/**
 * Delete a journal entry.
 */
function deleteTrade(id) {
  const entries = loadJournal().filter(e => e.id !== id);
  saveJournal(entries);
}

/**
 * Journal statistics for review panel.
 */
function journalStats() {
  const entries = loadJournal().filter(e => e.outcome !== 'Open');

  if (entries.length === 0) return null;

  const wins   = entries.filter(e => e.outcome === 'Win');
  const losses = entries.filter(e => e.outcome === 'Loss');
  const be     = entries.filter(e => e.outcome === 'Breakeven');

  const totalPnL    = entries.reduce((a, e) => a + e.pnl, 0);
  const avgWin      = wins.length ? wins.reduce((a, e) => a + e.pnl, 0) / wins.length : 0;
  const avgLoss     = losses.length ? Math.abs(losses.reduce((a, e) => a + e.pnl, 0) / losses.length) : 0;
  const winRate     = entries.length ? (wins.length / entries.length) * 100 : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const followedRulesPct = entries.length
    ? (entries.filter(e => e.followedRules).length / entries.length) * 100
    : 0;

  // Setup breakdown
  const setupBreakdown = {};
  for (const e of entries) {
    if (!setupBreakdown[e.setupType]) setupBreakdown[e.setupType] = { total: 0, wins: 0, pnl: 0 };
    setupBreakdown[e.setupType].total++;
    if (e.outcome === 'Win') setupBreakdown[e.setupType].wins++;
    setupBreakdown[e.setupType].pnl += e.pnl;
  }

  return {
    total: entries.length,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate: +winRate.toFixed(1),
    totalPnL: +totalPnL.toFixed(2),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    profitFactor: +profitFactor.toFixed(2),
    followedRulesPct: +followedRulesPct.toFixed(1),
    setupBreakdown,
  };
}

/**
 * Seed demo data so the journal tab isn't empty on first open.
 */
function seedDemoTrades() {
  const existing = loadJournal();
  if (existing.length > 0) return;

  const demos = [
    {
      date: '2025-11-02', symbol: 'RELIANCE', sector: 'Energy',
      setupType: 'Breakout', marketRegime: 'Strong Uptrend',
      entry: 2820, stop: 2760, target1: 2940, target2: 2990,
      quantity: 33, rr: 2.0, followedRules: true,
      thesis: 'Price broke above 20-day high at 2810 with 1.8× average volume. Market was strong. ATR stop set below swing low.',
      exitDate: '2025-11-18', exitPrice: 2955, outcome: 'Win', pnl: 4415,
      lesson: 'Followed rules. Volume confirmation was key. Exited at Target 1. Could have held for T2 with trailing stop.',
      rating: 4,
    },
    {
      date: '2025-11-20', symbol: 'HDFCBANK', sector: 'Banking',
      setupType: 'Pullback', marketRegime: 'Moderate Uptrend',
      entry: 1625, stop: 1585, target1: 1705, target2: 1745,
      quantity: 50, rr: 2.0, followedRules: true,
      thesis: 'Stock pulled back to 20 SMA with lighter volume. Uptrend intact. Support held for 3 days.',
      exitDate: '2025-12-05', exitPrice: 1700, outcome: 'Win', pnl: 3710,
      lesson: 'Patience paid off. Took 15 days to reach target. Nearly stopped out on day 3 but held because support held.',
      rating: 5,
    },
    {
      date: '2025-12-10', symbol: 'TATAMOTORS', sector: 'Automobiles',
      setupType: 'Momentum', marketRegime: 'Moderate Uptrend',
      entry: 985, stop: 945, target1: 1065, target2: 1105,
      quantity: 50, rr: 2.0, followedRules: false,
      thesis: 'Momentum looked strong. RSI 68. Above MAs. Entered without checking market regime properly.',
      exitDate: '2025-12-15', exitPrice: 942, outcome: 'Loss', pnl: -2190,
      lesson: 'Did not check that market had turned choppy the week before. High beta name in weak market failed. Always check market regime first.',
      rating: 2,
    },
    {
      date: '2026-01-08', symbol: 'INFY', sector: 'Information Technology',
      setupType: 'Breakout', marketRegime: 'Strong Uptrend',
      entry: 1548, stop: 1495, target1: 1654, target2: 1707,
      quantity: 37, rr: 2.0, followedRules: true,
      thesis: 'IT sector leading. Breakout above resistance 1542. Volume 2.1× average. Market supportive.',
      exitDate: '2026-01-22', exitPrice: 1662, outcome: 'Win', pnl: 4218,
      lesson: 'Good trade. Volume confirmation was strong. Exited near T1. Should revisit partial exit strategy for T2.',
      rating: 4,
    },
    {
      date: '2026-02-03', symbol: 'MARUTI', sector: 'Automobiles',
      setupType: 'Pullback', marketRegime: 'Choppy / Sideways',
      entry: 12450, stop: 12100, target1: 13150, target2: 13500,
      quantity: 5, rr: 2.0, followedRules: false,
      thesis: 'Liked the stock. Entered on pullback but market was choppy. Should have waited.',
      exitDate: '2026-02-14', exitPrice: 12080, outcome: 'Loss', pnl: -1890,
      lesson: 'Never trade pullbacks in choppy markets. The stop was also too wide in hindsight for a choppy regime. Market filter is non-negotiable.',
      rating: 1,
    },
  ];

  const entries = loadJournal();
  for (const d of demos.reverse()) entries.unshift({ id: Date.now() - Math.random() * 1e9, ...d });
  saveJournal(entries);
}
