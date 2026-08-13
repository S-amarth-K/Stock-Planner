/**
 * charts.js — Chart.js wrapper functions.
 * One function per chart type. All charts use the dark design theme.
 */

const CHART_THEME = {
  bg:          'rgba(0,0,0,0)',
  gridColor:   'rgba(255,255,255,0.05)',
  textColor:   '#94a3b8',
  blue:        '#3b82f6',
  blueLight:   'rgba(59,130,246,0.15)',
  gold:        '#f59e0b',
  goldLight:   'rgba(245,158,11,0.15)',
  green:       '#10b981',
  greenLight:  'rgba(16,185,129,0.15)',
  red:         '#ef4444',
  redLight:    'rgba(239,68,68,0.15)',
  purple:      '#8b5cf6',
};

// Destroy existing chart on a canvas before recreating
const _charts = {};
function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Default chart options ─────────────────────────────────────────────────────
function baseOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: CHART_THEME.textColor, font: { family: 'Inter', size: 12 } },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: CHART_THEME.textColor,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks:  { color: CHART_THEME.textColor, font: { size: 11 }, maxTicksLimit: 8 },
        grid:   { color: CHART_THEME.gridColor },
        border: { color: 'rgba(255,255,255,0.1)' },
      },
      y: {
        ticks:  { color: CHART_THEME.textColor, font: { size: 11 } },
        grid:   { color: CHART_THEME.gridColor },
        border: { color: 'rgba(255,255,255,0.1)' },
      },
    },
    ...overrides,
  };
}

// ── Equity Curve Chart ────────────────────────────────────────────────────────
function renderEquityChart(canvasId, equityData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = equityData.map(e => e.date);
  const values = equityData.map(e => e.value);
  const initial = values[0] || CONFIG.capital;
  const colors  = values.map(v => v >= initial ? CHART_THEME.green : CHART_THEME.red);

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio Value (₹)',
        data: values,
        borderColor: CHART_THEME.blue,
        backgroundColor: CHART_THEME.blueLight,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label: ctx => `₹${ctx.raw.toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        ...baseOptions().scales,
        y: {
          ...baseOptions().scales.y,
          ticks: {
            ...baseOptions().scales.y.ticks,
            callback: v => '₹' + (v / 1000).toFixed(0) + 'K',
          },
        },
      },
    }),
  });
}

// ── Price + MA Line Chart ─────────────────────────────────────────────────────
function renderPriceChart(canvasId, symbol, showSignals = true) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const candles = getRecent(symbol, 80);
  const closes  = candles.map(c => c.close);
  const labels  = candles.map(c => c.date.slice(5));  // MM-DD format

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);

  const datasets = [
    {
      label: symbol + ' Close',
      data: closes,
      borderColor: CHART_THEME.blue,
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
    },
    {
      label: '20 SMA',
      data: s20,
      borderColor: CHART_THEME.gold,
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [],
    },
    {
      label: '50 SMA',
      data: s50,
      borderColor: CHART_THEME.purple,
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [4, 2],
    },
  ];

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ₹${ctx.raw ? ctx.raw.toFixed(2) : '—'}`,
          },
        },
      },
      scales: {
        ...baseOptions().scales,
        y: {
          ...baseOptions().scales.y,
          ticks: {
            ...baseOptions().scales.y.ticks,
            callback: v => '₹' + v.toLocaleString('en-IN'),
          },
        },
      },
    }),
  });
}

// ── RSI Chart ─────────────────────────────────────────────────────────────────
function renderRSIChart(canvasId, symbol) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const candles = getRecent(symbol, 80);
  const closes  = candles.map(c => c.close);
  const labels  = candles.map(c => c.date.slice(5));
  const rsiArr  = rsi(closes, 14);

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'RSI (14)',
          data: rsiArr,
          borderColor: CHART_THEME.purple,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Overbought (70)',
          data: new Array(labels.length).fill(70),
          borderColor: CHART_THEME.red,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [5, 3],
          pointRadius: 0,
        },
        {
          label: 'Oversold (30)',
          data: new Array(labels.length).fill(30),
          borderColor: CHART_THEME.green,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [5, 3],
          pointRadius: 0,
        },
      ],
    },
    options: baseOptions({
      scales: {
        ...baseOptions().scales,
        y: { ...baseOptions().scales.y, min: 0, max: 100, ticks: { color: CHART_THEME.textColor } },
      },
    }),
  });
}

