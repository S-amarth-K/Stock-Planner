/**
 * data.js — Synthetic OHLCV price generator for Nifty 50 stocks.
 * Produces realistic-looking daily candles for backtesting and display.
 * In production, replace generateCandles() with real broker API data.
 */

// Seed parameters per stock so each one looks unique but consistent
const STOCK_SEEDS = {
  RELIANCE:   { base: 2800, drift: 0.0003, vol: 0.013, trend: 0.6 },
  TCS:        { base: 3950, drift: 0.0002, vol: 0.010, trend: 0.5 },
  INFY:       { base: 1540, drift: 0.0002, vol: 0.012, trend: 0.5 },
  HCLTECH:    { base: 1480, drift: 0.0002, vol: 0.011, trend: 0.4 },
  HDFCBANK:   { base: 1620, drift: 0.0003, vol: 0.012, trend: 0.6 },
  ICICIBANK:  { base: 1230, drift: 0.0004, vol: 0.014, trend: 0.7 },
  SBIN:       { base: 820,  drift: 0.0003, vol: 0.016, trend: 0.5 },
  HINDUNILVR: { base: 2480, drift: 0.0001, vol: 0.008, trend: 0.3 },
  ITC:        { base: 470,  drift: 0.0002, vol: 0.010, trend: 0.4 },
  MARUTI:     { base: 12400,drift: 0.0002, vol: 0.013, trend: 0.5 },
  TATAMOTORS: { base: 980,  drift: 0.0005, vol: 0.020, trend: 0.6 },
  SUNPHARMA:  { base: 1720, drift: 0.0003, vol: 0.012, trend: 0.6 },
  TATASTEEL:  { base: 165,  drift: 0.0002, vol: 0.022, trend: 0.4 },
  LT:         { base: 3600, drift: 0.0003, vol: 0.013, trend: 0.6 },
  BHARTIARTL: { base: 1850, drift: 0.0003, vol: 0.012, trend: 0.5 },
  // Nifty index (used for Market View)
  NIFTY50:    { base: 22500,drift: 0.0002, vol: 0.009, trend: 0.5 },
};

// Mulberry32 simple PRNG (seeded, deterministic)
function seededRandom(seed) {
  let s = seed;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate N daily OHLCV candles using geometric Brownian motion.
 * @param {string} symbol
 * @param {number} days
 * @returns {Array<{date, open, high, low, close, volume}>}
 */
function generateCandles(symbol, days = 365) {
  const seed = STOCK_SEEDS[symbol] || { base: 1000, drift: 0.0002, vol: 0.012, trend: 0.5 };
  const rng = seededRandom(symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 1000);

  const candles = [];
  let price = seed.base;

  // Start date: N trading days before today
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - Math.ceil(days * 1.4)); // extra buffer for weekends

  let d = new Date(startDate);
  let count = 0;

  while (count < days) {
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
      continue;
    }

    // Geometric Brownian Motion step
    const z = (rng() + rng() + rng() - 1.5) * 2; // approx normal distribution
    const dailyReturn = seed.drift + seed.vol * z;

    // Occasional regime shifts (trend + mean reversion)
    const trendBias = (rng() > seed.trend ? -0.2 : 0.2) * seed.vol;

    const closeRaw = price * (1 + dailyReturn + trendBias);
    const close = Math.max(1, +closeRaw.toFixed(2));

    const rangePct = seed.vol * (0.8 + rng() * 0.8);
    const high = +(close * (1 + rangePct * (0.4 + rng() * 0.4))).toFixed(2);
    const low  = +(close * (1 - rangePct * (0.4 + rng() * 0.4))).toFixed(2);
    const open = +(low + (high - low) * rng()).toFixed(2);

    // Volume — spikes on big moves
    const baseVol = seed.base * 200;
    const volMult = 0.5 + rng() * 1.2 + (Math.abs(dailyReturn) > 0.02 ? 1.5 * rng() : 0);
    const volume  = Math.round(baseVol * volMult);

    candles.push({
      date: d.toISOString().slice(0, 10),
      open, high, low, close, volume,
    });

    price = close;
    d.setDate(d.getDate() + 1);
    count++;
  }

  return candles;
}

// Cache so we don't regenerate on every call
const _candleCache = {};
function getCandles(symbol, days = 365) {
  const key = `${symbol}_${days}`;
  if (!_candleCache[key]) {
    _candleCache[key] = generateCandles(symbol, days);
  }
  return _candleCache[key];
}

/**
 * Get the most recent N candles for a symbol
 */
function getRecent(symbol, n = 60) {
  const all = getCandles(symbol);
  return all.slice(-n);
}

/**
 * Get latest price info
 */
function getLatestQuote(symbol) {
  const candles = getCandles(symbol);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  return {
    symbol,
    price: last.close,
    open: last.open,
    high: last.high,
    low: last.low,
    volume: last.volume,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    date: last.date,
  };
}
