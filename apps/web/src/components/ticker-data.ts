/**
 * Asset universe for the InvestTicker, grouped into the categories it cycles
 * through before landing on "anything." Each entry carries a display symbol,
 * a human name, and a sample 24h percentage move used for the hover delta.
 *
 * The `slug` is the path segment appended to the Lux exchange host for the
 * category link; per-symbol links use `${exchangeHost}/${symbol}`.
 *
 * This data is illustrative marketing copy — a representative cross-section of
 * each market, not a live quote feed. The live total-asset count is fetched
 * separately (see `useAssetCount`).
 */

export interface TickerAsset {
  readonly symbol: string
  readonly name: string
  /** Sample 24h move, percent. Sign drives the green/red hover delta. */
  readonly move: number
}

export interface TickerCategory {
  readonly label: string
  readonly slug: string
  readonly assets: readonly TickerAsset[]
}

export const CATEGORIES: readonly TickerCategory[] = [
  {
    label: 'stocks',
    slug: '/stocks',
    assets: [
      { symbol: 'AAPL', name: 'Apple', move: 1.1 },
      { symbol: 'NVDA', name: 'NVIDIA', move: 2.7 },
      { symbol: 'MSFT', name: 'Microsoft', move: -0.4 },
      { symbol: 'TSLA', name: 'Tesla', move: 3.6 },
      { symbol: 'AMZN', name: 'Amazon', move: 0.8 },
      { symbol: 'GOOGL', name: 'Alphabet', move: 1.3 },
      { symbol: 'META', name: 'Meta', move: 1.9 },
      { symbol: 'NFLX', name: 'Netflix', move: 4.1 },
      { symbol: 'AMD', name: 'AMD', move: -1.2 },
      { symbol: 'COIN', name: 'Coinbase', move: 5.4 },
      { symbol: 'HOOD', name: 'Robinhood', move: 7.8 },
      { symbol: 'PLTR', name: 'Palantir', move: 3.0 },
      { symbol: 'CRWD', name: 'CrowdStrike', move: 2.6 },
      { symbol: 'NET', name: 'Cloudflare', move: 4.9 },
      { symbol: 'SHOP', name: 'Shopify', move: -2.1 },
      { symbol: 'UBER', name: 'Uber', move: 1.7 },
      { symbol: 'ABNB', name: 'Airbnb', move: -0.7 },
      { symbol: 'SPOT', name: 'Spotify', move: 2.4 },
    ],
  },
  {
    label: 'bonds',
    slug: '/bonds',
    assets: [
      { symbol: 'TLT', name: 'Treasury 20Y+', move: -0.3 },
      { symbol: 'AGG', name: 'Aggregate Bond', move: 0.1 },
      { symbol: 'BND', name: 'Total Bond', move: 0.2 },
      { symbol: 'HYG', name: 'High Yield', move: 0.4 },
      { symbol: 'LQD', name: 'Investment Grade', move: -0.2 },
      { symbol: 'TIP', name: 'TIPS', move: 0.5 },
      { symbol: 'MUB', name: 'Municipal', move: 0.2 },
      { symbol: 'IEF', name: 'Treasury 7-10Y', move: -0.3 },
      { symbol: 'SHY', name: 'Short Treasury', move: 0.1 },
      { symbol: 'EMB', name: 'EM Bonds', move: -0.6 },
      { symbol: 'VCIT', name: 'Corporate', move: 0.2 },
      { symbol: 'BNDX', name: 'Intl Bond', move: 0.3 },
    ],
  },
  {
    label: 'commodities',
    slug: '/commodities',
    assets: [
      { symbol: 'GLD', name: 'Gold', move: 0.9 },
      { symbol: 'SLV', name: 'Silver', move: 1.8 },
      { symbol: 'USO', name: 'Crude Oil', move: -2.0 },
      { symbol: 'UNG', name: 'Natural Gas', move: 3.1 },
      { symbol: 'CPER', name: 'Copper', move: 1.2 },
      { symbol: 'PPLT', name: 'Platinum', move: -0.5 },
      { symbol: 'PALL', name: 'Palladium', move: 1.6 },
      { symbol: 'WEAT', name: 'Wheat', move: 0.4 },
      { symbol: 'CORN', name: 'Corn', move: -0.8 },
      { symbol: 'DBA', name: 'Agriculture', move: 0.6 },
      { symbol: 'CANE', name: 'Sugar', move: 2.3 },
      { symbol: 'NIB', name: 'Cocoa', move: 4.6 },
    ],
  },
  {
    label: 'real estate',
    slug: '/real-estate',
    assets: [
      { symbol: 'AMT', name: 'American Tower', move: 0.7 },
      { symbol: 'PLD', name: 'Prologis', move: 1.0 },
      { symbol: 'DLR', name: 'Digital Realty', move: 2.2 },
      { symbol: 'O', name: 'Realty Income', move: 0.3 },
      { symbol: 'SPG', name: 'Simon Property', move: -0.5 },
      { symbol: 'WELL', name: 'Welltower', move: 0.5 },
      { symbol: 'PSA', name: 'Public Storage', move: -0.2 },
      { symbol: 'VICI', name: 'VICI Properties', move: 1.4 },
      { symbol: 'AVB', name: 'AvalonBay', move: 0.8 },
      { symbol: 'EQR', name: 'Equity Residential', move: -0.6 },
      { symbol: 'ARE', name: 'Alexandria', move: 1.7 },
      { symbol: 'SLG', name: 'SL Green', move: 2.5 },
    ],
  },
  {
    label: 'private markets',
    slug: '/private',
    assets: [
      { symbol: 'OPENAI', name: 'OpenAI', move: 11.8 },
      { symbol: 'ANTHROPIC', name: 'Anthropic', move: 8.4 },
      { symbol: 'SPACEX', name: 'SpaceX', move: 5.1 },
      { symbol: 'STRIPE', name: 'Stripe', move: 3.0 },
      { symbol: 'DATABRICKS', name: 'Databricks', move: 6.5 },
      { symbol: 'FIGMA', name: 'Figma', move: 4.3 },
      { symbol: 'REVOLUT', name: 'Revolut', move: 7.0 },
      { symbol: 'RIPPLE', name: 'Ripple', move: 8.8 },
      { symbol: 'ANDURIL', name: 'Anduril', move: 10.9 },
      { symbol: 'SCALE', name: 'Scale AI', move: 6.1 },
      { symbol: 'RAMP', name: 'Ramp', move: 8.5 },
      { symbol: 'BREX', name: 'Brex', move: 2.6 },
      { symbol: 'KLARNA', name: 'Klarna', move: 3.4 },
      { symbol: 'PLAID', name: 'Plaid', move: -2.0 },
    ],
  },
  {
    label: 'crypto',
    slug: '/crypto',
    assets: [
      { symbol: 'LUX', name: 'Lux', move: 6.4 },
      { symbol: 'BTC', name: 'Bitcoin', move: 2.0 },
      { symbol: 'ETH', name: 'Ethereum', move: 3.3 },
      { symbol: 'SOL', name: 'Solana', move: 7.1 },
      { symbol: 'LINK', name: 'Chainlink', move: 4.4 },
      { symbol: 'DOGE', name: 'Dogecoin', move: 12.1 },
      { symbol: 'AVAX', name: 'Avalanche', move: -1.7 },
      { symbol: 'DOT', name: 'Polkadot', move: -2.3 },
      { symbol: 'ATOM', name: 'Cosmos', move: 1.5 },
      { symbol: 'UNI', name: 'Uniswap', move: 5.0 },
      { symbol: 'AAVE', name: 'Aave', move: -0.6 },
      { symbol: 'ARB', name: 'Arbitrum', move: 8.7 },
      { symbol: 'OP', name: 'Optimism', move: -1.4 },
      { symbol: 'NEAR', name: 'NEAR', move: 3.7 },
      { symbol: 'TIA', name: 'Celestia', move: 6.0 },
      { symbol: 'SUI', name: 'Sui', move: -2.8 },
      { symbol: 'INJ', name: 'Injective', move: -4.0 },
      { symbol: 'RENDER', name: 'Render', move: 9.2 },
      { symbol: 'FET', name: 'Fetch.ai', move: 14.0 },
      { symbol: 'ONDO', name: 'Ondo', move: 9.1 },
      { symbol: 'PEPE', name: 'Pepe', move: 15.3 },
      { symbol: 'WIF', name: 'dogwifhat', move: 18.4 },
      { symbol: 'BONK', name: 'Bonk', move: 21.7 },
      { symbol: 'JUP', name: 'Jupiter', move: 5.3 },
      { symbol: 'PYTH', name: 'Pyth', move: 5.2 },
      { symbol: 'SEI', name: 'Sei', move: 11.5 },
      { symbol: 'STRK', name: 'Starknet', move: -7.9 },
      { symbol: 'WLD', name: 'Worldcoin', move: -6.1 },
    ],
  },
]

/** The terminal word the ticker resolves to once every category has cycled. */
export const FINAL_WORD = 'anything.'

/** Category labels in cycle order, with the finale appended. */
export const CYCLE_LABELS: readonly string[] = [...CATEGORIES.map((c) => c.label), FINAL_WORD]

/** Three marketing lines that fade in beneath the finale. */
export const FINALE_LINES: readonly string[] = [
  '13,000+ assets across every market',
  'Stocks, bonds, crypto, commodities & more',
  '$113 trillion in available liquidity',
]
