/**
 * risk.js — Position sizing and portfolio risk management.
 * The amount you buy should come from your risk tolerance and stop distance,
 * NOT from how confident you feel about the trade.
 */

/**
 * Calculate position size and full risk breakdown for one trade.
 *
 * @param {Object} params
 * @param {number} params.capital       — Total trading capital in ₹
 * @param {number} params.riskPercent   — Risk per trade as % (e.g. 1 = 1%)
 * @param {number} params.entry         — Planned entry price ₹
 * @param {number} params.stop          — Planned stop-loss price ₹
 * @param {number} params.target1       — Target 1 price ₹
 * @param {number} params.target2       — Target 2 price ₹ (optional)
 * @returns {Object} Full position sizing result
 */
function calculatePosition(params) {
  const {
    capital      = CONFIG.capital,
    riskPercent  = CONFIG.riskPercent,
    entry,
    stop,
    target1,
    target2,
  } = params;

  if (entry <= stop)  return { error: 'Entry price must be above stop-loss price.' };
  if (entry <= 0)     return { error: 'Entry price must be positive.' };
  if (stop  <= 0)     return { error: 'Stop-loss price must be positive.' };

  const capitalAtRisk   = +(capital * riskPercent / 100).toFixed(2);
  const riskPerShare    = +(entry - stop).toFixed(2);
  const rawQty          = capitalAtRisk / riskPerShare;
  const quantity        = Math.floor(rawQty);                         // always round down
  const actualRiskRs    = +(quantity * riskPerShare).toFixed(2);
  const actualRiskPct   = +((actualRiskRs / capital) * 100).toFixed(3);
  const positionValue   = +(quantity * entry).toFixed(2);
  const positionPct     = +((positionValue / capital) * 100).toFixed(1);

  // Brokerage + costs (India, equity delivery)
  const brokerageIn     = CONFIG.brokeragePerTrade;
  const brokerageOut    = CONFIG.brokeragePerTrade;
  const slippageIn      = +(entry * CONFIG.slippagePct * quantity).toFixed(2);
  const slippageOut     = +(target1 * CONFIG.slippagePct * quantity).toFixed(2);
  const sttCost         = +(target1 * CONFIG.stt * quantity).toFixed(2);  // sell-side
  const totalCosts      = +(brokerageIn + brokerageOut + slippageIn + slippageOut + sttCost).toFixed(2);

  // Reward:Risk (gross and net of costs)
  const grossReward1    = +(quantity * (target1 - entry)).toFixed(2);
  const grossReward2    = target2 ? +(quantity * (target2 - entry)).toFixed(2) : null;
  const netReward1      = +(grossReward1 - totalCosts).toFixed(2);
  const rr              = +((target1 - entry) / riskPerShare).toFixed(2);
  const rrNet           = +((netReward1) / (actualRiskRs + totalCosts / 2)).toFixed(2);

  // P&L scenarios
  const lossAtStop      = -(actualRiskRs + totalCosts / 2);
  const profitAtT1      = netReward1;
  const profitAtT2      = target2 ? +(grossReward2 - totalCosts).toFixed(2) : null;

  // Portfolio checks
  const checks = [];
  if (positionPct > CONFIG.maxSingleStockPct * 100) {
    checks.push({
      type: 'warning',
      msg: `Position is ${positionPct}% of capital — exceeds ${CONFIG.maxSingleStockPct * 100}% single-stock limit. Reduce size.`,
    });
  }
  if (actualRiskPct > CONFIG.riskPercent * 1.1) {
    checks.push({
      type: 'warning',
      msg: `Actual risk (${actualRiskPct}%) slightly exceeds target (${CONFIG.riskPercent}%) due to rounding.`,
    });
  }
  if (rr < CONFIG.minRR) {
    checks.push({
      type: 'danger',
      msg: `R:R of ${rr} is below minimum of ${CONFIG.minRR}. This trade does not meet the quality threshold.`,
    });
  }
  if (quantity === 0) {
    checks.push({
      type: 'danger',
      msg: `Position size is 0 shares. Your stop is too far from entry for your capital/risk settings. Widen capital or tighten stop.`,
    });
  }

  return {
    capital,
    riskPercent,
    capitalAtRisk,
    riskPerShare,
    quantity,
    actualRiskRs,
    actualRiskPct,
    positionValue,
    positionPct,
    costs: { brokerageIn, brokerageOut, slippageIn, slippageOut, sttCost, totalCosts },
    rewards: { grossReward1, grossReward2, netReward1 },
    rr,
    rrNet,
    scenarios: { lossAtStop: +lossAtStop.toFixed(2), profitAtT1, profitAtT2 },
    checks,
    valid: quantity > 0 && rr >= CONFIG.minRR,
  };
}

