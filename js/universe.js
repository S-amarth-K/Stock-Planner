/**
 * universe.js — Curated watchlist of Nifty 50 large caps across sectors.
 * Diversified selection per SEBI investor guidance.
 */

const UNIVERSE = [
  // ── Energy ─────────────────────────────────────────────────────────────────
  {
    symbol: 'RELIANCE', name: 'Reliance Industries Ltd',
    sector: 'Energy', industry: 'Oil & Gas', watch: true,
    notes: 'India\'s largest company by market cap. Strong cash flows from Jio + Retail segments.',
    beta: 1.0, nifty50: true,
  },

  // ── Information Technology ─────────────────────────────────────────────────
  {
    symbol: 'TCS', name: 'Tata Consultancy Services',
    sector: 'Information Technology', industry: 'IT Services', watch: true,
    notes: 'Consistent dividend payer. Watch for global IT spending cycle signals.',
    beta: 0.65, nifty50: true,
  },
  {
    symbol: 'INFY', name: 'Infosys Ltd',
    sector: 'Information Technology', industry: 'IT Services', watch: true,
    notes: 'Global delivery model. Track US client commentary on earnings calls.',
    beta: 0.70, nifty50: true,
  },
  {
    symbol: 'HCLTECH', name: 'HCL Technologies Ltd',
    sector: 'Information Technology', industry: 'IT Services', watch: false,
    notes: 'Strong in infrastructure management. Watch margin trajectory.',
    beta: 0.72, nifty50: true,
  },

  // ── Banking & Financial Services ───────────────────────────────────────────
  {
    symbol: 'HDFCBANK', name: 'HDFC Bank Ltd',
    sector: 'Banking', industry: 'Private Banks', watch: true,
    notes: 'Largest private bank. Watch credit growth and NIM post-merger.',
    beta: 1.05, nifty50: true,
  },
  {
    symbol: 'ICICIBANK', name: 'ICICI Bank Ltd',
    sector: 'Banking', industry: 'Private Banks', watch: true,
    notes: 'Strong retail growth. Key metric: slippages and PCR trend.',
    beta: 1.15, nifty50: true,
  },
  {
    symbol: 'SBIN', name: 'State Bank of India',
    sector: 'Banking', industry: 'Public Banks', watch: false,
    notes: 'PSU bank. Track government capex and credit offtake data.',
    beta: 1.25, nifty50: true,
  },

  // ── FMCG ───────────────────────────────────────────────────────────────────
  {
    symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd',
    sector: 'FMCG', industry: 'Consumer Goods', watch: true,
    notes: 'Defensive pick. Watch rural demand recovery and input cost trends.',
    beta: 0.55, nifty50: true,
  },
  {
    symbol: 'ITC', name: 'ITC Ltd',
    sector: 'FMCG', industry: 'Conglomerate', watch: false,
    notes: 'Tobacco + FMCG + Hotels. Dividend yield play. Hotels business growing.',
    beta: 0.80, nifty50: true,
  },

  // ── Automobiles ────────────────────────────────────────────────────────────
  {
    symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd',
    sector: 'Automobiles', industry: 'Passenger Vehicles', watch: true,
    notes: 'Dominant in mass-market cars. Watch monthly sales volumes carefully.',
    beta: 0.95, nifty50: true,
  },
  {
    symbol: 'TATAMOTORS', name: 'Tata Motors Ltd',
    sector: 'Automobiles', industry: 'Commercial & Passenger', watch: false,
    notes: 'JLR recovery is key. High beta - can move sharply on global cues.',
    beta: 1.50, nifty50: true,
  },

  // ── Pharmaceuticals ────────────────────────────────────────────────────────
  {
    symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries',
    sector: 'Pharmaceuticals', industry: 'Specialty Pharma', watch: true,
    notes: 'Specialty pipeline and US generics. Watch USFDA inspection news.',
    beta: 0.70, nifty50: true,
  },

  // ── Metals & Mining ────────────────────────────────────────────────────────
  {
    symbol: 'TATASTEEL', name: 'Tata Steel Ltd',
    sector: 'Metals', industry: 'Steel', watch: false,
    notes: 'Cyclical. Track China steel prices and EU demand.',
    beta: 1.40, nifty50: true,
  },

  // ── Infrastructure ─────────────────────────────────────────────────────────
  {
    symbol: 'LT', name: 'Larsen & Toubro Ltd',
    sector: 'Infrastructure', industry: 'Engineering & Construction', watch: true,
    notes: 'Order book driven. Strong proxy on India capex theme.',
    beta: 1.10, nifty50: true,
  },

  // ── Telecom ────────────────────────────────────────────────────────────────
  {
    symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd',
    sector: 'Telecom', industry: 'Wireless', watch: false,
    notes: 'ARPU improvement story. 5G rollout spend is headwind for near-term FCF.',
    beta: 0.85, nifty50: true,
  },
];

/**
 * Get only watchlisted stocks
 */
function getWatchlist() {
  return UNIVERSE.filter(s => s.watch);
}

/**
 * Get unique sectors in the universe
 */
function getSectors() {
  return [...new Set(UNIVERSE.map(s => s.sector))];
}

/**
 * Get stocks by sector
 */
function getStocksBySector(sector) {
  return UNIVERSE.filter(s => s.sector === sector);
}

/**
 * Toggle watch status for a symbol
 */
function toggleWatch(symbol) {
  const stock = UNIVERSE.find(s => s.symbol === symbol);
  if (stock) stock.watch = !stock.watch;
}
