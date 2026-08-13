# 📈 IMLEP — Indian Market Learning & Entry Planner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.4.4-ff6384.svg)](https://www.chartjs.org/)
[![Market](https://img.shields.io/badge/Market-Nifty_50_NSE-orange.svg)](#)

> **IMLEP** is a quantitative trade analysis, risk management, and entry planning Web application for Nifty 50 equities. Rather than serving as a speculative signal generator, IMLEP provides a **structured 4-step decision framework** ensuring every trade has a validated entry trigger, a logical stop-loss, structural profit targets, and risk-adjusted position sizing before order placement.

---

## 🌐 Live Demo & Documentation

- **🚀 Live Web App:** [https://s-amarth-k.github.io/Stock-Planner/](https://s-amarth-k.github.io/Stock-Planner/)
- **📖 Logic & Methodology Manual:** [documentation.html](documentation.html) *(Detailed 700+ line methodology guide)*

---

## ✨ Key Features

IMLEP operates across **6 interactive modules**:

| Module | Description | Core Responsibility |
| :--- | :--- | :--- |
| 🌍 **Market View** | Broad market regime analysis | Classifies overall market environment (Bullish / Neutral / Bearish) via Nifty 50 trend & volatility filters before evaluating individual stocks. |
| 👁 **Watchlist** | Stock quote scanner | Displays real-time quotes, intraday price changes, and high-level indicator summaries for Nifty 50 universe. |
| 🎯 **Entry Planner** | Algorithmic setup engine | Evaluates stocks against a **100-point transparent scoring framework** across Breakout, Support Pullback, and Momentum setups. |
| 🛡 **Risk Calculator** | Dynamic position sizing | Calculates exact share quantities based on portfolio risk tolerance (e.g. 1-2% max risk) using ATR-based stop-loss levels. |
| 📒 **Trade Journal** | Trade log & history | Tracks taken trades with `localStorage` persistence, monitoring execution metrics and account capital preservation. |
| 🔬 **Backtest Lab** | Strategy simulation | Runs multi-year historical simulations to evaluate strategy win-rates, profit factors, and maximum drawdowns. |

---

## 🧮 Mathematical & Technical Architecture

### 1. Synthetic Price Generation (Geometric Brownian Motion)
To enable deterministic, authentication-free technical analysis testing, IMLEP generates simulated daily OHLCV price feeds using **Geometric Brownian Motion (GBM)**:

$$S(t+1) = S(t) \times \exp(\mu + \sigma \cdot Z)$$

- $\mu$ = Daily drift parameter tailored per stock sector
- $\sigma$ = Daily volatility factor (e.g., 1.3% for RELIANCE, 2.0% for TATAMOTORS)
- $Z$ = Standard normal random variable

### 2. Indicator Calculation Engine
Implemented pure JavaScript technical analysis routines without third-party math libraries:
- **Simple Moving Average (SMA 20/50/200)** & **Exponential Moving Average (EMA 9/21)**
- **Relative Strength Index (RSI 14)** with overbought (>70) / oversold (<30) thresholds
- **Average True Range (ATR 14)** for volatility-based trailing stop-loss calculations
- **Bollinger Bands & MACD** for momentum confirmation

---

## 📁 Repository Structure

```text
stock-market/
├── css/
│   └── style.css            # Custom CSS design system (dark mode, layout grids, cards)
├── js/
│   ├── config.js            # Global configuration & app settings
│   ├── universe.js          # Nifty 50 stock universe & metadata definitions
│   ├── data.js              # Deterministic GBM synthetic stock price generator
│   ├── indicators.js        # Math engine for SMA, EMA, RSI, ATR, MACD & Bollinger Bands
│   ├── market.js            # Broad Nifty 50 market regime evaluator
│   ├── setups.js            # 100-point quantitative setup scoring engine
│   ├── risk.js              # Position sizing & risk-reward risk engine
│   ├── planner.js           # 4-step decision pipeline execution logic
│   ├── journal.js           # LocalStorage trade journal & CRUD operations
│   ├── backtest.js          # Strategy backtester & win-rate simulator
│   ├── charts.js            # Chart.js visualizer for price series & performance
│   └── app.js               # Main UI router & tab navigation controller
├── index.html               # Single Page Application (SPA) entry shell
├── documentation.html       # Comprehensive technical logic documentation
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

Since IMLEP is a zero-dependency client-side application, you don't need `npm` or build tools.

### Option 1: Direct Run
1. Clone the repository:
   ```bash
   git clone https://github.com/S-amarth-K/Stock-Planner.git
   cd Stock-Planner
   ```
2. Open `index.html` in any modern web browser.

### Option 2: Run via Local Server
Using Python HTTP server:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

---

## ⚠️ Disclaimer

This tool uses simulated data and quantitative heuristics for **educational and research purposes only**. It does not constitute financial or investment advice. Always consult a SEBI registered financial advisor before making real market investments.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
