/**
 * app.js — Main UI controller. Renders all 6 tabs and manages state.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let activeTab   = 'market';
let marketData  = null;
let allPlans    = null;
let selectedSymbol = getWatchlist()[0]?.symbol || 'RELIANCE';
let backtestResult = null;
let killSwitch  = false;
let dailyPnL    = 0;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  seedDemoTrades();
  marketData = analyseMarket();
  allPlans   = generateAllPlans(marketData);

  setupNavigation();
  renderTab('market');
});

// ── Navigation ────────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = tab;
      renderTab(tab);
    });
  });
}

function renderTab(tab) {
  const content = document.getElementById('tab-content');
  switch (tab) {
    case 'market':    content.innerHTML = buildMarketView();   afterMarketView();   break;
    case 'watchlist': content.innerHTML = buildWatchlist();    afterWatchlist();    break;
    case 'planner':   content.innerHTML = buildPlanner();      afterPlanner();      break;
    case 'risk':      content.innerHTML = buildRiskCalc();     afterRiskCalc();     break;
    case 'journal':   content.innerHTML = buildJournal();      afterJournal();      break;
    case 'backtest':  content.innerHTML = buildBacktest();     afterBacktest();     break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — MARKET VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function buildMarketView() {
  const m = marketData;
  const q = getLatestQuote('NIFTY50');
  const chgCls = q.change >= 0 ? 'positive' : 'negative';
  const chgSign = q.change >= 0 ? '+' : '';

  return `
  <div class="tab-header">
    <h2>Market View</h2>
    <p class="tab-desc">Check the broad market environment <strong>before</strong> evaluating any stock. Some risks cannot be diversified away.</p>
  </div>

  <div class="regime-banner ${m.regimeClass}">
    <div class="regime-icon">${m.regimeClass === 'bullish' ? '🟢' : m.regimeClass === 'neutral' ? '🟡' : '🔴'}</div>
    <div class="regime-info">
      <span class="regime-label">${m.regime}</span>
      <span class="regime-score">Score: ${m.score}/100</span>
    </div>
    <div class="regime-note">${m.note}</div>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <span class="metric-label">Nifty 50</span>
      <span class="metric-value">${q.price.toLocaleString('en-IN')}</span>
      <span class="metric-sub ${chgCls}">${chgSign}${q.change.toFixed(2)} (${chgSign}${q.changePct.toFixed(2)}%)</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">vs 20 SMA</span>
      <span class="metric-value ${q.price > m.metrics.sma20 ? 'positive' : 'negative'}">${q.price > m.metrics.sma20 ? 'Above ✓' : 'Below ✗'}</span>
      <span class="metric-sub">₹${m.metrics.sma20.toFixed(2)}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">vs 50 SMA</span>
      <span class="metric-value ${q.price > m.metrics.sma50 ? 'positive' : 'negative'}">${q.price > m.metrics.sma50 ? 'Above ✓' : 'Below ✗'}</span>
      <span class="metric-sub">₹${m.metrics.sma50.toFixed(2)}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">RSI (14)</span>
      <span class="metric-value">${m.metrics.rsi.toFixed(1)}</span>
      <span class="metric-sub">${m.metrics.rsi > 70 ? 'Overbought' : m.metrics.rsi < 30 ? 'Oversold' : 'Neutral zone'}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Volatility</span>
      <span class="metric-value">${m.metrics.volatilityState}</span>
      <span class="metric-sub">ATR ${m.metrics.atrPct.toFixed(2)}% of price</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">10-Day Return</span>
      <span class="metric-value ${m.metrics.tenDayReturn >= 0 ? 'positive' : 'negative'}">${m.metrics.tenDayReturn >= 0 ? '+' : ''}${m.metrics.tenDayReturn.toFixed(2)}%</span>
      <span class="metric-sub">${m.metrics.momentum}</span>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <h3>Nifty 50 — Price vs Moving Averages</h3>
      <div class="chart-wrap"><canvas id="nifty-chart"></canvas></div>
    </div>

    <div class="card">
      <h3>Market Regime Factors</h3>
      <div class="factor-list">
        ${m.factors.map(f => `
          <div class="factor-row ${f.positive ? 'positive' : 'negative'}">
            <span class="factor-icon">${f.positive ? '✓' : '✗'}</span>
            <span class="factor-text">${f.label}</span>
          </div>
        `).join('')}
      </div>
      <div class="suitable-setups">
        <p class="label">Suitable setups now:</p>
        ${m.suitableSetups.length
          ? m.suitableSetups.map(s => `<span class="tag green">${s}</span>`).join('')
          : '<span class="tag red">None — Preserve Capital</span>'
        }
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Sector Relative Strength (20-Day)</h3>
    <div class="chart-wrap" style="height:220px"><canvas id="sector-chart"></canvas></div>
    <div class="sector-table">
      <table>
        <thead><tr><th>Sector</th><th>20D Return</th><th>vs Nifty</th><th>Status</th></tr></thead>
        <tbody>
          ${m.sectorStrength.map(s => `
            <tr>
              <td>${s.sector}</td>
              <td class="${s.return20d >= 0 ? 'positive' : 'negative'}">${s.return20d >= 0 ? '+' : ''}${s.return20d}%</td>
              <td class="${s.relStrength >= 0 ? 'positive' : 'negative'}">${s.relStrength >= 0 ? '+' : ''}${s.relStrength}%</td>
              <td><span class="tag ${s.status === 'Leading' ? 'green' : s.status === 'Lagging' ? 'red' : 'blue'}">${s.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card info-card">
    <h3>📚 Why Market View Comes First</h3>
    <p>Individual stock setups often fail when the broad market is weak, because many stocks move with the market. This is called systematic risk — it cannot be removed by picking better stocks. Before looking at any stock, always ask: <em>"Is the market environment likely to support this trade?"</em></p>
    <p>A great setup in a weak market is still a lower-probability trade. A mediocre setup in a strong market has a tailwind.</p>
  </div>`;
}

function afterMarketView() {
  renderNiftySparkline('nifty-chart');
  renderSectorChart('sector-chart', marketData.sectorStrength);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — WATCHLIST
// ═══════════════════════════════════════════════════════════════════════════════
function buildWatchlist() {
  return `
  <div class="tab-header">
    <h2>Watchlist</h2>
    <p class="tab-desc">Track ${getWatchlist().length} Nifty large-caps across multiple sectors. Click any stock to see its chart and setup.</p>
  </div>

  <div class="watchlist-grid">
    ${getWatchlist().map(stock => {
      const q = getLatestQuote(stock.symbol);
      const plan = allPlans.find(p => p.symbol === stock.symbol);
      const setup = plan?.setup;
      const decision = setup ? getDecision(setup.confidence) : { label: 'NO SETUP', cls: 'watch' };
      const chgCls = q.change >= 0 ? 'positive' : 'negative';
      const chgSign = q.change >= 0 ? '+' : '';

      return `
      <div class="watchlist-card ${selectedSymbol === stock.symbol ? 'selected' : ''}" onclick="selectStock('${stock.symbol}')">
        <div class="wl-top">
          <div>
            <span class="wl-symbol">${stock.symbol}</span>
            <span class="wl-name">${stock.name.split(' ').slice(0,3).join(' ')}</span>
          </div>
          <span class="decision-badge ${decision.cls}">${decision.label}</span>
        </div>
        <div class="wl-price">
          <span class="wl-ltp">₹${q.price.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
          <span class="wl-chg ${chgCls}">${chgSign}${q.changePct.toFixed(2)}%</span>
        </div>
        <div class="wl-meta">
          <span class="tag blue">${stock.sector}</span>
          ${setup ? `<span class="tag ${setup.type === 'Breakout' ? 'gold' : setup.type === 'Pullback' ? 'green' : 'purple'}">${setup.type}</span>` : ''}
        </div>
        ${setup ? `<div class="wl-levels"><small>Entry ₹${setup.entry} · Stop ₹${setup.stop} · R:R ${setup.rr}x</small></div>` : ''}
      </div>`;
    }).join('')}
  </div>

  <div id="stock-detail" class="card" style="margin-top:1.5rem">
    ${buildStockDetail(selectedSymbol)}
  </div>`;
}

function buildStockDetail(symbol) {
  const stock = UNIVERSE.find(s => s.symbol === symbol);
  const q = getLatestQuote(symbol);
  const plan = allPlans.find(p => p.symbol === symbol);
  const candles = getRecent(symbol, 60);

  return `
    <div class="stock-detail-header">
      <div>
        <h3>${stock.name} <span class="tag blue">${stock.sector}</span></h3>
        <p class="stock-notes">${stock.notes}</p>
      </div>
      <button class="btn-primary" onclick="openPlanner('${symbol}')">Open in Entry Planner →</button>
    </div>

    <div class="detail-charts">
      <div>
        <div class="chart-label">Price & Moving Averages</div>
        <div class="chart-wrap"><canvas id="detail-price-${symbol}"></canvas></div>
      </div>
      <div>
        <div class="chart-label">RSI (14)</div>
        <div class="chart-wrap" style="height:140px"><canvas id="detail-rsi-${symbol}"></canvas></div>
      </div>
      <div>
        <div class="chart-label">Volume</div>
        <div class="chart-wrap" style="height:140px"><canvas id="detail-vol-${symbol}"></canvas></div>
      </div>
    </div>`;
}

function afterWatchlist() {
  setTimeout(() => {
    renderPriceChart(`detail-price-${selectedSymbol}`, selectedSymbol);
    renderRSIChart(`detail-rsi-${selectedSymbol}`, selectedSymbol);
    renderVolumeChart(`detail-vol-${selectedSymbol}`, selectedSymbol);
  }, 50);
}

function selectStock(symbol) {
  selectedSymbol = symbol;
  document.querySelectorAll('.watchlist-card').forEach(c => c.classList.remove('selected'));
  const el = document.querySelector(`[onclick="selectStock('${symbol}')"]`);
  if (el) el.classList.add('selected');
  const detail = document.getElementById('stock-detail');
  if (detail) {
    detail.innerHTML = buildStockDetail(symbol);
    renderPriceChart(`detail-price-${symbol}`, symbol);
    renderRSIChart(`detail-rsi-${symbol}`, symbol);
    renderVolumeChart(`detail-vol-${symbol}`, symbol);
  }
}

function openPlanner(symbol) {
  selectedSymbol = symbol;
  document.querySelector('[data-tab="planner"]').click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ENTRY PLANNER
// ═══════════════════════════════════════════════════════════════════════════════
function buildPlanner() {
  const watchlist = getWatchlist();
  return `
  <div class="tab-header">
    <h2>Entry Planner</h2>
    <p class="tab-desc">Generate a complete trade plan — entry, stop, targets, position size, and plain-English reasoning — before you act.</p>
  </div>

  <div class="planner-controls card">
    <div class="planner-row">
      <label>Select stock</label>
      <select id="planner-symbol" onchange="refreshPlan()">
        ${watchlist.map(s => `<option value="${s.symbol}" ${s.symbol === selectedSymbol ? 'selected' : ''}>${s.symbol} — ${s.name.split(' ').slice(0,2).join(' ')}</option>`).join('')}
      </select>
    </div>
    <div class="planner-row">
      <label>Capital (₹)</label>
      <input type="number" id="planner-capital" value="${CONFIG.capital}" oninput="refreshPlan()">
    </div>
    <div class="planner-row">
      <label>Risk per trade (%)</label>
      <input type="number" id="planner-risk" value="${CONFIG.riskPercent}" step="0.1" min="0.1" max="3" oninput="refreshPlan()">
    </div>
  </div>

  <div id="plan-output">${renderPlanOutput(selectedSymbol)}</div>`;
}

function renderPlanOutput(symbol) {
  const capitalEl = document.getElementById('planner-capital');
  const riskEl    = document.getElementById('planner-risk');
  const cap  = capitalEl ? +capitalEl.value : CONFIG.capital;
  const risk = riskEl    ? +riskEl.value    : CONFIG.riskPercent;

  const tmpConfig = { ...CONFIG, capital: cap, riskPercent: risk };
  Object.assign(CONFIG, { capital: cap, riskPercent: risk });

  const plan = generatePlan(symbol, marketData);
  if (!plan) return '<div class="card"><p>Unable to generate plan for this symbol.</p></div>';

  const setup = plan.setup;
  const decision = plan.decision;
  const pos = plan.positionPlan;
  const sb  = plan.scoringBreakdown;

  const decisionColors = { enter: '#10b981', watch: '#f59e0b', avoid: '#ef4444' };

  return `
  <div class="plan-decision-banner" style="border-color:${decisionColors[decision.cls] || '#3b82f6'}">
    <div class="plan-decision-label ${decision.cls}">${decision.label}</div>
    <div class="plan-decision-name">${plan.stock.name}</div>
    <div class="plan-decision-setup">${setup ? setup.type + ' Setup' : 'No qualifying setup detected'}</div>
    <div class="plan-decision-score">Confidence: ${setup ? setup.confidence : 0}/100</div>
  </div>

  ${setup ? `
  <div class="plan-levels-grid">
    <div class="plan-level entry">
      <span class="pl-label">Entry</span>
      <span class="pl-value">₹${setup.entry.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
      <span class="pl-desc">Planned entry price</span>
    </div>
    <div class="plan-level stop">
      <span class="pl-label">Stop-Loss</span>
      <span class="pl-value">₹${setup.stop.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
      <span class="pl-desc">Exit if thesis fails</span>
    </div>
    <div class="plan-level target1">
      <span class="pl-label">Target 1</span>
      <span class="pl-value">₹${setup.target1.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
      <span class="pl-desc">Primary profit level</span>
    </div>
    <div class="plan-level target2">
      <span class="pl-label">Target 2</span>
      <span class="pl-value">₹${setup.target2.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
      <span class="pl-desc">Extended target (trail stop)</span>
    </div>
    <div class="plan-level rr">
      <span class="pl-label">R:R Ratio</span>
      <span class="pl-value">${setup.rr}:1</span>
      <span class="pl-desc">${setup.rr >= CONFIG.minRR ? '✓ Meets minimum' : '✗ Below 2:1 minimum'}</span>
    </div>
    ${pos && pos.quantity > 0 ? `
    <div class="plan-level qty">
      <span class="pl-label">Quantity</span>
      <span class="pl-value">${pos.quantity} shares</span>
      <span class="pl-desc">₹${pos.capitalAtRisk.toLocaleString('en-IN')} at risk (${pos.actualRiskPct}%)</span>
    </div>` : ''}
  </div>

  <div class="two-col">
    <div class="card reasoning-card">
      <h3>📖 Trade Reasoning</h3>
      <div class="reasoning-block">
        <div class="rb-label">Why Enter</div>
        <div class="rb-text">${setup.whyEnter}</div>
      </div>
      <div class="reasoning-block">
        <div class="rb-label">Why Stop Here</div>
        <div class="rb-text">${setup.whyStop}</div>
      </div>
      <div class="reasoning-block">
        <div class="rb-label">Why This Target</div>
        <div class="rb-text">${setup.whyTarget}</div>
      </div>
      <div class="reasoning-block warn">
        <div class="rb-label">If Rejected — Why to Avoid</div>
        <div class="rb-text">${setup.whyAvoid}</div>
      </div>

      <h4 style="margin-top:1.2rem">Supporting Factors</h4>
      ${setup.reasons.map(r => `<div class="factor-row positive"><span class="factor-icon">✓</span><span>${r}</span></div>`).join('')}
      ${setup.failReasons.map(r => `<div class="factor-row negative"><span class="factor-icon">✗</span><span>${r}</span></div>`).join('')}
    </div>

    <div class="card">
      <h3>🎯 Scoring Breakdown</h3>
      <div class="score-total-bar">
        <div class="score-track"><div class="score-fill" style="width:${sb.total}%"></div></div>
        <span>${sb.total} / ${sb.maxScore}</span>
      </div>
      <div class="score-items">
        ${sb.items.map(item => `
          <div class="score-item">
            <div class="si-top">
              <span class="si-label">${item.label}</span>
              <span class="si-pts ${item.condition ? 'earned' : 'missed'}">+${item.earned}/${item.max}</span>
            </div>
            <div class="si-bar"><div class="si-fill ${item.condition ? 'earned' : 'missed'}" style="width:${(item.earned/item.max)*100}%"></div></div>
            <div class="si-desc">${item.description}</div>
          </div>
        `).join('')}
      </div>

      ${pos ? `
      <h4 style="margin-top:1.2rem">Position Sizing</h4>
      <table class="pos-table">
        <tr><td>Capital</td><td>₹${pos.capital.toLocaleString('en-IN')}</td></tr>
        <tr><td>Risk per trade</td><td>${pos.riskPercent}% = ₹${pos.capitalAtRisk.toLocaleString('en-IN')}</td></tr>
        <tr><td>Risk per share</td><td>₹${pos.riskPerShare} (Entry − Stop)</td></tr>
        <tr><td>Quantity</td><td>${pos.quantity} shares</td></tr>
        <tr><td>Position value</td><td>₹${pos.positionValue.toLocaleString('en-IN')} (${pos.positionPct}%)</td></tr>
        <tr><td>Gross profit at T1</td><td class="positive">+₹${pos.rewards.grossReward1.toLocaleString('en-IN')}</td></tr>
        <tr><td>All costs</td><td class="negative">−₹${pos.costs.totalCosts.toLocaleString('en-IN')}</td></tr>
        <tr><td>Net profit at T1</td><td class="${pos.rewards.netReward1 >= 0 ? 'positive' : 'negative'}">₹${pos.rewards.netReward1.toLocaleString('en-IN')}</td></tr>
        <tr><td>Net R:R (after costs)</td><td>${pos.rrNet}</td></tr>
      </table>
      ${pos.checks.map(c => `<div class="alert-${c.type}">${c.msg}</div>`).join('')}
      ` : ''}
    </div>
  </div>

  <div class="card">
    <h3>Price Chart — ${symbol}</h3>
    <div class="chart-wrap"><canvas id="plan-chart"></canvas></div>
  </div>

  <div class="card" style="text-align:center">
    <button class="btn-primary large" onclick="openJournalEntry('${symbol}', ${JSON.stringify({
      symbol, setupType: setup.type,
      entry: setup.entry, stop: setup.stop,
      target1: setup.target1, target2: setup.target2,
      rr: setup.rr, quantity: pos?.quantity || 0,
    }).replace(/"/g, "'")})">
      📒 Log this trade in Journal
    </button>
  </div>

  ` : `
  <div class="card no-setup-card">
    <h3>⏳ Watching — no clean setup yet for ${symbol}</h3>
    <p>This stock doesn't currently meet the strict entry criteria for any of the 3 setups (Breakout, Pullback, Momentum). <strong>This is normal</strong> — most stocks on most days are in a "wait" state. The rules are strict on purpose.</p>
    <p><strong>What this means:</strong> Reliance (or whichever stock you picked) may be a perfectly good company — the tool is simply saying <em>"right now, the price action does not show a low-risk entry point."</em></p>
    <div class="reasons">
      ${allPlans.find(p=>p.symbol===symbol)?.setup?.failReasons?.map(r =>
        `<div class="factor-row negative"><span>✗</span> ${r}</div>`
      ).join('') || ''}
    </div>
    <p style="margin-top:1rem"><strong>Action:</strong> Continue watching. Add to journal when a setup appears.</p>
  </div>`}`;
}

function afterPlanner() {
  setTimeout(() => renderPriceChart('plan-chart', selectedSymbol), 100);
}

function refreshPlan() {
  const symbol = document.getElementById('planner-symbol')?.value || selectedSymbol;
  selectedSymbol = symbol;
  document.getElementById('plan-output').innerHTML = renderPlanOutput(symbol);
  setTimeout(() => renderPriceChart('plan-chart', symbol), 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — RISK CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function buildRiskCalc() {
  return `
  <div class="tab-header">
    <h2>Risk Calculator</h2>
    <p class="tab-desc">Position size is determined by how much you can afford to lose, not how confident you feel. Input any trade to get the exact quantity.</p>
  </div>

  <div class="two-col">
    <div class="card">
      <h3>Position Sizing Calculator</h3>
      <div class="calc-form">
        <div class="form-row">
          <label>Total Capital (₹)</label>
          <input type="number" id="rc-capital" value="${CONFIG.capital}" oninput="recalcRisk()">
        </div>
        <div class="form-row">
          <label>Risk per Trade (%)</label>
          <input type="number" id="rc-risk" value="${CONFIG.riskPercent}" step="0.1" min="0.1" max="5" oninput="recalcRisk()">
        </div>
        <div class="form-row">
          <label>Entry Price (₹)</label>
          <input type="number" id="rc-entry" value="1000" oninput="recalcRisk()">
        </div>
        <div class="form-row">
          <label>Stop-Loss Price (₹)</label>
          <input type="number" id="rc-stop" value="960" oninput="recalcRisk()">
        </div>
        <div class="form-row">
          <label>Target 1 (₹)</label>
          <input type="number" id="rc-target1" value="1080" oninput="recalcRisk()">
        </div>
        <div class="form-row">
          <label>Target 2 (₹) <span class="optional">optional</span></label>
          <input type="number" id="rc-target2" value="1120" oninput="recalcRisk()">
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Result</h3>
      <div id="risk-result">${computeRiskResult()}</div>
    </div>
  </div>

  <div class="card info-card">
    <h3>📐 The Position Sizing Formula</h3>
    <div class="formula-block">
      <div class="formula">Capital at Risk = Total Capital × Risk%</div>
      <div class="formula">Risk per Share = Entry Price − Stop Price</div>
      <div class="formula highlight">Position Size = Capital at Risk ÷ Risk per Share</div>
    </div>
    <p>This formula means your stop distance determines your position size — not the other way around. A wider stop means fewer shares. A tighter stop means more shares. The capital you risk per trade stays constant.</p>
    <p><strong>Key rule:</strong> Never size a position based on how confident you feel. Size it based on where your stop is.</p>
  </div>

  <div class="card">
    <h3>Portfolio Risk Monitor</h3>
    <div id="portfolio-check">${buildPortfolioCheck()}</div>
  </div>`;
}

function computeRiskResult() {
  const cap    = +document.getElementById('rc-capital')?.value || CONFIG.capital;
  const risk   = +document.getElementById('rc-risk')?.value    || CONFIG.riskPercent;
  const entry  = +document.getElementById('rc-entry')?.value   || 0;
  const stop   = +document.getElementById('rc-stop')?.value    || 0;
  const t1     = +document.getElementById('rc-target1')?.value || 0;
  const t2     = +document.getElementById('rc-target2')?.value || 0;

  if (!entry || !stop || entry <= stop) {
    return '<div class="alert-warning">Enter valid entry and stop prices (entry must be above stop).</div>';
  }

  const pos = calculatePosition({ capital: cap, riskPercent: risk, entry, stop, target1: t1, target2: t2 });
  if (pos.error) return `<div class="alert-danger">${pos.error}</div>`;

  return `
    <div class="result-grid">
      <div class="result-item highlight">
        <span class="ri-label">Quantity to Buy</span>
        <span class="ri-value">${pos.quantity} shares</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Capital at Risk</span>
        <span class="ri-value negative">₹${pos.capitalAtRisk.toLocaleString('en-IN')} (${pos.actualRiskPct}%)</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Position Value</span>
        <span class="ri-value">₹${pos.positionValue.toLocaleString('en-IN')} (${pos.positionPct}%)</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Risk per Share</span>
        <span class="ri-value">₹${pos.riskPerShare}</span>
      </div>
      <div class="result-item">
        <span class="ri-label">R:R Ratio</span>
        <span class="ri-value ${pos.rr >= CONFIG.minRR ? 'positive' : 'negative'}">${pos.rr}:1 ${pos.rr >= CONFIG.minRR ? '✓' : '✗'}</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Net Profit at T1</span>
        <span class="ri-value ${pos.rewards.netReward1 >= 0 ? 'positive' : 'negative'}">₹${pos.rewards.netReward1.toLocaleString('en-IN')}</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Loss at Stop</span>
        <span class="ri-value negative">₹${pos.scenarios.lossAtStop.toFixed(2)}</span>
      </div>
      <div class="result-item">
        <span class="ri-label">Total Costs</span>
        <span class="ri-value">₹${pos.costs.totalCosts}</span>
      </div>
    </div>
    ${pos.checks.map(c => `<div class="alert-${c.type}" style="margin-top:.75rem">${c.msg}</div>`).join('')}

    <div class="scenario-bar" style="margin-top:1.2rem">
      <div class="sb-loss" style="width:${Math.min(50, (Math.abs(pos.scenarios.lossAtStop) / (pos.rewards.grossReward1 + Math.abs(pos.scenarios.lossAtStop))) * 100)}%">
        Loss ₹${Math.abs(pos.scenarios.lossAtStop).toFixed(0)}
      </div>
      <div class="sb-gain" style="width:${Math.min(50, (pos.rewards.grossReward1 / (pos.rewards.grossReward1 + Math.abs(pos.scenarios.lossAtStop))) * 100)}%">
        Gain ₹${pos.rewards.grossReward1.toFixed(0)}
      </div>
    </div>`;
}

function buildPortfolioCheck() {
  const trades = loadJournal().filter(e => e.outcome === 'Open');
  const check = portfolioRiskCheck(trades.map(t => ({
    symbol: t.symbol, sector: t.sector,
    positionValue: t.entry * t.quantity,
    riskRs: (t.entry - t.stop) * t.quantity,
  })));

  return `
    <div class="portfolio-grid">
      <div class="pf-item"><span>Open Positions</span><span>${check.openPositions} / ${check.maxPositions}</span></div>
      <div class="pf-item"><span>Capital Deployed</span><span>${check.exposurePct}%</span></div>
      <div class="pf-item"><span>Total Open Risk</span><span class="${check.riskPct > 3 ? 'negative' : 'positive'}">${check.riskPct}%</span></div>
      <div class="pf-item"><span>Can Open New</span><span>${check.canOpenNew ? '✓ Yes' : '✗ No'}</span></div>
    </div>
    ${check.warnings.map(w => `<div class="alert-warning" style="margin-top:.5rem">${w}</div>`).join('')}`;
}

function afterRiskCalc() {
  // Already rendered inline
}

function recalcRisk() {
  document.getElementById('risk-result').innerHTML = computeRiskResult();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — TRADE JOURNAL
// ═══════════════════════════════════════════════════════════════════════════════
function buildJournal() {
  const entries = loadJournal();
  const stats   = journalStats();

  return `
  <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <h2>Trade Journal</h2>
      <p class="tab-desc">Record every trade <em>before and after</em>. A good process in a losing trade is still good process.</p>
    </div>
    <button class="btn-primary" onclick="showNewTradeForm()">+ Log Trade</button>
  </div>

  ${stats ? `
  <div class="journal-stats">
    <div class="js-card">
      <span class="js-label">Win Rate</span>
      <span class="js-value ${stats.winRate >= 50 ? 'positive' : 'negative'}">${stats.winRate}%</span>
    </div>
    <div class="js-card">
      <span class="js-label">Total P&L</span>
      <span class="js-value ${stats.totalPnL >= 0 ? 'positive' : 'negative'}">₹${stats.totalPnL.toLocaleString('en-IN')}</span>
    </div>
    <div class="js-card">
      <span class="js-label">Profit Factor</span>
      <span class="js-value ${stats.profitFactor >= 1.5 ? 'positive' : 'negative'}">${stats.profitFactor}</span>
    </div>
    <div class="js-card">
      <span class="js-label">Avg Win</span>
      <span class="js-value positive">₹${stats.avgWin.toLocaleString('en-IN')}</span>
    </div>
    <div class="js-card">
      <span class="js-label">Avg Loss</span>
      <span class="js-value negative">₹${stats.avgLoss.toLocaleString('en-IN')}</span>
    </div>
    <div class="js-card">
      <span class="js-label">Rules Followed</span>
      <span class="js-value">${stats.followedRulesPct}%</span>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <h3>Win / Loss Split</h3>
      <div class="chart-wrap" style="height:180px"><canvas id="journal-doughnut"></canvas></div>
    </div>
    <div class="card">
      <h3>Setup Performance</h3>
      <table>
        <thead><tr><th>Setup</th><th>Trades</th><th>Wins</th><th>Win %</th><th>P&L</th></tr></thead>
        <tbody>
          ${Object.entries(stats.setupBreakdown).map(([type, d]) => `
            <tr>
              <td><span class="tag ${type === 'Breakout' ? 'gold' : type === 'Pullback' ? 'green' : 'purple'}">${type}</span></td>
              <td>${d.total}</td>
              <td>${d.wins}</td>
              <td>${((d.wins/d.total)*100).toFixed(0)}%</td>
              <td class="${d.pnl >= 0 ? 'positive' : 'negative'}">₹${d.pnl.toFixed(0)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

  <div id="journal-form-area"></div>

  <div class="card">
    <h3>Trade Log</h3>
    <div class="journal-list">
      ${entries.length === 0 ? '<p style="color:#64748b">No trades yet. Click "+ Log Trade" to start your journal.</p>' :
        entries.map(e => buildJournalEntry(e)).join('')}
    </div>
  </div>`;
}

function buildJournalEntry(e) {
  const pnlCls = e.outcome === 'Win' ? 'positive' : e.outcome === 'Loss' ? 'negative' : '';
  const stars  = '★'.repeat(e.rating || 0) + '☆'.repeat(5 - (e.rating || 0));
  return `
  <div class="journal-entry ${e.outcome?.toLowerCase() || 'open'}">
    <div class="je-header">
      <div class="je-top">
        <span class="je-symbol">${e.symbol}</span>
        <span class="tag ${e.setupType === 'Breakout' ? 'gold' : e.setupType === 'Pullback' ? 'green' : 'purple'}">${e.setupType}</span>
        <span class="tag ${e.outcome === 'Win' ? 'green' : e.outcome === 'Loss' ? 'red' : 'blue'}">${e.outcome || 'Open'}</span>
        ${!e.followedRules ? '<span class="tag red">Rules Broken</span>' : ''}
      </div>
      <div class="je-meta">${e.date} · ${e.marketRegime} · <span class="je-stars">${stars}</span></div>
    </div>
    <div class="je-levels">
      <span>Entry ₹${e.entry}</span>
      <span>Stop ₹${e.stop}</span>
      <span>T1 ₹${e.target1}</span>
      <span>Qty ${e.quantity}</span>
      <span>R:R ${e.rr}</span>
      ${e.exitPrice ? `<span>Exit ₹${e.exitPrice}</span>` : ''}
      ${e.pnl ? `<span class="${pnlCls} bold">P&L ₹${e.pnl.toLocaleString('en-IN')}</span>` : ''}
    </div>
    <div class="je-thesis"><strong>Thesis:</strong> ${e.thesis}</div>
    ${e.lesson ? `<div class="je-lesson"><strong>Lesson:</strong> ${e.lesson}</div>` : ''}
    <div class="je-actions">
      ${e.outcome === 'Open' ? `<button class="btn-sm" onclick="showExitForm(${e.id})">Record Exit</button>` : ''}
      <button class="btn-sm danger" onclick="deleteEntry(${e.id})">Delete</button>
    </div>
  </div>`;
}

function afterJournal() {
  const stats = journalStats();
  if (stats) setTimeout(() => renderWinLossDoughnut('journal-doughnut', stats), 50);
}

function showNewTradeForm() {
  const area = document.getElementById('journal-form-area');
  if (!area) return;
  area.innerHTML = `
  <div class="card form-card">
    <h3>Log New Trade</h3>
    <div class="form-grid">
      <div class="form-row"><label>Date</label><input type="date" id="jf-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-row"><label>Symbol</label>
        <select id="jf-symbol">
          ${UNIVERSE.map(s => `<option value="${s.symbol}" data-sector="${s.sector}">${s.symbol}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Setup Type</label>
        <select id="jf-setup"><option>Breakout</option><option>Pullback</option><option>Momentum</option></select>
      </div>
      <div class="form-row"><label>Market Regime</label>
        <select id="jf-regime"><option>Strong Uptrend</option><option>Moderate Uptrend</option><option>Choppy / Sideways</option><option>Downtrend / Weak</option></select>
      </div>
      <div class="form-row"><label>Entry ₹</label><input type="number" id="jf-entry"></div>
      <div class="form-row"><label>Stop ₹</label><input type="number" id="jf-stop"></div>
      <div class="form-row"><label>Target 1 ₹</label><input type="number" id="jf-t1"></div>
      <div class="form-row"><label>Quantity</label><input type="number" id="jf-qty"></div>
      <div class="form-row"><label>Followed Rules?</label>
        <select id="jf-rules"><option value="true">Yes</option><option value="false">No</option></select>
      </div>
    </div>
    <div class="form-row full"><label>Trade Thesis (why you entered)</label>
      <textarea id="jf-thesis" rows="3" placeholder="Describe the setup and your reasoning..."></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="submitJournal()">Save Trade</button>
      <button class="btn-ghost" onclick="document.getElementById('journal-form-area').innerHTML=''">Cancel</button>
    </div>
  </div>`;
  area.scrollIntoView({ behavior: 'smooth' });
}

function submitJournal() {
  const symbolEl = document.getElementById('jf-symbol');
  const symbol = symbolEl?.value;
  const stock  = UNIVERSE.find(s => s.symbol === symbol);
  const entry  = +document.getElementById('jf-entry')?.value;
  const stop   = +document.getElementById('jf-stop')?.value;
  const t1     = +document.getElementById('jf-t1')?.value;
  const qty    = +document.getElementById('jf-qty')?.value;

  addTrade({
    date: document.getElementById('jf-date')?.value,
    symbol,
    sector: stock?.sector || '',
    setupType: document.getElementById('jf-setup')?.value,
    marketRegime: document.getElementById('jf-regime')?.value,
    entry, stop, target1: t1, quantity: qty,
    rr: entry && stop && t1 ? +((t1 - entry) / (entry - stop)).toFixed(2) : 0,
    followedRules: document.getElementById('jf-rules')?.value === 'true',
    thesis: document.getElementById('jf-thesis')?.value,
    outcome: 'Open',
  });

  renderTab('journal');
}

function showExitForm(id) {
  const trade = loadJournal().find(e => e.id === id);
  if (!trade) return;
  const area = document.getElementById('journal-form-area');
  if (!area) return;
  area.innerHTML = `
  <div class="card form-card">
    <h3>Record Exit — ${trade.symbol}</h3>
    <div class="form-grid">
      <div class="form-row"><label>Exit Date</label><input type="date" id="ef-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-row"><label>Exit Price ₹</label><input type="number" id="ef-price"></div>
    </div>
    <div class="form-row full"><label>Lesson Learned</label>
      <textarea id="ef-lesson" rows="3" placeholder="What did this trade teach you?"></textarea>
    </div>
    <div class="form-row full"><label>Process Rating (1–5)</label>
      <input type="range" id="ef-rating" min="1" max="5" value="3">
      <small>Rate the quality of your process, not the outcome.</small>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="submitExit(${id})">Save Exit</button>
      <button class="btn-ghost" onclick="document.getElementById('journal-form-area').innerHTML=''">Cancel</button>
    </div>
  </div>`;
  area.scrollIntoView({ behavior: 'smooth' });
}

function submitExit(id) {
  updateTrade(id, {
    exitDate: document.getElementById('ef-date')?.value,
    exitPrice: +document.getElementById('ef-price')?.value,
    lesson: document.getElementById('ef-lesson')?.value,
    rating: +document.getElementById('ef-rating')?.value,
  });
  renderTab('journal');
}

function deleteEntry(id) {
  if (!confirm('Delete this journal entry?')) return;
  deleteTrade(id);
  renderTab('journal');
}

function openJournalEntry(symbol, tradeData) {
  document.querySelector('[data-tab="journal"]')?.click();
  setTimeout(() => {
    showNewTradeForm();
    if (document.getElementById('jf-symbol')) {
      document.getElementById('jf-symbol').value = tradeData.symbol || symbol;
      document.getElementById('jf-setup').value = tradeData.setupType || 'Breakout';
      document.getElementById('jf-entry').value = tradeData.entry || '';
      document.getElementById('jf-stop').value = tradeData.stop || '';
      document.getElementById('jf-t1').value = tradeData.target1 || '';
      document.getElementById('jf-qty').value = tradeData.quantity || '';
    }
  }, 200);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6 — BACKTEST LAB
// ═══════════════════════════════════════════════════════════════════════════════
function buildBacktest() {
  const watchlist = getWatchlist();
  return `
  <div class="tab-header">
    <h2>Backtest Lab</h2>
    <p class="tab-desc">Test your rules on historical data to understand their <em>behaviour</em>. Backtest results explain the past — they do not guarantee the future.</p>
  </div>

  <div class="card">
    <h3>Run Backtest</h3>
    <div class="bt-controls">
      <div class="form-row">
        <label>Symbol</label>
        <select id="bt-symbol">
          ${watchlist.map(s => `<option value="${s.symbol}">${s.symbol}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Capital ₹</label><input type="number" id="bt-capital" value="${CONFIG.capital}"></div>
      <div class="form-row"><label>Risk % per trade</label><input type="number" id="bt-risk" value="${CONFIG.riskPercent}" step="0.1"></div>
      <div class="form-row"><label>ATR Stop Mult.</label><input type="number" id="bt-atr" value="${CONFIG.atrStopMultiplier}" step="0.1"></div>
      <div class="form-row"><label>Min R:R</label><input type="number" id="bt-rr" value="${CONFIG.minRR}" step="0.1"></div>
      <button class="btn-primary" onclick="runBT()" style="align-self:flex-end">Run Backtest</button>
    </div>
  </div>

  <div id="bt-output">
    <div class="card info-card">
      <h3>⚠️ Important: How to Read Backtest Results</h3>
      <ul>
        <li>Backtests use <strong>synthetic price data</strong> in this tool — results are illustrative, not from real market history.</li>
        <li>All costs are included: ₹${CONFIG.brokeragePerTrade} brokerage each side, ${CONFIG.slippagePct * 100}% slippage, STT on sell side.</li>
        <li>A high win rate in backtests does not mean it will repeat. Markets change.</li>
        <li>Max drawdown tells you the worst equity decline you should be prepared to sit through.</li>
        <li>A Sharpe > 1.0 is generally considered acceptable. > 2.0 is strong.</li>
        <li>Use these results to understand the <em>behaviour of the rules</em>, not to trust specific profit numbers.</li>
      </ul>
    </div>
  </div>`;
}

function runBT() {
  const symbol  = document.getElementById('bt-symbol')?.value;
  const capital = +document.getElementById('bt-capital')?.value || CONFIG.capital;
  const risk    = +document.getElementById('bt-risk')?.value   || CONFIG.riskPercent;
  const atrM    = +document.getElementById('bt-atr')?.value    || CONFIG.atrStopMultiplier;
  const minRR   = +document.getElementById('bt-rr')?.value     || CONFIG.minRR;

  document.getElementById('bt-output').innerHTML = '<div class="card"><p>Running backtest…</p></div>';

  setTimeout(() => {
    const result = runBacktest(symbol, { capital, riskPercent: risk, atrStopMultiplier: atrM, minRR });
    if (!result) {
      document.getElementById('bt-output').innerHTML = '<div class="card"><p>Not enough data to run backtest on this symbol.</p></div>';
      return;
    }
    backtestResult = result;
    const m = result.metrics;

    // Zero trades case
    if (!m || m.totalTrades === 0) {
      document.getElementById('bt-output').innerHTML = `
      <div class="card info-card">
        <h3>No Trades Generated</h3>
        <p>The breakout strategy found no qualifying entries for <strong>${symbol}</strong> in the test period. This is a valid result — it means the rules were very strict and the price action did not produce a clear breakout with sufficient volume confirmation.</p>
        <p><strong>What to try:</strong></p>
        <ul>
          <li>Reduce the Min R:R from ${minRR} to 1.5</li>
          <li>Reduce the ATR Stop Mult from ${atrM} to 1.0 (tighter stop → larger R:R)</li>
          <li>Try a different symbol (ICICIBANK, INFY, or MARUTI tend to trend more clearly)</li>
        </ul>
        <p>Getting zero trades is itself a useful learning: the rules only triggered on genuine setups. A strategy that never trades is safer than one that overtraces.</p>
      </div>`;
      return;
    }

    document.getElementById('bt-output').innerHTML = `
    <div class="bt-metrics-grid">
      ${[
        ['Total Trades', m.totalTrades, ''],
        ['Win Rate', m.winRate + '%', m.winRate >= 50 ? 'positive' : 'negative'],
        ['Profit Factor', m.profitFactor, m.profitFactor >= 1.5 ? 'positive' : 'negative'],
        ['Avg Win', '₹' + m.avgWin.toLocaleString('en-IN'), 'positive'],
        ['Avg Loss', '₹' + m.avgLoss.toLocaleString('en-IN'), 'negative'],
        ['Max Drawdown', m.maxDrawdown + '%', m.maxDrawdown < 15 ? 'positive' : 'negative'],
        ['Sharpe Ratio', m.sharpe, m.sharpe >= 1 ? 'positive' : 'negative'],
        ['Net P&L', '₹' + m.totalPnL.toLocaleString('en-IN'), m.totalPnL >= 0 ? 'positive' : 'negative'],
        ['CAGR', m.cagr.toFixed(1) + '%', m.cagr >= 10 ? 'positive' : ''],
        ['Final Capital', '₹' + m.finalCapital.toLocaleString('en-IN'), ''],
      ].map(([label, val, cls]) => `
        <div class="bt-metric-card">
          <span class="bt-metric-label">${label}</span>
          <span class="bt-metric-value ${cls}">${val}</span>
        </div>`).join('')}
    </div>

    <div class="two-col">
      <div class="card">
        <h3>Equity Curve — ${symbol}</h3>
        <div class="chart-wrap"><canvas id="bt-equity"></canvas></div>
      </div>
      <div class="card">
        <h3>Trade P&L Distribution</h3>
        <div class="chart-wrap"><canvas id="bt-pnl"></canvas></div>
      </div>
    </div>

    <div class="card">
      <h3>Trade Log <span class="tag blue">${m.totalTrades} trades</span></h3>
      <div class="bt-trade-log">
        <table>
          <thead><tr><th>#</th><th>Entry</th><th>Exit</th><th>Symbol</th><th>Entry ₹</th><th>Exit ₹</th><th>Reason</th><th>R:R</th><th>P&L</th></tr></thead>
          <tbody>
            ${result.trades.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${t.entryDate}</td>
                <td>${t.exitDate}</td>
                <td>${t.symbol}</td>
                <td>₹${t.entry}</td>
                <td>₹${t.exitPrice}</td>
                <td><span class="tag ${t.exitReason === 'Target 1 Hit' ? 'green' : t.exitReason === 'Stop Hit' ? 'red' : 'blue'}">${t.exitReason}</span></td>
                <td>${t.rr}</td>
                <td class="${t.pnl >= 0 ? 'positive' : 'negative'}">₹${t.pnl.toFixed(0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card info-card">
      <h3>Interpretation Guide</h3>
      <p><strong>Win Rate ${m.winRate}%</strong> — ${m.winRate >= 50 ? 'More trades profitable than not. Combined with a Profit Factor > 1.5, this looks solid historically.' : 'Less than half of trades are profitable. The strategy relies on winners being bigger than losers (trend-following style).'}</p>
      <p><strong>Profit Factor ${m.profitFactor}</strong> — For every ₹1 lost, this strategy has historically made ₹${m.profitFactor}. A value above 1.5 is generally acceptable.</p>
      <p><strong>Max Drawdown ${m.maxDrawdown}%</strong> — The worst peak-to-trough equity decline in this test. Ask yourself: would you have stayed with the strategy through a loss of ${m.maxDrawdown}% of your account? Most people overestimate their drawdown tolerance.</p>
      <p><strong>Sharpe ${m.sharpe}</strong> — Risk-adjusted return. Above 1.0 is considered reasonable. Above 2.0 is strong.</p>
    </div>`;

    setTimeout(() => {
      renderEquityChart('bt-equity', result.equity);
      renderPnLDistribution('bt-pnl', result.trades);
    }, 50);
  }, 100);
}

function afterBacktest() {
  // Initial state — no chart yet, user must click Run
}

// ── Utility ───────────────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
