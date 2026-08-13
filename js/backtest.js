/**
 * backtest.js — Walk-forward backtest engine.
 * Tests rules historically to understand behaviour, NOT to guarantee future profits.
 * Includes full cost modelling: brokerage, STT, slippage.
 */

/**
 * Run a full backtest on a symbol with given strategy parameters.
 * @param {string} symbol
 * @param {Object} params — override CONFIG defaults
 * @returns {Object} Backtest result
 */
function runBacktest(symbol, params = {}) {
  const cfg = { ...CONFIG, ...params };
  // Use 500 days so warmup (50 SMA + 20 breakout lookback) + enough trades
  const days = cfg.dataLookbackDays || 500;
  const candles = getCandles(symbol, days);
  if (candles.length < 100) return null;

  const closes  = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const vols    = candles.map(c => c.volume);

  const sma20arr  = sma(closes, cfg.fastMA);
  const sma50arr  = sma(closes, cfg.slowMA);
  const rsi14arr  = rsi(closes, cfg.rsiLength);
  const atr14arr  = atr(highs, lows, closes, cfg.atrLength);
  const avgVolArr = avgVolume(vols, cfg.volumeAvgPeriod);

  const trades = [];
  let capital = cfg.capital;
  const equity = [{ date: candles[0].date, value: capital }];

  let inTrade = false;
  let tradeEntry = null;

  for (let i = cfg.breakoutLookback + cfg.slowMA; i < candles.length; i++) {
    const c    = candles[i];
    const s20  = sma20arr[i];
    const s50  = sma50arr[i];
    const rsiV = rsi14arr[i];
    const atrV = atr14arr[i];
    const avgV = avgVolArr[i];

    if (!s20 || !s50 || !rsiV || !atrV || !avgV) continue;

    if (!inTrade) {
      // ── Look for entry signal ──
      const prevHighs = closes.slice(i - cfg.breakoutLookback, i);
      const resistance = Math.max(...candles.slice(i - cfg.breakoutLookback, i).map(x => x.high));
      const breakoutSignal = c.close > resistance && c.close > s20 && c.close > s50 && c.volume >= avgV * cfg.volumeBreakoutThreshold && rsiV > 50 && rsiV < cfg.rsiOverbought;

      if (breakoutSignal) {
        const entry = +(c.close * (1 + cfg.slippagePct)).toFixed(2);
        const stop  = +(entry - cfg.atrStopMultiplier * atrV).toFixed(2);
        const target1 = +(entry + cfg.atrTarget1 * atrV).toFixed(2);
        const target2 = +(entry + cfg.atrTarget2 * atrV).toFixed(2);
        const riskPerShare = entry - stop;

        if (riskPerShare <= 0) continue;

        const capitalAtRisk = capital * cfg.riskPercent / 100;
        const qty = Math.floor(capitalAtRisk / riskPerShare);
        if (qty <= 0) continue;
        const rr = (target1 - entry) / riskPerShare;
        if (rr < cfg.minRR) continue;

        const positionValue = qty * entry;
        const brokerage = cfg.brokeragePerTrade;

        inTrade = true;
        tradeEntry = {
          symbol,
          entryDate: c.date,
          entry,
          stop,
          target1,
          target2,
          qty,
          capitalAtRisk,
          positionValue,
          brokerage,
          setupType: 'Breakout',
          rr: +rr.toFixed(2),
        };
        capital -= (positionValue + brokerage);
      }
    } else {
      // ── Manage open trade ──
      const { stop, target1, qty, entry, brokerage } = tradeEntry;
      let exitPrice = null, exitReason = '';

      if (c.low <= stop) {
        exitPrice = +(stop * (1 - cfg.slippagePct)).toFixed(2);
        exitReason = 'Stop Hit';
      } else if (c.high >= target1) {
        exitPrice = +(target1 * (1 - cfg.slippagePct)).toFixed(2);
        exitReason = 'Target 1 Hit';
      } else if (i === candles.length - 1) {
        exitPrice = c.close;
        exitReason = 'End of Data';
      }

      if (exitPrice !== null) {
        const proceeds = qty * exitPrice;
        const sttCost = proceeds * cfg.stt;
        const netProceeds = proceeds - brokerage - sttCost;
        const pnl = +(netProceeds - tradeEntry.positionValue).toFixed(2);

        capital += (tradeEntry.positionValue + pnl + brokerage);
        trades.push({
          ...tradeEntry,
          exitDate: c.date,
          exitPrice,
          exitReason,
          pnl,
          outcome: pnl > 0 ? 'Win' : pnl < -5 ? 'Loss' : 'Breakeven',
        });
        equity.push({ date: c.date, value: +capital.toFixed(2) });
        inTrade = false;
        tradeEntry = null;
      }
    }
  }

  return computeBacktestMetrics(trades, equity, cfg.capital, symbol);
}

