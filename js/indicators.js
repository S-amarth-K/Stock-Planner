/**
 * indicators.js — Technical analysis toolkit.
 * All functions take plain arrays of numbers and return arrays or scalars.
 */

// ── Simple Moving Average ───────────────────────────────────────────────────
function sma(data, period) {
  const result = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result[i] = slice.reduce((a, b) => a + b, 0) / period;
  }
  return result;
}

// ── Exponential Moving Average ──────────────────────────────────────────────
function ema(data, period) {
  const result = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let emaPrev = null;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null || data[i] === undefined) continue;
    if (emaPrev === null) {
      if (i >= period - 1) {
        const slice = data.slice(0, period);
        emaPrev = slice.reduce((a, b) => a + b, 0) / period;
        result[i] = emaPrev;
      }
    } else {
      emaPrev = data[i] * k + emaPrev * (1 - k);
      result[i] = emaPrev;
    }
  }
  return result;
}

// ── Relative Strength Index ─────────────────────────────────────────────────
function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = 100 - 100 / (1 + (avgLoss === 0 ? 1e10 : avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = 100 - 100 / (1 + (avgLoss === 0 ? 1e10 : avgGain / avgLoss));
  }
  return result;
}

// ── Average True Range ──────────────────────────────────────────────────────
function atr(highs, lows, closes, period = 14) {
  const trueRanges = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }

  const result = new Array(highs.length).fill(null);
  if (trueRanges.length < period) return result;

  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period] = atrVal;

  for (let i = period + 1; i < highs.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i - 1]) / period;
    result[i] = atrVal;
  }
  return result;
}

// ── Highest High over N periods ─────────────────────────────────────────────
function highestHigh(highs, period) {
  const result = new Array(highs.length).fill(null);
  for (let i = period - 1; i < highs.length; i++) {
    result[i] = Math.max(...highs.slice(i - period + 1, i + 1));
  }
  return result;
}

// ── Lowest Low over N periods ───────────────────────────────────────────────
function lowestLow(lows, period) {
  const result = new Array(lows.length).fill(null);
  for (let i = period - 1; i < lows.length; i++) {
    result[i] = Math.min(...lows.slice(i - period + 1, i + 1));
  }
  return result;
}

// ── Average Volume ──────────────────────────────────────────────────────────
function avgVolume(volumes, period) {
  return sma(volumes, period);
}

// ── Bollinger Bands ─────────────────────────────────────────────────────────
function bollingerBands(closes, period = 20, stdMult = 2) {
  const mid = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = mean + stdMult * std;
    lower[i] = mean - stdMult * std;
  }
  return { mid, upper, lower };
}

// ── Swing High / Swing Low Detection ────────────────────────────────────────
function swingHighs(highs, lookback = 5) {
  const result = new Array(highs.length).fill(null);
  for (let i = lookback; i < highs.length - lookback; i++) {
    const left = highs.slice(i - lookback, i);
    const right = highs.slice(i + 1, i + lookback + 1);
    if (left.every(v => v <= highs[i]) && right.every(v => v <= highs[i])) {
      result[i] = highs[i];
    }
  }
  return result;
}

function swingLows(lows, lookback = 5) {
  const result = new Array(lows.length).fill(null);
  for (let i = lookback; i < lows.length - lookback; i++) {
    const left = lows.slice(i - lookback, i);
    const right = lows.slice(i + 1, i + lookback + 1);
    if (left.every(v => v >= lows[i]) && right.every(v => v >= lows[i])) {
      result[i] = lows[i];
    }
  }
  return result;
}

// ── MACD ────────────────────────────────────────────────────────────────────
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    (fastEMA[i] !== null && slowEMA[i] !== null) ? fastEMA[i] - slowEMA[i] : null
  );
  const validMacd = macdLine.filter(v => v !== null);
  const signalLineRaw = ema(validMacd, signal);
  // Re-align signal line to original length
  const signalLine = new Array(closes.length).fill(null);
  let vi = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalLineRaw[vi++] ?? null;
    }
  }
  const histogram = closes.map((_, i) =>
    (macdLine[i] !== null && signalLine[i] !== null) ? macdLine[i] - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

// ── Rate of Change ──────────────────────────────────────────────────────────
function roc(closes, period = 10) {
  const result = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    result[i] = ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
  }
  return result;
}

// ── Compute all indicators for a candle dataset ──────────────────────────────
function computeAll(candles) {
  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const vols   = candles.map(c => c.volume);

  return {
    sma20:     sma(closes, CONFIG.fastMA),
    sma50:     sma(closes, CONFIG.slowMA),
    ema9:      ema(closes, CONFIG.emaFast),
    ema21:     ema(closes, CONFIG.emaSlow),
    rsi14:     rsi(closes, CONFIG.rsiLength),
    atr14:     atr(highs, lows, closes, CONFIG.atrLength),
    highN:     highestHigh(highs, CONFIG.breakoutLookback),
    lowN:      lowestLow(lows, CONFIG.breakoutLookback),
    avgVol20:  avgVolume(vols, CONFIG.volumeAvgPeriod),
    swingH:    swingHighs(highs, 3),
    swingL:    swingLows(lows, 3),
    bb:        bollingerBands(closes),
    macd:      macd(closes),
  };
}
