/**
 * market.js — Broad market regime analysis.
 * Determines if the overall Nifty 50 environment is supportive, neutral, or weak
 * before evaluating any individual stock setup.
 *
 * Key principle: Some risks are market-wide and cannot be diversified away.
 * Even a perfect-looking stock setup should be downgraded when the market is weak.
 */

/**
 * Analyse market environment.
 * @returns {Object} Market regime object
 */
function analyseMarket() {
  const candles = getCandles('NIFTY50', 365);
  const closes  = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const vols    = candles.map(c => c.volume);

  const n = candles.length;
  const last = candles[n - 1];

  const sma20Val = sma(closes, 20)[n - 1];
  const sma50Val = sma(closes, 50)[n - 1];
  const rsi14Val = rsi(closes, 14)[n - 1];
  const atr14Val = atr(highs, lows, closes, 14)[n - 1];
  const avgVol20 = avgVolume(vols, 20)[n - 1];

  const aboveSMA20 = last.close > sma20Val;
  const aboveSMA50 = last.close > sma50Val;
  const sma20Above50 = sma20Val > sma50Val;

  // Volatility state: ATR as % of price
  const atrPct = (atr14Val / last.close) * 100;
  let volatilityState = 'Normal';
  if (atrPct > 1.5)       volatilityState = 'High';
  else if (atrPct < 0.6)  volatilityState = 'Low';

  // Short-term momentum: 10-day return
  const tenDayReturn = ((last.close - candles[n - 11].close) / candles[n - 11].close) * 100;
  const momentum = tenDayReturn > 1 ? 'Positive' : tenDayReturn < -1 ? 'Negative' : 'Neutral';

  // Volume trend vs average
  const recentVolAvg = vols.slice(-5).reduce((a, b) => a + b) / 5;
  const volumeTrend = recentVolAvg > avgVol20 ? 'Elevated' : 'Below Average';

  // ── Regime scoring ──────────────────────────────────────────────────────────
  let score = 0;
  const factors = [];

  if (aboveSMA20) { score += 25; factors.push({ label: 'Above 20 SMA', positive: true }); }
  else            { factors.push({ label: 'Below 20 SMA', positive: false }); }

  if (aboveSMA50) { score += 30; factors.push({ label: 'Above 50 SMA', positive: true }); }
  else            { factors.push({ label: 'Below 50 SMA', positive: false }); }

  if (sma20Above50) { score += 20; factors.push({ label: '20 SMA > 50 SMA (Golden zone)', positive: true }); }
  else              { factors.push({ label: '20 SMA below 50 SMA', positive: false }); }

  if (rsi14Val > 50 && rsi14Val < 75) { score += 15; factors.push({ label: `RSI ${rsi14Val.toFixed(1)} — momentum zone`, positive: true }); }
  else if (rsi14Val >= 75)            { score += 5;  factors.push({ label: `RSI ${rsi14Val.toFixed(1)} — overbought caution`, positive: false }); }
  else                                { factors.push({ label: `RSI ${rsi14Val.toFixed(1)} — weak momentum`, positive: false }); }

  if (volatilityState === 'Normal') { score += 10; factors.push({ label: 'Volatility normal', positive: true }); }
  else if (volatilityState === 'High') { factors.push({ label: 'High volatility — wider stops needed', positive: false }); }

  // ── Regime classification ───────────────────────────────────────────────────
  let regime, regimeClass, note, suitableSetups;

  if (score >= 80) {
    regime = 'Strong Uptrend';
    regimeClass = 'bullish';
    note = 'Market is in a clear uptrend with broad participation. Breakout and momentum setups have a higher success rate in this environment.';
    suitableSetups = ['Breakout', 'Momentum Continuation', 'Pullback to MA'];
  } else if (score >= 55) {
    regime = 'Moderate Uptrend';
    regimeClass = 'bullish';
    note = 'Market is broadly supportive. Pullback-to-support setups are preferable over chasing breakouts. Quality stocks above key MAs only.';
    suitableSetups = ['Pullback to Support', 'Pullback to MA'];
  } else if (score >= 35) {
    regime = 'Choppy / Sideways';
    regimeClass = 'neutral';
    note = 'Market lacks clear direction. False breakouts are common. Reduce position size, tighten stop requirements, prefer cash.';
    suitableSetups = ['Tight Pullback only'];
  } else {
    regime = 'Downtrend / Weak';
    regimeClass = 'bearish';
    note = 'Market is weak. Individual stock setups have a lower probability of working. Capital preservation is the priority. Avoid new longs.';
    suitableSetups = [];
  }

  // ── Sector relative strength (simplified mock) ──────────────────────────────
  const sectorStrength = computeSectorStrength();

  return {
    regime,
    regimeClass,
    score,
    note,
    suitableSetups,
    factors,
    metrics: {
      niftyClose:   last.close,
      sma20:        sma20Val,
      sma50:        sma50Val,
      rsi:          rsi14Val,
      atrPct,
      volatilityState,
      momentum,
      volumeTrend,
      tenDayReturn,
    },
    sectorStrength,
    date: last.date,
  };
}

/**
 * Compute relative sector strength by comparing each sector's best stock
 * 20-day return vs Nifty 20-day return.
 */
function computeSectorStrength() {
  const niftyCandles = getCandles('NIFTY50');
  const niftyReturn = pctReturn(niftyCandles, 20);

  const sectors = getSectors();
  return sectors.map(sector => {
    const stocks = getStocksBySector(sector);
    const returns = stocks.map(s => {
      try { return pctReturn(getCandles(s.symbol), 20); } catch { return 0; }
    });
    const avgReturn = returns.length ? returns.reduce((a, b) => a + b) / returns.length : 0;
    const relStrength = avgReturn - niftyReturn;
    return {
      sector,
      return20d: +avgReturn.toFixed(2),
      relStrength: +relStrength.toFixed(2),
      status: relStrength > 1 ? 'Leading' : relStrength < -1 ? 'Lagging' : 'In-line',
    };
  }).sort((a, b) => b.return20d - a.return20d);
}

function pctReturn(candles, period) {
  const n = candles.length;
  if (n <= period) return 0;
  return ((candles[n - 1].close - candles[n - 1 - period].close) / candles[n - 1 - period].close) * 100;
}