/**
 * Portfolio-level risk check.
 * @param {Array} openTrades — array of {symbol, sector, positionValue, riskRs}
 * @returns {Object} Portfolio risk summary
 */
function portfolioRiskCheck(openTrades) {
  const totalCapital    = CONFIG.capital;
  const totalExposed    = openTrades.reduce((a, t) => a + (t.positionValue || 0), 0);
  const totalRisk       = openTrades.reduce((a, t) => a + (t.riskRs || 0), 0);
  const exposurePct     = +((totalExposed / totalCapital) * 100).toFixed(1);
  const riskPct         = +((totalRisk / totalCapital) * 100).toFixed(2);

  // Sector breakdown
  const sectorMap = {};
  for (const t of openTrades) {
    const sec = t.sector || 'Unknown';
    sectorMap[sec] = (sectorMap[sec] || 0) + (t.positionValue || 0);
  }
  const sectorExposure = Object.entries(sectorMap).map(([sector, val]) => ({
    sector,
    value: +val.toFixed(2),
    pct: +((val / totalCapital) * 100).toFixed(1),
    breached: val / totalCapital > CONFIG.maxSectorExposure,
  }));

  const warnings = [];
  if (openTrades.length >= CONFIG.maxPositions) {
    warnings.push(`Max positions (${CONFIG.maxPositions}) reached. Do not open new trades.`);
  }
  if (riskPct > CONFIG.riskPercent * CONFIG.maxPositions) {
    warnings.push(`Total portfolio risk of ${riskPct}% is very high. Consider reducing exposure.`);
  }
  sectorExposure.filter(s => s.breached).forEach(s => {
    warnings.push(`${s.sector} sector exposure is ${s.pct}% — exceeds ${CONFIG.maxSectorExposure * 100}% limit.`);
  });

  return {
    openPositions: openTrades.length,
    maxPositions: CONFIG.maxPositions,
    totalExposed,
    exposurePct,
    totalRisk,
    riskPct,
    sectorExposure,
    warnings,
    canOpenNew: openTrades.length < CONFIG.maxPositions,
  };
}

/**
 * Daily loss circuit breaker check.
 * @param {number} dailyPnL — Realized P&L today in ₹ (negative = loss)
 * @returns {Object}
 */
function circuitBreakerCheck(dailyPnL) {
  const capital = CONFIG.capital;
  const maxDailyLoss = capital * 0.02;  // 2% daily stop
  const triggered = dailyPnL < -maxDailyLoss;
  return {
    dailyPnL,
    maxDailyLoss: -maxDailyLoss,
    triggered,
    message: triggered
      ? `CIRCUIT BREAKER: Daily loss of ₹${Math.abs(dailyPnL).toFixed(0)} exceeds 2% limit (₹${maxDailyLoss.toFixed(0)}). Stop trading for today.`
      : `Daily P&L within acceptable range. ₹${dailyPnL.toFixed(0)} vs limit of -₹${maxDailyLoss.toFixed(0)}.`,
  };
}