/**
 * Compute all backtest performance metrics.
 */
function computeBacktestMetrics(trades, equity, initialCapital, symbol) {
  if (trades.length === 0) return {
    symbol, trades: [], equity,
    metrics: {
      totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnL: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0,
      cagr: 0, sharpe: 0, initialCapital, finalCapital: initialCapital,
    },
    setupBreakdown: {},
  };

  const wins   = trades.filter(t => t.outcome === 'Win');
  const losses = trades.filter(t => t.outcome === 'Loss');

  const totalPnL     = trades.reduce((a, t) => a + t.pnl, 0);
  const winRate      = (wins.length / trades.length) * 100;
  const avgWin       = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss      = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0;
  const profitFactor = (avgLoss * losses.length) > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const finalCapital = equity.length ? equity[equity.length - 1].value : initialCapital;
  const cagr = computeCAGR(initialCapital, finalCapital, 1);  // assume 1 year of data

  // Maximum Drawdown
  let peak = initialCapital;
  let maxDD = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.value);
    const dd = (peak - e.value) / peak;
    maxDD = Math.max(maxDD, dd);
  }

  // Sharpe Ratio (simplified)
  const dailyReturns = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i].value - equity[i - 1].value) / equity[i - 1].value);
  }
  const avgDailyRet = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdDailyRet = Math.sqrt(dailyReturns.reduce((a, r) => a + (r - avgDailyRet) ** 2, 0) / (dailyReturns.length || 1));
  const sharpe = stdDailyRet > 0 ? (avgDailyRet / stdDailyRet) * Math.sqrt(252) : 0;

  // Setup breakdown
  const bySetup = {};
  for (const t of trades) {
    if (!bySetup[t.setupType]) bySetup[t.setupType] = { total: 0, wins: 0, pnl: 0 };
    bySetup[t.setupType].total++;
    if (t.outcome === 'Win') bySetup[t.setupType].wins++;
    bySetup[t.setupType].pnl += t.pnl;
  }

  return {
    symbol,
    trades,
    equity,
    metrics: {
      totalTrades:   trades.length,
      wins:          wins.length,
      losses:        losses.length,
      winRate:       +winRate.toFixed(1),
      totalPnL:      +totalPnL.toFixed(2),
      avgWin:        +avgWin.toFixed(2),
      avgLoss:       +avgLoss.toFixed(2),
      profitFactor:  +profitFactor.toFixed(2),
      maxDrawdown:   +(maxDD * 100).toFixed(2),
      cagr:          +cagr.toFixed(2),
      sharpe:        +sharpe.toFixed(2),
      initialCapital,
      finalCapital:  +finalCapital.toFixed(2),
    },
    setupBreakdown: bySetup,
  };
}

function computeCAGR(start, end, years) {
  if (start <= 0 || years <= 0) return 0;
  return ((Math.pow(end / start, 1 / years) - 1) * 100);
}

/**
 * Run backtests on all watchlisted stocks.
 */
function runWatchlistBacktest() {
  return getWatchlist().map(s => runBacktest(s.symbol)).filter(Boolean);
}
