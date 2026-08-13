/**
 * setups.js — Setup detection engine.
 * Detects exactly 3 clean setups per specification.
 * Returns structured plan objects with entry, stop, targets, score, and plain-English reasoning.
 */

/**
 * Master function: analyse one stock and return the best valid setup, or null.
 * @param {string} symbol
 * @param {Object} marketRegime — output from analyseMarket()
 * @returns {Object|null} Setup plan or null if no valid setup
 */
function analyseStock(symbol, marketRegime) {
  const candles = getCandles(symbol, 365);
  if (candles.length < 60) return null;

  const ind = computeAll(candles);
  const n = candles.length;
  const last = candles[n - 1];

  const ctx = {
    candles, ind, n, last,
    marketRegime,
    symbol,
  };

  // Try each setup in priority order
  const breakout   = detectBreakout(ctx);
  const pullback   = detectPullback(ctx);
  const momentum   = detectMomentum(ctx);

  // Pick the highest-scoring valid setup
  const candidates = [breakout, pullback, momentum].filter(s => s && s.valid && s.rr >= CONFIG.minRR);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP 1: BREAKOUT
// Entry: price closes above 20-day high, with volume confirmation, above MAs
// ─────────────────────────────────────────────────────────────────────────────
function detectBreakout(ctx) {
  const { candles, ind, n, last, marketRegime, symbol } = ctx;

  const sma20  = ind.sma20[n - 1];
  const sma50  = ind.sma50[n - 1];
  const rsiVal = ind.rsi14[n - 1];
  const atrVal = ind.atr14[n - 1];
  const avgVol = ind.avgVol20[n - 1];

  if (!sma20 || !sma50 || !rsiVal || !atrVal || !avgVol) return null;

  // Resistance = highest high of previous 20 candles (excluding the last one)
  const prevHighs = candles.slice(n - CONFIG.breakoutLookback - 1, n - 1).map(c => c.high);
  const resistance = Math.max(...prevHighs);

  const priceAboveResistance = last.close > resistance;
  const volMultiple = last.volume / avgVol;
  const volumeConfirmed = volMultiple >= CONFIG.volumeBreakoutThreshold;
  const aboveSMA20 = last.close > sma20;
  const aboveSMA50 = last.close > sma50;
  const rsiOk = rsiVal > 50 && rsiVal < CONFIG.rsiOverbought;

  // ── Scoring ──
  let score = 0;
  const reasons = [], failReasons = [];

  if (marketRegime.score >= 55) { score += 20; reasons.push('Market regime is supportive'); }
  else { failReasons.push('Market regime is weak — reduces setup probability'); }

  if (aboveSMA50) { score += 15; reasons.push('Stock is above 50 SMA (primary trend up)'); }
  else { failReasons.push('Stock is below 50 SMA — no primary uptrend'); }

  if (aboveSMA20) { score += 10; reasons.push('Stock is above 20 SMA (momentum aligned)'); }
  else { failReasons.push('Stock is below 20 SMA'); }

  if (priceAboveResistance) { score += 20; reasons.push(`Price closed above ${CONFIG.breakoutLookback}-day high (₹${resistance.toFixed(2)}) — resistance cleared`); }
  else { failReasons.push(`Price has not broken above recent high of ₹${resistance.toFixed(2)}`); }

  if (volumeConfirmed) { score += 15; reasons.push(`Volume at ${volMultiple.toFixed(1)}× average — strong participation confirms breakout`); }
  else { score -= 5; failReasons.push(`Volume only ${volMultiple.toFixed(1)}× average — weak confirmation (need ≥ ${CONFIG.volumeBreakoutThreshold}×)`); }

  if (rsiOk) { score += 10; reasons.push(`RSI at ${rsiVal.toFixed(1)} — momentum zone, not overbought`); }
  else if (rsiVal >= CONFIG.rsiOverbought) { failReasons.push(`RSI at ${rsiVal.toFixed(1)} — overbought, entering late`); }

  score = Math.max(0, Math.min(100, score));
  const valid = priceAboveResistance && aboveSMA20 && aboveSMA50 && score >= 50;

  // ── Trade levels ──
  const entry  = +(last.close * 1.001).toFixed(2);              // slight buffer above close
  const stopLow = ind.swingL.filter(v => v !== null).slice(-3);
  const recentSwingLow = stopLow.length ? Math.max(...stopLow.filter(v => v < entry)) : entry - atrVal * 1.5;
  const stopByATR = +(entry - CONFIG.atrStopMultiplier * atrVal).toFixed(2);
  const stop   = +Math.min(recentSwingLow, stopByATR).toFixed(2);

  const riskPerShare = entry - stop;
  const target1 = +(entry + riskPerShare * 2).toFixed(2);
  const target2 = +(entry + riskPerShare * 3).toFixed(2);
  const rr = riskPerShare > 0 ? +((target1 - entry) / riskPerShare).toFixed(2) : 0;

  const whyEnter = `Price broke above ${CONFIG.breakoutLookback}-day resistance (₹${resistance.toFixed(2)}) with ${volMultiple.toFixed(1)}× average volume in a ${marketRegime.regime.toLowerCase()} market. Breakout with strong volume reduces the probability of a false move.`;
  const whyStop = `Stop at ₹${stop.toFixed(2)} is placed below the breakout level and recent swing low. If price falls back below this, the breakout thesis has failed and the trade idea is invalidated.`;
  const whyTarget = `Target 1 at ₹${target1.toFixed(2)} is 2R from entry. Target 2 at ₹${target2.toFixed(2)} is 3R. Reward justifies risk only when next overhead resistance leaves enough room.`;
  const whyAvoid = `If rejected: Price has not broken above key resistance, or volume is insufficient to confirm the move. Entering without a confirmed breakout increases the risk of a false breakout trap.`;

  return {
    type: 'Breakout',
    symbol,
    valid,
    entry,
    stop,
    target1,
    target2,
    rr,
    confidence: score,
    reasons,
    failReasons,
    whyEnter,
    whyStop,
    whyTarget,
    whyAvoid,
    metrics: { resistance, volMultiple: +volMultiple.toFixed(2), rsiVal: +rsiVal.toFixed(1), sma20, sma50, atrVal: +atrVal.toFixed(2) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP 2: PULLBACK TO SUPPORT
// Entry: uptrend, price retraces to MA/support, shows stabilization
// ─────────────────────────────────────────────────────────────────────────────
function detectPullback(ctx) {
  const { candles, ind, n, last, marketRegime, symbol } = ctx;

  const sma20  = ind.sma20[n - 1];
  const sma50  = ind.sma50[n - 1];
  const rsiVal = ind.rsi14[n - 1];
  const atrVal = ind.atr14[n - 1];
  const avgVol = ind.avgVol20[n - 1];

  if (!sma20 || !sma50 || !rsiVal || !atrVal) return null;

  // Trend: 50 SMA rising over last 20 bars
  const sma50_20ago = ind.sma50[n - 21];
  const trendUp = sma50_20ago ? sma50 > sma50_20ago : false;

  // Pullback: price within 3% of 20 SMA or 50 SMA
  const nearSMA20 = Math.abs(last.close - sma20) / sma20 < 0.03;
  const nearSMA50 = Math.abs(last.close - sma50) / sma50 < 0.03;
  const atSupport = nearSMA20 || nearSMA50;

  // Stabilization: last 2 candles show small range (not panicking lower)
  const lastTwoClosed = candles.slice(n - 3, n);
  const avgRange = lastTwoClosed.reduce((a, c) => a + (c.high - c.low), 0) / 3;
  const normalRange = atrVal;
  const isStabilizing = avgRange < normalRange * 1.1;

  // Pullback volume should be lighter (less selling pressure)
  const pullbackVol = last.volume / (avgVol || 1);
  const lightVolume = pullbackVol < 1.2;

  // ── Scoring ──
  let score = 0;
  const reasons = [], failReasons = [];

  if (marketRegime.score >= 55) { score += 20; reasons.push('Broad market is supportive'); }
  else { failReasons.push('Market weakness reduces pullback reliability'); }

  if (trendUp) { score += 15; reasons.push('50 SMA is rising — primary uptrend confirmed'); }
  else { failReasons.push('50 SMA is flat or falling — no clear uptrend to pull back to'); }

  if (last.close > sma50) { score += 15; reasons.push('Stock remains above 50 SMA despite pullback'); }
  else { failReasons.push('Stock has pulled back below 50 SMA — trend may be broken'); }

  if (atSupport) {
    score += 20;
    reasons.push(nearSMA20
      ? `Price near 20 SMA (₹${sma20.toFixed(2)}) — first support in an uptrend`
      : `Price near 50 SMA (₹${sma50.toFixed(2)}) — major support zone`);
  } else {
    failReasons.push('Price is not yet at a meaningful support level');
  }

  if (isStabilizing) { score += 15; reasons.push('Price is stabilizing — selling pressure reducing'); }
  else { failReasons.push('Price candles are still wide — no stabilization sign yet'); }

  if (lightVolume) { score += 10; reasons.push('Pullback on lighter volume — healthy correction, not distribution'); }
  else { failReasons.push('High volume on pullback — may indicate distribution rather than healthy correction'); }

  if (rsiVal > 40 && rsiVal < 65) { score += 5; reasons.push(`RSI at ${rsiVal.toFixed(1)} — reset from overbought without oversold`); }

  score = Math.max(0, Math.min(100, score));
  const valid = trendUp && atSupport && last.close > sma50 && score >= 55;

  // ── Trade levels ──
  const supportLevel = nearSMA20 ? sma20 : sma50;
  const entry = +(last.close * 1.001).toFixed(2);
  const stop  = +(supportLevel - CONFIG.atrStopMultiplier * 0.5 * atrVal).toFixed(2);

  const riskPerShare = entry - stop;
  const target1 = +(entry + riskPerShare * 2).toFixed(2);
  const target2 = +(entry + riskPerShare * 3).toFixed(2);
  const rr = riskPerShare > 0 ? +((target1 - entry) / riskPerShare).toFixed(2) : 0;

  const whyEnter = `Stock is in an uptrend but has pulled back to support (${nearSMA20 ? '20 SMA' : '50 SMA'} at ₹${supportLevel.toFixed(2)}). Buying near support gives a tight, logical stop and better risk:reward than chasing the stock at a high.`;
  const whyStop = `Stop at ₹${stop.toFixed(2)} is placed just below the support zone. A close below this level means the support has failed and the trend is weakening — the thesis is no longer valid.`;
  const whyTarget = `Target 1 at ₹${target1.toFixed(2)} (2R). In a pullback trade, the target is typically the prior high or resistance zone. If price breaks that, a trailing stop can capture more.`;
  const whyAvoid = `If rejected: The trend has not been confirmed, or the pullback is actually breaking down (price below 50 SMA with high volume). Waiting for stabilization is more important than entering early.`;

  return {
    type: 'Pullback',
    symbol,
    valid,
    entry,
    stop,
    target1,
    target2,
    rr,
    confidence: score,
    reasons,
    failReasons,
    whyEnter,
    whyStop,
    whyTarget,
    whyAvoid,
    metrics: { sma20, sma50, rsiVal: +rsiVal.toFixed(1), atrVal: +atrVal.toFixed(2), pullbackVol: +pullbackVol.toFixed(2) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP 3: MOMENTUM CONTINUATION
// Entry: trending stock, RSI constructive, no major overhead resistance
// ─────────────────────────────────────────────────────────────────────────────
function detectMomentum(ctx) {
  const { candles, ind, n, last, marketRegime, symbol } = ctx;

  const sma20  = ind.sma20[n - 1];
  const sma50  = ind.sma50[n - 1];
  const rsiVal = ind.rsi14[n - 1];
  const atrVal = ind.atr14[n - 1];

  if (!sma20 || !sma50 || !rsiVal || !atrVal) return null;

  // Trend filters
  const aboveSMA20 = last.close > sma20;
  const aboveSMA50 = last.close > sma50;
  const sma20Above50 = sma20 > sma50;

  // Momentum: RSI between 55–72 (trending, not overbought)
  const rsiConstructive = rsiVal >= 55 && rsiVal <= 72;

  // 20-day return positive
  const return20d = ((last.close - candles[n - 21].close) / candles[n - 21].close) * 100;
  const positiveReturn = return20d > 2;

  // Recent high vs previous resistance (not immediately under a major resistance wall)
  // Use 2% threshold — 0.5% was too tight and blocked valid entries near highs
  const highN = ind.highN[n - 1];
  const nearResistance = highN ? Math.abs(last.close - highN) / highN < 0.02 : false;

  // ── Scoring ──
  let score = 0;
  const reasons = [], failReasons = [];

  if (marketRegime.score >= 70) { score += 20; reasons.push('Strong market regime — momentum setups work best here'); }
  else if (marketRegime.score >= 55) { score += 10; reasons.push('Market regime is moderately supportive'); }
  else { failReasons.push('Market regime is weak — momentum setups have lower success rate'); }

  if (aboveSMA50) { score += 15; reasons.push('Above 50 SMA — primary trend is up'); }
  else { failReasons.push('Below 50 SMA — no primary trend support'); }

  if (aboveSMA20) { score += 10; reasons.push('Above 20 SMA — short-term momentum aligned'); }
  else { failReasons.push('Below 20 SMA — short-term trend weak'); }

  if (sma20Above50) { score += 15; reasons.push('20 SMA above 50 SMA — trend structure intact'); }
  else { failReasons.push('20 SMA below 50 SMA — trend not intact'); }

  if (rsiConstructive) { score += 20; reasons.push(`RSI at ${rsiVal.toFixed(1)} — momentum is constructive, not overbought`); }
  else if (rsiVal > 72) { score += 5; failReasons.push(`RSI at ${rsiVal.toFixed(1)} — overbought territory, higher risk of reversal`); }
  else { failReasons.push(`RSI at ${rsiVal.toFixed(1)} — below 55, momentum is weak`); }

  if (positiveReturn) { score += 10; reasons.push(`${return20d.toFixed(1)}% gain in last 20 days confirms momentum`); }
  else { failReasons.push('20-day return is flat or negative — momentum not confirmed'); }

  if (nearResistance) { score -= 15; failReasons.push('Price is trading near 20-day high — overhead resistance may cap upside'); }

  score = Math.max(0, Math.min(100, score));
  const valid = aboveSMA20 && aboveSMA50 && sma20Above50 && rsiConstructive && !nearResistance && score >= 60;

  // ── Trade levels ──
  const entry = +(last.close * 1.001).toFixed(2);
  const stop  = +(entry - CONFIG.atrStopMultiplier * atrVal).toFixed(2);

  const riskPerShare = entry - stop;
  const target1 = +(entry + riskPerShare * 2).toFixed(2);
  const target2 = +(entry + riskPerShare * 3).toFixed(2);
  const rr = riskPerShare > 0 ? +((target1 - entry) / riskPerShare).toFixed(2) : 0;

  const whyEnter = `Stock is in a confirmed uptrend (above 20 & 50 SMA), RSI at ${rsiVal.toFixed(1)} confirms ongoing momentum without being overbought, and the 20-day return of ${return20d.toFixed(1)}% shows the trend has strength.`;
  const whyStop = `Stop at ₹${stop.toFixed(2)} (1.5× ATR below entry). ATR-based stops account for normal daily price noise so you are not stopped out by routine volatility, only by a meaningful trend break.`;
  const whyTarget = `Target 1 at ₹${target1.toFixed(2)} (2R). Momentum trades can run further, so trailing stop above Entry+1R can capture extended moves beyond Target 1.`;
  const whyAvoid = `If rejected: Momentum has not been validated (RSI below 55 or price below 20 SMA), or price is sitting right below major resistance. Risk:reward becomes unfavorable without enough room to the next resistance.`;

  return {
    type: 'Momentum',
    symbol,
    valid,
    entry,
    stop,
    target1,
    target2,
    rr,
    confidence: score,
    reasons,
    failReasons,
    whyEnter,
    whyStop,
    whyTarget,
    whyAvoid,
    metrics: { sma20, sma50, rsiVal: +rsiVal.toFixed(1), return20d: +return20d.toFixed(2), atrVal: +atrVal.toFixed(2) },
  };
}

/**
 * Score-to-decision mapping.
 * score === 0 means no setup was found at all — show "NO SETUP" not "AVOID".
 * "AVOID" means a setup was detected but scored poorly (e.g. weak market, R:R below 2).
 */
function getDecision(score) {
  if (score >= CONFIG.scoreEnter) return { label: 'ENTER',    cls: 'enter' };
  if (score >= CONFIG.scoreWatch) return { label: 'WATCH',    cls: 'watch' };
  if (score === 0)                return { label: 'NO SETUP', cls: 'watch' }; // neutral, not alarming
  return { label: 'AVOID', cls: 'avoid' };
}

/**
 * Run analysis on all watchlisted stocks
 */
function analyseWatchlist(marketRegime) {
  return getWatchlist().map(stock => {
    const setup = analyseStock(stock.symbol, marketRegime);
    return { stock, setup };
  }).filter(r => r !== null);
}
