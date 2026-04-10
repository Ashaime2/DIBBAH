import { motion } from 'framer-motion';

const sections = [
  {
    title: 'Execution Model',
    icon: '⚙️',
    content: [
      'Signals are generated at the close of each bar based on available data up to that point.',
      'Orders are executed at the close price of the signal bar, with slippage applied.',
      'No look-ahead bias: the engine strictly uses information available at time T to make decisions at time T.',
      'Partial fills are not modeled — orders are filled completely or not at all.',
    ],
  },
  {
    title: 'Transaction Costs',
    icon: '💰',
    content: [
      'Commission: configurable as a percentage of trade value (default: 0.1%).',
      'Slippage: modeled as additional cost on entry and exit (default: 0.05%).',
      'These are applied to both buy and sell orders symmetrically.',
      'Stress tests allow multiplying these costs to evaluate fee sensitivity.',
    ],
  },
  {
    title: 'Position Management',
    icon: '📐',
    content: [
      'Single position at a time (one asset, fully invested or flat).',
      'Position sizing is configurable as a fraction of current capital.',
      'No leverage or short selling in the base model.',
      'Cash earns no return when not invested.',
    ],
  },
  {
    title: 'Data Pipeline',
    icon: '📊',
    content: [
      'Market data sourced from Yahoo Finance via yfinance library.',
      'Data is cleaned: missing values removed, dates harmonized, outliers detected.',
      'All prices are adjusted for stock splits and dividends.',
      'Data quality is assessed and reported before any analysis.',
      'Results cached locally to minimize API calls and improve responsiveness.',
    ],
  },
  {
    title: 'Performance Metrics',
    icon: '📈',
    content: [
      'Sharpe Ratio: annualized return divided by annualized volatility (risk-free rate = 0).',
      'Sortino Ratio: like Sharpe but only considers downside volatility.',
      'Max Drawdown: largest peak-to-trough decline in portfolio value.',
      'Calmar Ratio: annualized return divided by maximum drawdown.',
      'Win Rate: percentage of trades that ended with positive P&L.',
      'Profit Factor: gross profits divided by gross losses.',
    ],
  },
  {
    title: 'Robustness Analysis',
    icon: '🔬',
    content: [
      'Train/Test Split: separates data into in-sample (calibration) and out-of-sample (validation) periods.',
      'Stress Testing: evaluates performance under degraded conditions (higher fees, slippage).',
      'Parameter Sensitivity: measures how results change when strategy parameters are varied.',
      'Overfitting detection: flags when in-sample performance vastly exceeds out-of-sample.',
    ],
  },
  {
    title: 'Known Limitations',
    icon: '⚠️',
    content: [
      'No intraday execution modeling — trades execute at daily close prices.',
      'Market impact is not modeled (assumes infinite liquidity).',
      'Tax implications are not considered.',
      'Multi-asset portfolio effects (correlation, diversification) are not in the base engine.',
      'Past performance does not guarantee future results — this is a research and educational tool.',
    ],
  },
];

export default function Methodology() {
  return (
    <div className="page-container" id="methodology-page" style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Methodology</h1>
        <p className="page-subtitle">
          How DIBBAH calculates backtests, the assumptions behind the results, and the known limitations of the model.
        </p>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <p>
          DIBBAH is designed for <strong style={{ color: 'var(--text-primary)' }}>critical evaluation of trading strategies</strong>, not for generating optimistic forecasts. 
          Every design decision prioritizes honesty over flattering results. 
          Transaction costs, execution delays, and statistical rigor are baked into the core engine.
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          Transparency is paramount: this page documents exactly how each calculation works, 
          what assumptions are made, and where the model's limitations lie.
        </p>
      </div>

      {sections.map((section, i) => (
        <motion.div
          key={i}
          className="card"
          style={{ marginBottom: '1rem', padding: '1.5rem' }}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{section.icon}</span> {section.title}
          </h2>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {section.content.map((item, j) => (
              <li key={j} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      ))}

      <div style={{
        textAlign: 'center',
        padding: '3rem 1rem',
        color: 'var(--text-muted)',
        fontSize: '0.88rem',
      }}>
        <p><strong style={{ color: 'var(--text-secondary)' }}>Disclaimer:</strong> DIBBAH is an educational and research tool.</p>
        <p>Past performance does not predict future results. Do not use this tool as the sole basis for investment decisions.</p>
      </div>
    </div>
  );
}
