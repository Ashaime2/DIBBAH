/**
 * Formatting utilities for financial data display
 */

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}%`;
}

export function formatCurrency(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatRatio(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function classifyValue(value, { positive = true, threshold = 0 } = {}) {
  if (value === null || value === undefined) return 'neutral';
  if (positive) return value > threshold ? 'positive' : value < threshold ? 'negative' : 'neutral';
  return value < threshold ? 'positive' : value > threshold ? 'negative' : 'neutral';
}

export function getQualityColor(quality) {
  switch (quality) {
    case 'Excellent': return 'badge-green';
    case 'Good': return 'badge-blue';
    case 'Fair': return 'badge-amber';
    case 'Poor': return 'badge-red';
    default: return 'badge-blue';
  }
}

export const KPI_DEFINITIONS = {
  total_return: { label: 'Total Return', format: formatPercent, positive: true, tooltip: 'Total percentage return over the entire period' },
  annualized_return: { label: 'Annual Return', format: formatPercent, positive: true, tooltip: 'Compound annual growth rate (CAGR)' },
  annualized_volatility: { label: 'Annual Volatility', format: formatPercent, positive: false, tooltip: 'Annualized standard deviation of daily returns. Lower is less risky.' },
  sharpe_ratio: { label: 'Sharpe Ratio', format: formatRatio, positive: true, tooltip: 'Risk-adjusted return (return per unit of risk). Above 1 is good, above 2 is excellent.' },
  sortino_ratio: { label: 'Sortino Ratio', format: formatRatio, positive: true, tooltip: 'Like Sharpe but only penalizes downside volatility. More relevant for asymmetric returns.' },
  max_drawdown: { label: 'Max Drawdown', format: formatPercent, positive: false, tooltip: 'Largest peak-to-trough decline. Shows worst-case scenario.' },
  calmar_ratio: { label: 'Calmar Ratio', format: formatRatio, positive: true, tooltip: 'Annualized return divided by max drawdown. Higher means better return per unit of risk.' },
  win_rate: { label: 'Win Rate', format: formatPercent, positive: true, tooltip: 'Percentage of trades that were profitable.' },
  profit_factor: { label: 'Profit Factor', format: formatRatio, positive: true, tooltip: 'Gross profits divided by gross losses. Above 1 means profitable, above 2 is very good.' },
  total_trades: { label: 'Total Trades', format: (v) => String(v), positive: null, tooltip: 'Total number of completed round-trip trades.' },
  avg_trade_duration: { label: 'Avg Duration', format: (v) => `${formatNumber(v, 0)}d`, positive: null, tooltip: 'Average holding period per trade in days.' },
  market_exposure: { label: 'Exposure', format: formatPercent, positive: null, tooltip: 'Percentage of time with an active position.' },
};