// ── Volume Chart ──────────────────────────────────────────────────────────────
function renderVolumeChart(canvasId, symbol) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const candles = getRecent(symbol, 60);
  const labels  = candles.map(c => c.date.slice(5));
  const vols    = candles.map(c => c.volume);
  const avgV    = avgVolume(vols, 20);

  const barColors = candles.map((c, i) =>
    c.close >= c.open ? CHART_THEME.green : CHART_THEME.red
  );

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Volume',
          data: vols,
          backgroundColor: barColors.map(c => c + 'aa'),
          borderColor: barColors,
          borderWidth: 0,
        },
        {
          label: '20-Day Avg',
          data: avgV,
          type: 'line',
          borderColor: CHART_THEME.gold,
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    },
    options: baseOptions({
      scales: {
        ...baseOptions().scales,
        y: {
          ...baseOptions().scales.y,
          ticks: {
            ...baseOptions().scales.y.ticks,
            callback: v => (v / 1e6).toFixed(1) + 'M',
          },
        },
      },
    }),
  });
}

// ── Sector Strength Bar Chart ─────────────────────────────────────────────────
function renderSectorChart(canvasId, sectorData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels  = sectorData.map(s => s.sector);
  const returns = sectorData.map(s => s.return20d);
  const colors  = returns.map(r => r >= 0 ? CHART_THEME.green : CHART_THEME.red);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '20-Day Return (%)',
        data: returns,
        backgroundColor: colors.map(c => c + 'aa'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: baseOptions({
      indexAxis: 'y',
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: { label: ctx => `${ctx.raw > 0 ? '+' : ''}${ctx.raw}%` },
        },
      },
    }),
  });
}

// ── Backtest P&L Distribution ─────────────────────────────────────────────────
function renderPnLDistribution(canvasId, trades) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = trades.map((_, i) => `T${i + 1}`);
  const pnls   = trades.map(t => t.pnl);
  const colors = pnls.map(p => p >= 0 ? CHART_THEME.green : CHART_THEME.red);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Trade P&L (₹)',
        data: pnls,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: { label: ctx => `₹${ctx.raw.toFixed(0)}` },
        },
      },
    }),
  });
}

// ── Journal Win/Loss Doughnut ─────────────────────────────────────────────────
function renderWinLossDoughnut(canvasId, stats) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  _charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses', 'Breakeven'],
      datasets: [{
        data: [stats.wins, stats.losses, stats.be],
        backgroundColor: [CHART_THEME.green + 'cc', CHART_THEME.red + 'cc', CHART_THEME.gold + 'cc'],
        borderColor: ['#0f172a', '#0f172a', '#0f172a'],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: CHART_THEME.textColor, font: { family: 'Inter' } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'rgba(59,130,246,0.3)',
          borderWidth: 1,
          bodyColor: CHART_THEME.textColor,
        },
      },
      cutout: '65%',
    },
  });
}

// ── Nifty 50 index sparkline ──────────────────────────────────────────────────
function renderNiftySparkline(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const candles = getRecent('NIFTY50', 60);
  const labels  = candles.map(c => c.date.slice(5));
  const closes  = candles.map(c => c.close);
  const s20     = sma(closes, 20);
  const s50     = sma(closes, 50);

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Nifty 50',
          data: closes,
          borderColor: CHART_THEME.blue,
          backgroundColor: CHART_THEME.blueLight,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2.5,
        },
        {
          label: '20 SMA',
          data: s20,
          borderColor: CHART_THEME.gold,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: '50 SMA',
          data: s50,
          borderColor: CHART_THEME.purple,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [4, 2],
        },
      ],
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw ? ctx.raw.toLocaleString('en-IN') : '—'}` },
        },
      },
      scales: {
        ...baseOptions().scales,
        y: {
          ...baseOptions().scales.y,
          ticks: { color: CHART_THEME.textColor, callback: v => v.toLocaleString('en-IN') },
        },
      },
    }),
  });
}
