/**
 * planner.js — Entry Planner module.
 * Combines market regime + setup detection + risk module into one complete trade plan.
 * This is the core output the user reads before deciding whether to act.
 */

/**
 * Generate a complete trade plan for one stock.
 * @param {string} symbol
 * @param {Object} marketRegime — from analyseMarket()
 * @returns {Object} Full trade plan
 */
function generatePlan(symbol, marketRegime) {
  const stock = UNIVERSE.find(s => s.symbol === symbol);
  if (!stock) return null;

  // 1. Run setup detection
  const setup = analyseStock(symbol, marketRegime);

  // 2. Fallback: compute even if no valid setup (for display)
  const candles = getCandles(symbol, 365);
  const ind = computeAll(candles);
  const n = candles.length;
  const last = candles[n - 1];
  const quote = getLatestQuote(symbol);

  // 3. Get decision
  const confidence = setup ? setup.confidence : 0;
  const decision = getDecision(confidence);

  // 4. Position sizing (only if valid setup)
  let positionPlan = null;
  if (setup && setup.valid) {
    positionPlan = calculatePosition({
      capital: CONFIG.capital,
      riskPercent: CONFIG.riskPercent,
      entry: setup.entry,
      stop: setup.stop,
      target1: setup.target1,
      target2: setup.target2,
    });
  }

  // 5. Scoring breakdown for transparency
  const scoringBreakdown = buildScoringBreakdown(symbol, ind, n, last, marketRegime, setup);

  // 6. Build full plan object
  return {
    symbol,
    stock,
    quote,
    marketRegime,
    setup,
    decision,
    positionPlan,
    scoringBreakdown,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build the transparent scoring model shown to the user.
 * Every point has an explanation.
 */
function buildScoringBreakdown(symbol, ind, n, last, marketRegime, setup) {
  const sma20  = ind.sma20[n - 1];
  const sma50  = ind.sma50[n - 1];
  const rsiVal = ind.rsi14[n - 1];
  const avgVol = ind.avgVol20[n - 1];
  const atrVal = ind.atr14[n - 1];
  const candles = getCandles(symbol);

  const items = [];
  let total = 0;

  function item(label, description, pts, condition) {
    const earned = condition ? pts : 0;
    total += earned;
    items.push({ label, description, max: pts, earned, condition });
  }

  item(
    'Market Regime',
    'Broad market (Nifty 50) is in an uptrend above key MAs',
    20,
    marketRegime.score >= 55
  );
  item(
    'Stock above 50 SMA',
    'Primary trend is up — stock is trading above the 50-day moving average',
    15,
    sma50 && last.close > sma50
  );
  item(
    'Stock above 20 SMA',
    'Short-term momentum is aligned — stock is above the 20-day MA',
    10,
    sma20 && last.close > sma20
  );
  item(
    'Breakout above Resistance',
    `Price closed above ${CONFIG.breakoutLookback}-day high — key resistance level cleared`,
    20,
    setup && setup.type === 'Breakout' && setup.valid
  );
  item(
    'Volume Confirmation',
    `Volume is ≥ ${CONFIG.volumeBreakoutThreshold}× 20-day average — strong participation in the move`,
    15,
    setup && setup.metrics && setup.metrics.volMultiple >= CONFIG.volumeBreakoutThreshold
  );
  item(
    'RSI Constructive',
    'RSI is between 50–72 — momentum is positive without being overbought',
    10,
    rsiVal && rsiVal >= 50 && rsiVal <= 72
  );
  item(
    'Reward:Risk ≥ 2:1',
    'Trade offers at least 2× the reward vs the risk being taken',
    10,
    setup && setup.rr >= CONFIG.minRR
  );

  const maxScore = items.reduce((a, i) => a + i.max, 0);

  return { items, total, maxScore };
}

/**
 * Generate plans for all watchlisted stocks and rank them.
 * @param {Object} marketRegime
 * @returns {Array} Sorted by confidence desc
 */
function generateAllPlans(marketRegime) {
  return getWatchlist()
    .map(stock => generatePlan(stock.symbol, marketRegime))
    .filter(p => p !== null)
    .sort((a, b) => {
      const ca = a.setup ? a.setup.confidence : 0;
      const cb = b.setup ? b.setup.confidence : 0;
      return cb - ca;
    });
}
