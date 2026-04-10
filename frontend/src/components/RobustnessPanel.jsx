import { useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import api from '../services/api';
import { formatPercent, formatRatio } from '../utils/formatters';

/* ══════════════════════════════════════════════════════════════
   ROBUSTNESS PANEL — Phase 2 + Phase 3 analyses
   ══════════════════════════════════════════════════════════════ */

export default function RobustnessPanel({ ticker, strategyId, parameters, period, portfolioConfig }) {
  const [activeTest, setActiveTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});

  const tests = [
    { key: 'stress', icon: '💰', label: 'Fee Stress Test', desc: 'Does your alpha survive real-world costs?' },
    { key: 'sensitivity', icon: '🌡️', label: 'Parameter Sensitivity', desc: 'Lucky pick or stable plateau?' },
    { key: 'stability', icon: '🔀', label: 'Temporal Stability', desc: 'Consistent across time periods?' },
    { key: 'walkforward', icon: '🔄', label: 'Walk-Forward', desc: 'Performance across rolling windows' },
    { key: 'montecarlo', icon: '🎲', label: 'Monte Carlo', desc: 'Statistical distribution of outcomes' },
  ];

  const runTest = async (testKey) => {
    if (results[testKey]) { setActiveTest(testKey); return; }
    setActiveTest(testKey);
    setLoading(true);
    try {
      let data;
      const baseConfig = {
        ticker, strategy_id: strategyId, parameters, period,
        initial_capital: portfolioConfig.initial_capital,
        commission: portfolioConfig.commission, slippage: portfolioConfig.slippage,
      };

      if (testKey === 'stress') {
        data = await api.runStressTest({ ...baseConfig, fee_multipliers: [1, 2, 3, 5, 10], slippage_multipliers: [1, 2, 5, 10] });
      } else if (testKey === 'sensitivity') {
        const paramKeys = Object.keys(parameters);
        const paramName = paramKeys[0];
        const val = parameters[paramName];
        if (typeof val === 'number' && val > 0) {
          const range = [...new Set(Array.from({ length: 14 }, (_, i) => Math.round(val * (0.2 + i * 0.2))).filter(v => v > 0))].sort((a, b) => a - b);
          data = await api.runSensitivity({ ...baseConfig, param_name: paramName, param_range: range, base_parameters: parameters });
        }
      } else if (testKey === 'stability') {
        data = await api.runTrainTest({ ...baseConfig, train_ratio: 0.7 });
      } else if (testKey === 'walkforward') {
        data = await api.runWalkForward({ ...baseConfig, n_windows: 5 });
      } else if (testKey === 'montecarlo') {
        data = await api.runMonteCarlo({ ...baseConfig, n_simulations: 1000 });
      }
      setResults(prev => ({ ...prev, [testKey]: data }));
    } catch (e) {
      setResults(prev => ({ ...prev, [testKey]: { error: e.message } }));
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {tests.map(t => (
          <button key={t.key} onClick={() => runTest(t.key)}
            style={{
              textAlign: 'left', cursor: 'pointer',
              border: activeTest === t.key ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
              background: activeTest === t.key ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
              padding: '1rem', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sans)',
            }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>{t.icon} {t.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-accent)' }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-container" style={{ padding: '3rem' }}>
          <div className="spinner" />
          <span>Running analysis...</span>
        </div>
      )}

      {!loading && activeTest === 'stress' && results.stress && <StressTestResults data={results.stress} />}
      {!loading && activeTest === 'sensitivity' && results.sensitivity && <SensitivityResults data={results.sensitivity} currentValue={parameters[results.sensitivity.param_name]} />}
      {!loading && activeTest === 'stability' && results.stability && <StabilityResults data={results.stability} />}
      {!loading && activeTest === 'walkforward' && results.walkforward && <WalkForwardResults data={results.walkforward} />}
      {!loading && activeTest === 'montecarlo' && results.montecarlo && <MonteCarloResults data={results.montecarlo} />}
    </div>
  );
}


/* ── Stress Test ── */
function StressTestResults({ data }) {
  if (data.error) return <ErrorCard message={data.error} />;
  const scenarios = data.scenarios || [];
  const feeScenarios = scenarios.filter(s => s.type === 'fee');
  const breakEvenFee = feeScenarios.find(s => s.kpis.total_return <= 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <VerdictCard label="Fee Resilience"
        verdict={breakEvenFee ? `Breaks at ${breakEvenFee.scenario}` : 'Survives all scenarios ✓'}
        positive={!breakEvenFee} />

      <div className="chart-container" style={{ minHeight: 280, marginBottom: '1rem' }}>
        <div className="chart-header"><div className="chart-title">Return vs Fee Multiplier</div></div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={feeScenarios.map(s => ({ name: s.scenario, return: s.kpis.total_return }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="name" tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v.toFixed(2)}%`, 'Return']} />
            <ReferenceLine y={0} stroke="#5a6a88" strokeDasharray="3 3" />
            <Bar dataKey="return" radius={[4, 4, 0, 0]}>
              {feeScenarios.map((s, i) => <Cell key={i} fill={s.kpis.total_return >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Scenario</th><th>Return</th><th>Sharpe</th><th>Max DD</th><th>Win Rate</th></tr></thead>
          <tbody>
            {scenarios.map((s, i) => (
              <tr key={i}>
                <td>{s.scenario}</td>
                <td className={s.kpis.total_return >= 0 ? 'positive' : 'negative'}>{formatPercent(s.kpis.total_return)}</td>
                <td>{formatRatio(s.kpis.sharpe_ratio)}</td>
                <td className="negative">{formatPercent(s.kpis.max_drawdown)}</td>
                <td>{formatPercent(s.kpis.win_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}


/* ── Sensitivity ── */
function SensitivityResults({ data, currentValue }) {
  if (data.error) return <ErrorCard message={data.error} />;
  const results = data.results || [];
  const paramName = data.param_name;
  const positiveCount = results.filter(r => r.sharpe_ratio > 0).length;
  const plateauRatio = positiveCount / results.length;
  const isRobust = plateauRatio > 0.5;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <VerdictCard label={`Parameter Robustness — ${paramName}`}
        verdict={isRobust ? `Stable plateau (${Math.round(plateauRatio * 100)}% positive) ✓` : `Fragile — only ${Math.round(plateauRatio * 100)}% values work`}
        positive={isRobust} />

      <div className="chart-container" style={{ minHeight: 280, marginBottom: '1rem' }}>
        <div className="chart-header"><div className="chart-title">Sharpe Ratio by {paramName}</div></div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={results.map(r => ({ value: r.param_value, sharpe: r.sharpe_ratio }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="value" tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v.toFixed(3), 'Sharpe']} />
            <ReferenceLine y={0} stroke="#5a6a88" strokeDasharray="3 3" />
            <Bar dataKey="sharpe" radius={[4, 4, 0, 0]}>
              {results.map((r, i) => <Cell key={i} fill={r.param_value === currentValue ? '#3b82f6' : r.sharpe_ratio > 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container" style={{ minHeight: 280 }}>
        <div className="chart-header"><div className="chart-title">Total Return by {paramName}</div></div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={results.map(r => ({ value: r.param_value, return: r.total_return }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="value" tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v.toFixed(2)}%`, 'Return']} />
            <Line type="monotone" dataKey="return" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}


/* ── Stability (Train/Test) ── */
function StabilityResults({ data }) {
  if (data.error) return <ErrorCard message={data.error} />;
  const { train, test, warnings, performance_drop } = data;
  const degradation = Math.abs(performance_drop || 0);
  const verdict = degradation < 30 ? 'robust' : degradation < 60 ? 'fragile' : 'unstable';

  const metrics = [
    { label: 'Total Return', key: 'total_return', fmt: formatPercent },
    { label: 'Sharpe Ratio', key: 'sharpe_ratio', fmt: formatRatio },
    { label: 'Max Drawdown', key: 'max_drawdown', fmt: formatPercent },
    { label: 'Win Rate', key: 'win_rate', fmt: formatPercent },
    { label: 'Profit Factor', key: 'profit_factor', fmt: formatRatio },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <VerdictCard label="Temporal Stability"
        verdict={verdict === 'robust' ? '✓ Stable across periods' : verdict === 'fragile' ? '⚠ Fragile — performance degrades' : '✗ Unstable — likely regime-dependent'}
        positive={verdict === 'robust'}
        subtitle={`Performance degradation: ${degradation.toFixed(1)}%`} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {[{ data: train, title: '📘 First Period (70%)', color: 'var(--accent-blue)' }, { data: test, title: '📙 Second Period (30%)', color: 'var(--accent-purple)' }].map(panel => (
          <div className="panel" key={panel.title}>
            <div className="panel-title" style={{ color: panel.color }}>{panel.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{panel.data.period}</div>
            {metrics.map(m => (
              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>{m.fmt(panel.data.kpis[m.key])}</span>
              </div>
            ))}
            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{panel.data.trades} trades</div>
          </div>
        ))}
      </div>

      {warnings?.length > 0 && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-red)' }}>⚠ Warnings</div>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {warnings.map((w, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{w}</li>)}
          </ul>
        </div>
      )}
    </motion.div>
  );
}


/* ── Walk-Forward ── */
function WalkForwardResults({ data }) {
  if (data.error) return <ErrorCard message={data.error} />;
  const { windows, consistency, avg_return, std_return, avg_sharpe } = data;
  const isConsistent = consistency >= 60;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <VerdictCard label="Walk-Forward Consistency"
        verdict={isConsistent ? `${consistency}% of windows profitable ✓` : `Only ${consistency}% profitable — inconsistent`}
        positive={isConsistent}
        subtitle={`Avg return: ${avg_return.toFixed(1)}% ± ${std_return.toFixed(1)}% | Avg Sharpe: ${avg_sharpe.toFixed(3)}`} />

      <div className="chart-container" style={{ minHeight: 280, marginBottom: '1rem' }}>
        <div className="chart-header"><div className="chart-title">Return per Window</div></div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={windows.map(w => ({ name: `W${w.window}`, return: w.kpis.total_return, sharpe: w.kpis.sharpe_ratio, period: w.period }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="name" tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v, name) => [name === 'return' ? `${v.toFixed(2)}%` : v.toFixed(3), name === 'return' ? 'Return' : 'Sharpe']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.period || ''} />
            <ReferenceLine y={0} stroke="#5a6a88" strokeDasharray="3 3" />
            <Bar dataKey="return" radius={[4, 4, 0, 0]}>
              {windows.map((w, i) => <Cell key={i} fill={w.kpis.total_return >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Window</th><th>Period</th><th>Return</th><th>Sharpe</th><th>Max DD</th><th>Trades</th></tr></thead>
          <tbody>
            {windows.map(w => (
              <tr key={w.window}>
                <td>W{w.window}</td>
                <td style={{ fontSize: '0.78rem' }}>{w.period}</td>
                <td className={w.kpis.total_return >= 0 ? 'positive' : 'negative'}>{formatPercent(w.kpis.total_return)}</td>
                <td>{formatRatio(w.kpis.sharpe_ratio)}</td>
                <td className="negative">{formatPercent(w.kpis.max_drawdown)}</td>
                <td>{w.trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}


/* ── Monte Carlo ── */
function MonteCarloResults({ data }) {
  if (data.error) return <ErrorCard message={data.error} />;
  const { percentiles, actual_return, probability_positive, actual_rank_percentile, histogram, n_simulations, n_trades, mean_return, std_return, median_max_drawdown } = data;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <VerdictCard label={`Monte Carlo — ${n_simulations.toLocaleString()} simulations × ${n_trades} trades`}
        verdict={`${probability_positive}% chance of positive return`}
        positive={probability_positive >= 60}
        subtitle={`Your result (${actual_return.toFixed(1)}%) ranks in the ${actual_rank_percentile.toFixed(0)}th percentile`} />

      {/* Distribution histogram */}
      <div className="chart-container" style={{ minHeight: 300, marginBottom: '1rem' }}>
        <div className="chart-header"><div className="chart-title">Return Distribution</div></div>
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={histogram.map(h => ({ range: `${h.bin_start.toFixed(0)}`, count: h.count, mid: (h.bin_start + h.bin_end) / 2 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="range" tick={{ fill: '#5a6a88', fontSize: 10 }} interval={2} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Simulations']} labelFormatter={l => `~${l}% return`} />
            <ReferenceLine x={histogram.findIndex(h => h.bin_start <= actual_return && h.bin_end > actual_return)} stroke="#3b82f6" strokeWidth={2} label={{ value: 'Yours', fill: '#3b82f6', fontSize: 11 }} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {histogram.map((h, i) => <Cell key={i} fill={h.mid >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Percentiles card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { label: 'Worst case (5%)', value: percentiles.p5 },
          { label: '25th pctl', value: percentiles.p25 },
          { label: 'Median', value: percentiles.p50 },
          { label: '75th pctl', value: percentiles.p75 },
          { label: 'Best case (95%)', value: percentiles.p95 },
        ].map(p => (
          <div key={p.label} className="kpi-card">
            <div className="kpi-label">{p.label}</div>
            <div className={`kpi-value ${p.value >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.1rem' }}>
              {p.value >= 0 ? '+' : ''}{p.value.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <div className="kpi-card">
          <div className="kpi-label">Mean Return</div>
          <div className="kpi-value">{mean_return >= 0 ? '+' : ''}{mean_return.toFixed(1)}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Std Dev</div>
          <div className="kpi-value">±{std_return.toFixed(1)}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Median Max DD</div>
          <div className="kpi-value negative">{median_max_drawdown.toFixed(1)}%</div>
        </div>
      </div>
    </motion.div>
  );
}


/* ── Shared Components ── */
const tooltipStyle = { background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' };

function VerdictCard({ label, verdict, positive, subtitle }) {
  return (
    <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: positive ? 'var(--accent-green)' : 'var(--accent-red)' }}>
        {verdict}
      </div>
      {subtitle && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>{subtitle}</div>}
    </div>
  );
}

function ErrorCard({ message }) {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-red)' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠</div>
      <div>{message}</div>
    </div>
  );
}
