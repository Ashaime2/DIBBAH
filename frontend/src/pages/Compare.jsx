import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import html2pdf from 'html2pdf.js';
import api from '../services/api';
import TimeSelector from '../components/TimeSelector';
import { formatPercent, formatRatio, formatNumber, classifyValue, KPI_DEFINITIONS, getQualityColor } from '../utils/formatters';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Compare() {
  const [strategies, setStrategies] = useState([]);
  const [ticker, setTicker] = useState('SPY');
  const [period, setPeriod] = useState('5y');
  const [interval, setInterval_] = useState('1d');
  const [dateMode, setDateMode] = useState('preset');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Array of strategy configs: { id: uniqueId, strategy_id: '', parameters: {} }
  const [configs, setConfigs] = useState([
    { id: '1', strategy_id: 'ma_crossover', parameters: {} }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    api.getStrategies().then(data => {
      setStrategies(data.strategies || []);
    }).catch(console.error);
  }, []);

  const addConfig = () => {
    if (configs.length >= 4) return;
    setConfigs([...configs, { id: Math.random().toString(), strategy_id: '', parameters: {} }]);
  };

  const removeConfig = (id) => {
    if (configs.length <= 1) return;
    setConfigs(configs.filter(c => c.id !== id));
  };

  const updateConfig = (id, field, value) => {
    setConfigs(configs.map(c => {
      if (c.id === id) {
        if (field === 'strategy_id') {
          // Initialize default parameters when selecting a strategy
          const strategyName = value;
          const strat = strategies.find(s => s.id === strategyName);
          const defaultParams = {};
          if (strat && strat.parameters) {
            strat.parameters.forEach(p => { defaultParams[p.name] = p.default; });
          }
          return { ...c, [field]: value, parameters: defaultParams };
        }
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const updateParameter = (configId, paramName, value) => {
    setConfigs(configs.map(c => {
      if (c.id === configId) {
        return { ...c, parameters: { ...c.parameters, [paramName]: value } };
      }
      return c;
    }));
  };

  const runComparison = async () => {
    if (!ticker) {
      setError("Please select a ticker");
      return;
    }
    const validConfigs = configs.filter(c => c.strategy_id);
    if (validConfigs.length === 0) {
      setError("Please select at least one strategy to compare");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const payload = {
        ticker,
        period: dateMode === 'preset' ? period : '5y',
        interval,
        start_date: dateMode !== 'preset' && startDate ? startDate : undefined,
        end_date: dateMode !== 'preset' && endDate ? endDate : undefined,
        strategy_configs: validConfigs.map(c => ({
          strategy_id: c.strategy_id,
          parameters: c.parameters
        })),
        initial_capital: 10000,
        commission: 0.001,
        slippage: 0.0005
      };
      
      const data = await api.compareStrategies(payload);
      setResults(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="page-container" id="compare-page">
      <div className="page-header">
        <h1 className="page-title">Multi-Strategy Comparison</h1>
        <p className="page-subtitle">Compare up to 4 strategies simultaneously on the same asset.</p>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--accent-red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Basic Settings */}
      <div className="panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Asset Ticker</label>
          <input 
            type="text" 
            value={ticker} 
            onChange={(e) => setTicker(e.target.value.toUpperCase())} 
            className="input-field" 
            style={{ width: '150px' }} 
            placeholder="e.g. SPY"
          />
        </div>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <TimeSelector 
            period={period} onPeriodChange={setPeriod}
            interval={interval} onIntervalChange={setInterval_}
            dateMode={dateMode} onDateModeChange={setDateMode}
            startDate={startDate} onStartDateChange={setStartDate}
            endDate={endDate} onEndDateChange={setEndDate}
          />
        </div>
        
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={runComparison} disabled={loading || !ticker}>
            {loading ? 'Running...' : 'Run Comparison'}
          </button>
        </div>
      </div>

      {/* Strategies Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <AnimatePresence>
          {configs.map((config, index) => (
            <motion.div 
              key={config.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card" 
              style={{ position: 'relative', borderTop: `4px solid ${CHART_COLORS[index % CHART_COLORS.length]}` }}
            >
              {configs.length > 1 && (
                <button 
                  onClick={() => removeConfig(config.id)}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                >×</button>
              )}
              
              <div style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase' }}>
                  Contender #{index + 1}
                </div>
                
                <select 
                  className="input-field" 
                  value={config.strategy_id} 
                  onChange={(e) => updateConfig(config.id, 'strategy_id', e.target.value)}
                  style={{ width: '100%', marginBottom: '1rem' }}
                >
                  <option value="" disabled style={{ background: 'var(--bg-input)' }}>Select a strategy</option>
                  {strategies.map(s => <option key={s.id} value={s.id} style={{ background: 'var(--bg-input)' }}>{s.name}</option>)}
                </select>

                {/* Parameters Editor */}
                {config.strategy_id && (
                  <div style={{ marginTop: '1rem' }}>
                    {strategies.find(s => s.id === config.strategy_id)?.parameters?.map(p => (
                      <div key={p.name} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{config.parameters[p.name]}</span>
                        </div>
                        <input
                          type="range"
                          min={p.min} max={p.max} step={p.step}
                          value={config.parameters[p.name] !== undefined ? config.parameters[p.name] : p.default}
                          onChange={(e) => updateParameter(config.id, p.name, Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    ))}
                    {strategies.find(s => s.id === config.strategy_id)?.parameters?.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No parameters</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {configs.length < 4 && (
            <motion.button 
              onClick={addConfig}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="card" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', background: 'rgba(59,130,246,0.02)', border: '1px dashed var(--border-primary)', color: 'var(--accent-blue)', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>+</div>
              <div>Add Strategy</div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Results View */}
      {results && !loading && (
        <CompareResultsView results={results.results} ranking={results.ranking} ticker={ticker} />
      )}
    </div>
  );
}

/* ── Compare Results View ── */
function CompareResultsView({ results, ranking, ticker }) {
  // Extract benchmark from the first result to plot it alongside
  const firstResult = results[0];
  const benchmarkValues = firstResult.equity_curve.benchmark_value;
  const initialBenchmark = benchmarkValues[0] || 1;

  // Build combined chart data
  const chartData = firstResult.equity_curve.dates.map((d, i) => {
    const point = { date: d, "Buy & Hold": ((benchmarkValues[i] / initialBenchmark - 1) * 100) };
    results.forEach((r, idx) => {
      const initialPortfolio = r.equity_curve.portfolio_value[0] || 1;
      // Define a custom name combining strategy + its index to be unique
      const name = `${r.strategy_name} (${idx+1})`;
      point[name] = ((r.equity_curve.portfolio_value[i] / initialPortfolio - 1) * 100);
    });
    return point;
  }).filter((_, i) => i % Math.max(1, Math.floor(firstResult.equity_curve.dates.length / 600)) === 0);

  // Group metrics for the comparison table
  const metrics = [
    { label: 'Total Return', key: 'total_return', fmt: formatPercent },
    { label: 'Sharpe Ratio', key: 'sharpe_ratio', fmt: formatRatio },
    { label: 'Max Drawdown', key: 'max_drawdown', fmt: formatPercent },
    { label: 'Win Rate', key: 'win_rate', fmt: formatPercent },
    { label: 'Total Trades', key: 'total_trades', fmt: formatNumber },
    { label: 'Profit Factor', key: 'profit_factor', fmt: formatRatio },
  ];

  // Build Radar Data
  const radarData = [
    { subject: 'Profitability', fullMark: 100 },
    { subject: 'Consistency', fullMark: 100 },
    { subject: 'Risk Mgmt', fullMark: 100 },
    { subject: 'Win Rate', fullMark: 100 },
  ];

  // Fill in radar values for each strategy
  // Define helper scoring caps
  const calcScore = (val, maxVal) => Math.min(100, Math.max(0, (val / maxVal) * 100));
  
  results.forEach((r, idx) => {
    const name = `${r.strategy_name} (${idx+1})`;
    const kpis = r.kpis;
    radarData[0][name] = calcScore(kpis.annualized_return, 30); // scale: 0 to 30%
    radarData[1][name] = calcScore(kpis.sharpe_ratio, 2.5); // scale: 0 to 2.5
    radarData[2][name] = calcScore(1 - (Math.abs(kpis.max_drawdown)/100), 1); // 1 = 0% drawdown, 0 = 100% drawdown
    radarData[3][name] = calcScore(kpis.win_rate, 100); 
  });

  const contentRef = useRef(null);

  const exportPDF = () => {
    if (!contentRef.current) return;
    const opt = {
      margin: 0.5,
      filename: `Comparison_Report_${ticker}_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().from(contentRef.current).set(opt).save();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {/* Top Bar for Results */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={exportPDF} className="btn" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📄</span> Export to PDF
        </button>
      </div>

      <div ref={contentRef} style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px' }}>
        {/* Chart */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Comparative Equity Curve: {ticker}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
            <XAxis dataKey="date" tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a2a4a' }} interval={Math.floor(chartData.length / 6)} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip 
              contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }}
              itemStyle={{ fontSize: '0.82rem' }}
              formatter={(v) => `${v.toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ fontSize: '0.82rem', paddingTop: '1rem' }} />
            
            <Line type="monotone" dataKey="Buy & Hold" stroke="#5a6a88" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            {results.map((r, i) => {
              const name = `${r.strategy_name} (${i+1})`;
              return <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two columns: Leaderboard and Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem' }}>
        {/* Rankings */}
        <div className="panel">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Leaderboard</h3>
          {ranking.by_return && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>🏆 Best Return</div>
              {ranking.by_return.slice(0, 3).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: i === 0 ? 'rgba(59,130,246,0.1)' : 'transparent', borderRadius: '4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.9rem' }}>#{r.rank} {r.strategy}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{formatPercent(r.value)}</span>
                </div>
              ))}
            </div>
          )}
          {ranking.by_sharpe && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>⚖️ Best Sharpe Ratio</div>
              {ranking.by_sharpe.slice(0, 3).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: i === 0 ? 'rgba(139,92,246,0.1)' : 'transparent', borderRadius: '4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.9rem' }}>#{r.rank} {r.strategy}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatRatio(r.value)}</span>
                </div>
              ))}
            </div>
          )}
          {ranking.by_drawdown && (
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>🛡️ Safest (Drawdown)</div>
              {ranking.by_drawdown.slice(0, 3).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: i === 0 ? 'rgba(16,185,129,0.1)' : 'transparent', borderRadius: '4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.9rem' }}>#{r.rank} {r.strategy}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>{formatPercent(r.value)}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Strategy DNA Radar */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Strategy DNA</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(26,42,74,0.5)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#8899bb', fontSize: '0.8rem' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }} />
                {results.map((r, i) => {
                  const name = `${r.strategy_name} (${i+1})`;
                  return (
                    <Radar key={name} name={name} dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
                  );
                })}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="card" style={{ overflowX: 'auto', alignSelf: 'start' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: '120px' }}>Metric</th>
                {results.map((r, i) => (
                  <th key={i} style={{ padding: '1rem', color: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {r.strategy_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                // Find best value in row for highlighting
                const values = results.map(r => r.kpis[m.key] !== null ? r.kpis[m.key] : -Infinity);
                const isDrawdown = m.key === 'max_drawdown';
                // For drawdown, "best" is maximum (since it's negative numbers, closer to 0 is max)
                const bestValue = isDrawdown ? Math.max(...values) : Math.max(...values);
                
                return (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</td>
                    {results.map((r, i) => {
                      const val = r.kpis[m.key];
                      const isBest = val === bestValue && val !== null;
                      return (
                        <td key={i} style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: isBest ? 700 : 400,
                          background: isBest ? 'rgba(59,130,246,0.05)' : 'transparent',
                          color: isBest && KPI_DEFINITIONS[m.key]?.positive !== null ? 
                            (KPI_DEFINITIONS[m.key].positive ? 'var(--accent-green)' : (val < 0 ? 'var(--accent-red)' : 'var(--text-primary)')) 
                            : 'var(--text-primary)'
                        }}>
                          {m.fmt(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </motion.div>
  );
}
