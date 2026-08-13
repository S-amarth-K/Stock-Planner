/**
 * config.js — Global defaults for the Indian Market Learning & Entry Planner
 * Change these values to adjust strategy behaviour app-wide.
 */

const CONFIG = {
  // ── Capital & Risk ─────────────────────────────────────────────────────────
  capital: 200000,          // Default trading capital in ₹
  riskPercent: 1.0,         // Max risk per trade as % of capital (0.5–1% for beginners)
  minRR: 2.0,               // Minimum reward:risk ratio allowed (skip trade if below this)

  // ── Moving Averages ────────────────────────────────────────────────────────
  fastMA: 20,               // Short-term SMA period
  slowMA: 50,               // Long-term SMA period
  emaFast: 9,               // Fast EMA period
  emaSlow: 21,              // Slow EMA period

  // ── Momentum ───────────────────────────────────────────────────────────────
  rsiLength: 14,            // RSI lookback period
  rsiOverbought: 70,        // RSI above this = overbought caution zone
  rsiOversold: 30,          // RSI below this = oversold / potential reversal

  // ── Volatility / Stops ─────────────────────────────────────────────────────
  atrLength: 14,            // ATR lookback period
  atrStopMultiplier: 1.5,   // Stop = entry − (atrMultiplier × ATR)
  atrTarget1: 2.0,          // Target 1 = entry + (atrTarget1 × ATR)
  atrTarget2: 3.0,          // Target 2 = entry + (atrTarget2 × ATR)

  // ── Volume ─────────────────────────────────────────────────────────────────
  volumeAvgPeriod: 20,      // Days used to compute average volume
  volumeBreakoutThreshold: 1.5, // Breakout volume must be > this × avg volume

  // ── Breakout ───────────────────────────────────────────────────────────────
  breakoutLookback: 20,     // Days used to find recent high/resistance

  // ── Portfolio Limits ───────────────────────────────────────────────────────
  maxPositions: 6,          // Max concurrent open positions
  maxSectorExposure: 0.40,  // Max 40% of capital in one sector
  maxSingleStockPct: 0.20,  // Max 20% of capital in one stock

  // ── Costs (India) ──────────────────────────────────────────────────────────
  brokeragePerTrade: 20,    // ₹20 flat brokerage per side (Zerodha-style)
  slippagePct: 0.001,       // 0.1% slippage on each fill
  stt: 0.001,               // STT on sell side (equity delivery)
  exchangeTxnCharge: 0.0000345,

  // ── Scoring Thresholds ─────────────────────────────────────────────────────
  scoreEnter: 80,           // Score ≥ this → "Enter"
  scoreWatch: 60,           // Score ≥ this → "Watch"; below → "Avoid"

  // ── Market Data ────────────────────────────────────────────────────────────
  dataLookbackDays: 365,    // Days of synthetic/historical data to generate
  candleInterval: 'day',    // Candle timeframe

  // ── UI ─────────────────────────────────────────────────────────────────────
  currentCapital: 200000,   // Live capital tracker (persisted to localStorage)
};

// Persist capital changes to localStorage
function saveConfig() {
  localStorage.setItem('imlep_config', JSON.stringify({
    capital: CONFIG.capital,
    riskPercent: CONFIG.riskPercent,
    currentCapital: CONFIG.currentCapital,
  }));
}

function loadConfig() {
  const saved = localStorage.getItem('imlep_config');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(CONFIG, parsed);
  }
}

loadConfig();
