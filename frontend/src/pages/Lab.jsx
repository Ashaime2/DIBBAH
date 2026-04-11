import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import api from '../services/api';
import { formatPercent, formatCurrency, formatRatio, formatNumber, classifyValue, KPI_DEFINITIONS, getQualityColor } from '../utils/formatters';
import RobustnessPanel from '../components/RobustnessPanel';
import StrategyBuilder from '../components/StrategyBuilder';
import TimeSelector from '../components/TimeSelector';

/* ══════════════════════════════════════════════════════════════
   LAB PAGE — Main Backtesting Interface
   ══════════════════════════════════════════════════════════════ */

export default function Lab() {
  // State
  const [step, setStep] = useState('select'); // select | configure | results
  const [ticker, setTicker] = useState('');
  const [tickerName, setTickerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [period, setPeriod] = useState('5y');
  const [interval, setInterval_] = useState('1d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateMode, setDateMode] = useState('preset'); // 'preset' | 'custom'
  const [marketData, setMarketData] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [parameters, setParameters] = useState({});
  const [portfolioConfig, setPortfolioConfig] = useState({
    initial_capital: 10000,
    commission: 0.001,
    slippage: 0.0005,
    position_size: 1.0,
  });
  const [backtestResult, setBacktestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('performance');
  const searchTimeout = useRef(null);

  // Load strategies on mount
  useEffect(() => {
    api.getStrategies().then(data => {
      setStrategies(data.strategies || []);
    }).catch(() => {});
  }, []);

  // Search tickers
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 1) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(() => {
      api.searchTickers(query).then(data => {
        setSearchResults(data.results || []);
      }).catch(() => {});
    }, 200);
  }, []);

  // Select ticker
  const selectTicker = async (t) => {
    setTicker(t.ticker);
    setTickerName(t.name);
    setSearchQuery(t.ticker);
    setSearchResults([]);
    setError(null);
    setLoading(true);
    try {
      const data = await api.getMarketData(t.ticker, period, interval, startDate || null, endDate || null);
      setMarketData(data.data);
      setDataQuality(data.quality);
      setStep('configure');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Select strategy
  const selectStrategy = (s) => {
    setSelectedStrategy(s);
    const defaults = {};
    (s.parameters || []).forEach(p => { defaults[p.name] = p.default; });
    setParameters(defaults);
  };

  // Run backtest (reusable for period changes)
  const runBacktest = async (overridePeriod) => {
    if (!selectedStrategy || !ticker) return;
    const usePeriod = overridePeriod || period;
    setLoading(true);
    setError(null);
    try {
      const result = await api.runBacktest({
        ticker,
        strategy_id: selectedStrategy.id,
        parameters,
        period: usePeriod,
        interval: interval,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        ...portfolioConfig,
      });
      setBacktestResult(result);
      setStep('results');
      setActiveTab('performance');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Change period and re-run backtest (used from results view)
  const changePeriodAndRerun = async (newPeriod) => {
    setPeriod(newPeriod);
    await runBacktest(newPeriod);
  };

  return (
    <div className="page-container" id="lab-page">
      <div className="page-header">
        <h1 className="page-title">Do I Beat Buy & Hold?</h1>
        <p className="page-subtitle">Select an asset, configure a strategy, and find out.</p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} onStep={setStep} hasResult={!!backtestResult} />

      {error && (
        <div style={{ padding: '1rem', background: 'var(--accent-red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* ── Step 1: Select Asset ── */}
      {step === 'select' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <AssetSelector
            searchQuery={searchQuery}
            onSearch={handleSearch}
            searchResults={searchResults}
            onSelect={selectTicker}
            period={period}
            onPeriodChange={setPeriod}
            interval={interval}
            onIntervalChange={setInterval_}
            dateMode={dateMode}
            onDateModeChange={setDateMode}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            loading={loading}
          />
        </motion.div>
      )}

      {/* ── Step 2: Configure Strategy ── */}
      {step === 'configure' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ConfigureStep
            ticker={ticker}
            tickerName={tickerName}
            dataQuality={dataQuality}
            marketData={marketData}
            strategies={strategies}
            selectedStrategy={selectedStrategy}
            onSelectStrategy={selectStrategy}
            parameters={parameters}
            onParamChange={(name, val) => setParameters({ ...parameters, [name]: val })}
            portfolioConfig={portfolioConfig}
            onPortfolioChange={setPortfolioConfig}
            onRun={() => runBacktest()}
            loading={loading}
          />
        </motion.div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 'results' && backtestResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ResultsView
            result={backtestResult}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            period={period}
            onPeriodChange={changePeriodAndRerun}
            loading={loading}
            ticker={ticker}
            strategyId={selectedStrategy?.id}
            parameters={parameters}
            portfolioConfig={portfolioConfig}
          />
        </motion.div>
      )}
    </div>
  );
}


/* ── Step Indicator ── */
function StepIndicator({ current, onStep, hasResult }) {
  const steps = [
    { key: 'select', label: 'Select Asset', num: 1 },
    { key: 'configure', label: 'Configure Strategy', num: 2 },
    { key: 'results', label: 'The Verdict', num: 3 },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
      {steps.map((s, i) => {
        const isActive = s.key === current;
        const isDone = steps.findIndex(x => x.key === current) > i;
        const clickable = (isDone || (s.key === 'results' && hasResult));

        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {i > 0 && <div style={{ width: 40, height: 1, background: isDone ? 'var(--accent-blue)' : 'var(--border-primary)' }} />}
            <button
              onClick={() => clickable && onStep(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'none', border: 'none', cursor: clickable ? 'pointer' : 'default',
                color: isActive ? 'var(--accent-blue)' : isDone ? 'var(--accent-green)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)', fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                background: isActive ? 'rgba(59,130,246,0.15)' : isDone ? 'rgba(16,185,129,0.15)' : 'rgba(90,106,136,0.1)',
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : isDone ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                color: isActive ? 'var(--accent-blue)' : isDone ? 'var(--accent-green)' : 'var(--text-muted)',
              }}>
                {isDone ? '✓' : s.num}
              </span>
              {s.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}


/* ── Asset Selector ── */
function AssetSelector({ searchQuery, onSearch, searchResults, onSelect, period, onPeriodChange, interval, onIntervalChange, dateMode, onDateModeChange, startDate, onStartDateChange, endDate, onEndDateChange, loading }) {

  const SCENARIOS = [
    { label: "Dotcom Bubble", start: "2000-01-01", end: "2002-12-31", desc: "Tech crash & Bear market" },
    { label: "2008 Financial Crisis", start: "2007-10-01", end: "2009-03-31", desc: "Subprime mortgage drop" },
    { label: "COVID-19 Crash", start: "2020-02-15", end: "2020-04-15", desc: "Global pandemic panic" },
    { label: "Post-Covid Bull", start: "2020-04-16", end: "2021-12-31", desc: "ZIRP & Tech rally" },
    { label: "2022 Bear Market", start: "2022-01-01", end: "2022-12-31", desc: "Inflation & rate hikes" },
  ];

  const CATEGORIES = [
    {
      name: "Market Indices",
      assets: [
        { ticker: 'SPY', name: 'S&P 500 ETF', type: 'ETF' },
        { ticker: 'QQQ', name: 'NASDAQ 100 ETF', type: 'ETF' },
        { ticker: '^DJI', name: 'Dow Jones', type: 'Index' },
        { ticker: 'IWM', name: 'Russell 2000', type: 'ETF' }
      ]
    },
    {
      name: "Big Tech",
      assets: [
        { ticker: 'AAPL', name: 'Apple Inc.', type: 'Stock' },
        { ticker: 'MSFT', name: 'Microsoft', type: 'Stock' },
        { ticker: 'NVDA', name: 'NVIDIA', type: 'Stock' },
        { ticker: 'TSLA', name: 'Tesla Inc.', type: 'Stock' }
      ]
    },
    {
      name: "Crypto & Forex",
      assets: [
        { ticker: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' },
        { ticker: 'ETH-USD', name: 'Ethereum', type: 'Crypto' },
        { ticker: 'EURUSD=X', name: 'EUR / USD', type: 'Forex' }
      ]
    },
    {
      name: "Commodities & Bonds",
      assets: [
        { ticker: 'GLD', name: 'Gold ETF', type: 'ETF' },
        { ticker: 'USO', name: 'Oil ETF', type: 'ETF' },
        { ticker: 'TLT', name: '20+ Yr Treasury', type: 'ETF' }
      ]
    }
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" style={{ marginRight: 8, verticalAlign: -3 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Search Asset
        </h2>

        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search by ticker or company name... (e.g. AAPL, SPY, Bitcoin)"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            id="ticker-search"
            style={{ fontSize: '1rem', padding: '0.85rem 1.25rem' }}
          />
        </div>

        {searchResults.length > 0 && (
          <div style={{
            border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
            maxHeight: 200, overflowY: 'auto', marginBottom: '1rem',
          }}>
            {searchResults.map(r => (
              <div key={r.ticker} onClick={() => onSelect(r)}
                style={{
                  padding: '0.65rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--border-primary)', transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, marginRight: 8 }}>{r.ticker}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{r.name}</span>
                </div>
                <span className={`badge badge-${r.type === 'Crypto' ? 'purple' : r.type === 'ETF' ? 'blue' : 'green'}`}>
                  {r.type}
                </span>
              </div>
            ))}
          </div>
        )}

        <TimeSelector 
          period={period} onPeriodChange={onPeriodChange}
          interval={interval} onIntervalChange={onIntervalChange}
          dateMode={dateMode} onDateModeChange={onDateModeChange}
          startDate={startDate} onStartDateChange={onStartDateChange}
          endDate={endDate} onEndDateChange={onEndDateChange}
        />

        <div className="section-divider" />

        <div style={{ marginTop: '0.5rem' }}>
          <div className="panel-title" style={{ marginBottom: '1.5rem' }}>Asset Universe</div>
          
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {CATEGORIES.map(category => (
              <div key={category.name}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  {category.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {category.assets.map(p => (
                    <button key={p.ticker} className="btn btn-ghost btn-sm" onClick={() => onSelect(p)}
                      style={{ 
                        justifyContent: 'flex-start', textAlign: 'left', 
                        border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-primary)'
                      }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.ticker}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{p.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container" style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: '1rem' }}>
            <span>Running backtest...</span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
              This may take few minutes or even crash : I'm too broke to pay actual servers
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   CONFIGURE STEP — Reorganized layout:
   Top: chart full-width
   Bottom: data panel + strategies grid + params/portfolio
   ══════════════════════════════════════════════════════════════ */

function ConfigureStep({ ticker, tickerName, dataQuality, marketData, strategies, selectedStrategy, onSelectStrategy, parameters, onParamChange, portfolioConfig, onPortfolioChange, onRun, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top row: Data info + Chart side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        <DataPanel ticker={ticker} name={tickerName} quality={dataQuality} />
        {marketData && <PricePreviewChart data={marketData} ticker={ticker} />}
      </div>

      {/* Strategy picker — horizontal grid */}
      <div className="panel">
        <div className="panel-title">Choose a Strategy</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {strategies.map(s => (
            <div
              key={s.id}
              className={`strategy-card ${selectedStrategy?.id === s.id ? 'selected' : ''}`}
              onClick={() => onSelectStrategy(s)}
              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
            >
              <div className="strategy-name" style={{ fontSize: '0.88rem' }}>{s.name}</div>
              <div className="strategy-desc" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>{s.description}</div>
              <div className="strategy-tags">
                {(s.tags || []).map(t => <span key={t} className="strategy-tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row: Parameters + Portfolio + Run button */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedStrategy && selectedStrategy.parameters.length > 0 ? '1fr 1fr auto' : '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
        {/* Parameters */}
        {selectedStrategy && selectedStrategy.id === 'custom_builder' ? (
          <div className="panel" style={{ padding: '0.5rem' }}>
            <StrategyBuilder 
              value={parameters.rules || {}}
              onChange={(val) => onParamChange('rules', val)}
            />
          </div>
        ) : selectedStrategy && selectedStrategy.parameters.length > 0 ? (
          <div className="panel">
            <div className="panel-title">Parameters — {selectedStrategy.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: selectedStrategy.parameters.length > 2 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
              {selectedStrategy.parameters.map(p => (
                <ParameterControl
                  key={p.name}
                  param={p}
                  value={parameters[p.name]}
                  onChange={(val) => onParamChange(p.name, val)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Portfolio config */}
        <div className="panel">
          <div className="panel-title">Portfolio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="input-group">
              <label className="input-label">Capital ($)</label>
              <input type="number" className="input-field" value={portfolioConfig.initial_capital}
                onChange={e => onPortfolioChange({ ...portfolioConfig, initial_capital: +e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Commission (%)</label>
              <input type="number" className="input-field" step="0.01" value={(portfolioConfig.commission * 100).toFixed(2)}
                onChange={e => onPortfolioChange({ ...portfolioConfig, commission: +e.target.value / 100 })} />
            </div>
            <div className="input-group">
              <label className="input-label">Slippage (%)</label>
              <input type="number" className="input-field" step="0.01" value={(portfolioConfig.slippage * 100).toFixed(2)}
                onChange={e => onPortfolioChange({ ...portfolioConfig, slippage: +e.target.value / 100 })} />
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          className="btn btn-primary btn-lg"
          onClick={onRun}
          disabled={!selectedStrategy || loading}
          style={{ height: 'fit-content', alignSelf: 'end', whiteSpace: 'nowrap', padding: '0.85rem 2rem' }}
          id="run-backtest-btn"
        >
          {loading ? (
            <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> Running...</>
          ) : (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21"/></svg> Run Backtest</>
          )}
        </button>
      </div>
    </div>
  );
}


/* ── Data Panel ── */
function DataPanel({ ticker, name, quality }) {
  if (!quality) return null;
  return (
    <div className="panel" style={{ height: 'fit-content' }}>
      <div className="panel-title">Datasheet</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{ticker}</span>
        <span className={`badge ${getQualityColor(quality.quality_score)}`}>{quality.quality_score}</span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        {[
          ['Class', quality.asset_class],
          ['Points', quality.total_points.toLocaleString()],
          ['Period', `${quality.start_date} — ${quality.end_date}`],
          ['Frequency', quality.granularity],
          ['Ann. Vol', `${quality.annualized_volatility}%`],
          ['Missing', `${quality.missing_percentage}%`],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ── Parameter Control ── */
function ParameterControl({ param, value, onChange }) {
  if (param.type === 'bool') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="input-label" style={{ marginBottom: 0 }}>{param.label}</label>
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: value ? 'var(--accent-blue)' : 'var(--border-primary)',
            position: 'relative', transition: 'background 200ms',
          }}
        >
          <span style={{
            position: 'absolute', width: 18, height: 18, borderRadius: '50%',
            background: 'white', top: 3,
            left: value ? 23 : 3, transition: 'left 200ms',
          }} />
        </button>
      </div>
    );
  }

  if (param.min !== null && param.min !== undefined && param.max !== null && param.type !== 'str') {
    return (
      <div className="input-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="input-label" style={{ marginBottom: 0 }}>{param.label}</label>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>{value}</span>
        </div>
        <input type="range" className="range-slider" min={param.min} max={param.max} step={param.step || 1}
          value={value} onChange={e => onChange(param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>{param.min}</span><span>{param.max}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="input-group">
      <label className="input-label">{param.label}</label>
      <input type={param.type === 'int' ? 'number' : 'text'} className="input-field" value={value}
        onChange={e => onChange(param.type === 'int' ? parseInt(e.target.value) : e.target.value)} />
    </div>
  );
}


/* ── Price Preview Chart ── */
function PricePreviewChart({ data, ticker }) {
  const chartData = data.dates.map((d, i) => ({
    date: d,
    close: data.close[i],
  })).filter((_, i) => i % Math.max(1, Math.floor(data.dates.length / 500)) === 0);

  return (
    <div className="chart-container" id="price-preview-chart">
      <div className="chart-header">
        <div className="chart-title">{ticker} — Price History</div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
          <XAxis dataKey="date" tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a2a4a' }}
            tickFormatter={(d) => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
          <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }}
            labelStyle={{ color: '#8899bb' }}
            formatter={(v) => [`$${v.toFixed(2)}`, 'Price']}
          />
          <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={1.5} fill="url(#priceGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   RESULTS VIEW — with period switcher
   ══════════════════════════════════════════════════════════════ */

function ResultsView({ result, activeTab, onTabChange, period, onPeriodChange, loading, ticker, strategyId, parameters, portfolioConfig }) {
  const periods = [
    { value: '1mo', label: '1M' },
    { value: '3mo', label: '3M' },
    { value: '6mo', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: '2y', label: '2Y' },
    { value: '3y', label: '3Y' },
    { value: '5y', label: '5Y' },
    { value: '10y', label: '10Y' },
    { value: 'max', label: 'Max' },
  ];

  const tabs = [
    { key: 'performance', label: 'Performance' },
    { key: 'trades', label: 'Trades' },
    { key: 'drawdown', label: 'Drawdown' },
    { key: 'benchmark', label: 'vs Buy & Hold' },
    { key: 'robustness', label: '🔬 Robustness' },
  ];

  // Compute the verdict
  const ec = result.equity_curve;
  const strategyReturn = result.kpis.total_return;
  const benchReturn = ec.benchmark_value.length > 0 ? ((ec.benchmark_value[ec.benchmark_value.length - 1] / ec.benchmark_value[0] - 1) * 100) : 0;
  const beats = strategyReturn > benchReturn;

  return (
    <div>
      {/* ── Big Verdict Card ── */}
      <div className="card" style={{
        marginBottom: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
        borderColor: result.strategy_id === 'buy_hold' ? 'var(--border-primary)' : (beats ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'),
        background: result.strategy_id === 'buy_hold' ? 'var(--bg-secondary)' : (beats ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)'),
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          {result.ticker} × {result.strategy_name}
        </div>
        
        {result.strategy_id === 'buy_hold' ? (
          <>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Base Market Performance
            </div>
            <div style={{
              fontSize: '3rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              lineHeight: 1,
              marginBottom: '0.75rem',
            }}>
              BENCHMARK
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Do I beat Buy & Hold?
            </div>
            <div style={{
              fontSize: '3rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
              color: beats ? 'var(--accent-green)' : 'var(--accent-red)',
              lineHeight: 1,
              marginBottom: '0.75rem',
            }}>
              {beats ? '✓ YES' : '✗ NO'}
            </div>
          </>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.9rem' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Strategy</div>
            <div className={`kpi-value ${classifyValue(strategyReturn)}`} style={{ fontSize: '1.3rem' }}>
              {formatPercent(strategyReturn)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--border-primary)' }} />
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Buy & Hold</div>
            <div className={`kpi-value ${classifyValue(benchReturn)}`} style={{ fontSize: '1.3rem' }}>
              {formatPercent(benchReturn)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--border-primary)' }} />
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Alpha</div>
            <div className={`kpi-value ${classifyValue(strategyReturn - benchReturn)}`} style={{ fontSize: '1.3rem' }}>
              {formatPercent(strategyReturn - benchReturn)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Smart Badges ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
        {result.kpis.total_trades > 100 && <span className="badge badge-purple">⚡ High Frequency</span>}
        {result.kpis.win_rate >= 80 && result.kpis.total_trades > 10 && <span className="badge badge-red">🚨 Overfit Suspect</span>}
        {result.kpis.sharpe_ratio >= 1.5 && <span className="badge badge-green">🛡️ Highly Robust</span>}
        {result.kpis.max_drawdown >= -15 && <span className="badge badge-blue">💎 Safe Haven</span>}
        {result.kpis.profit_factor >= 2.0 && <span className="badge badge-amber">📈 Alpha Generator</span>}
        {result.strategy_id === 'ml_random_forest' && <span className="badge badge-blue">🤖 AI Powered</span>}
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {Object.entries(KPI_DEFINITIONS).map(([key, def]) => {
          const val = result.kpis[key];
          return (
            <motion.div key={key} className="kpi-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Object.keys(KPI_DEFINITIONS).indexOf(key) * 0.03 }}
            >
              <div className="kpi-label">{def.label}</div>
              <div className={`kpi-value ${def.positive !== null ? classifyValue(val, { positive: def.positive }) : ''}`}>
                {def.format(val)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => onTabChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === 'performance' && <PerformanceTab result={result} periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />}
          {activeTab === 'trades' && <TradesTab trades={result.trades} />}
          {activeTab === 'drawdown' && <DrawdownTab result={result} periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />}
          {activeTab === 'benchmark' && <BenchmarkTab result={result} periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />}
          {activeTab === 'robustness' && (
            <RobustnessPanel
              ticker={ticker}
              strategyId={strategyId}
              parameters={parameters}
              period={period}
              portfolioConfig={portfolioConfig}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


/* ── Period Bar (inline above charts) ── */
function PeriodBar({ periods, period, onPeriodChange, loading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      marginBottom: '0.75rem', gap: '0.3rem', position: 'relative',
    }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,10,20,0.7)', borderRadius: 'var(--radius-md)', zIndex: 2 }}>
          <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
        </div>
      )}
      {periods.map(p => (
        <button key={p.value}
          className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onPeriodChange(p.value)}
          style={{ borderRadius: 100, minWidth: 36, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
          disabled={loading}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}


/* ── Performance Tab ── */
function PerformanceTab({ result, periods, period, onPeriodChange, loading }) {
  const ec = result.equity_curve;
  const fullChartData = ec.dates.map((d, i) => ({
    date: d,
    portfolio: ec.portfolio_value[i],
    benchmark: ec.benchmark_value[i],
  })).filter((_, i) => i % Math.max(1, Math.floor(ec.dates.length / 600)) === 0);

  const [replayIndex, setReplayIndex] = useState(fullChartData.length);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setReplayIndex(fullChartData.length);
  }, [fullChartData.length]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      if (replayIndex >= fullChartData.length) setReplayIndex(1);
      interval = setInterval(() => {
        setReplayIndex(prev => {
          // Play speed depending on data points
          const step = Math.max(1, Math.floor(fullChartData.length / 100));
          if (prev + step >= fullChartData.length) {
            setIsPlaying(false);
            return fullChartData.length;
          }
          return prev + step;
        });
      }, 30);
    }
    return () => clearInterval(interval);
  }, [isPlaying, fullChartData.length, replayIndex]);

  const toggleReplay = () => {
    if (!isPlaying && replayIndex >= fullChartData.length) {
      setReplayIndex(1);
    }
    setIsPlaying(!isPlaying);
  };

  const chartData = fullChartData.slice(0, replayIndex);

  return (
    <div className="chart-container" id="equity-curve-chart">
      <div className="chart-header">
        <div className="chart-title">Equity Curve</div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 3, background: '#3b82f6', borderRadius: 2 }}></span>
            <span style={{ color: 'var(--text-muted)' }}>Strategy</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 3, background: '#5a6a88', borderRadius: 2 }}></span>
            <span style={{ color: 'var(--text-muted)' }}>Buy & Hold</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={toggleReplay} 
          className="btn btn-sm" 
          style={{ 
            background: isPlaying ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)', 
            color: isPlaying ? 'var(--accent-red)' : 'var(--accent-green)',
            borderColor: isPlaying ? 'var(--accent-red)' : 'var(--accent-green)', 
            borderRadius: '100px',
            marginBottom: '0.75rem' 
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Replay History'}
        </button>
        <PeriodBar periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
          <XAxis dataKey="date" tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a2a4a' }}
            interval={Math.floor(chartData.length / 6)} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
          <Tooltip
            contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }}
            labelStyle={{ color: '#8899bb' }}
            formatter={(v, name) => [`$${v.toFixed(2)}`, name === 'portfolio' ? 'Strategy' : 'Buy & Hold']}
          />
          <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="benchmark" stroke="#5a6a88" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


/* ── Trades Tab ── */
function TradesTab({ trades }) {
  if (!trades || trades.length === 0) {
    return <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No trades executed</div>;
  }
  return (
    <div className="card" style={{ overflow: 'auto', maxHeight: 500 }}>
      <table className="data-table" id="trades-table">
        <thead>
          <tr>
            <th>Entry Date</th>
            <th>Exit Date</th>
            <th>Entry Price</th>
            <th>Exit Price</th>
            <th>PnL</th>
            <th>PnL %</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i}>
              <td>{t.entry_date}</td>
              <td>{t.exit_date}</td>
              <td>${t.entry_price.toFixed(2)}</td>
              <td>${t.exit_price.toFixed(2)}</td>
              <td className={t.pnl >= 0 ? 'positive' : 'negative'}>${t.pnl.toFixed(2)}</td>
              <td className={t.pnl_pct >= 0 ? 'positive' : 'negative'}>{t.pnl_pct > 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%</td>
              <td>{t.holding_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ── Drawdown Tab ── */
function DrawdownTab({ result, periods, period, onPeriodChange, loading }) {
  const ec = result.equity_curve;
  const chartData = ec.dates.map((d, i) => ({
    date: d,
    drawdown: (ec.drawdown[i] * 100),
  })).filter((_, i) => i % Math.max(1, Math.floor(ec.dates.length / 600)) === 0);

  return (
    <div className="chart-container" id="drawdown-chart">
      <div className="chart-header">
        <div className="chart-title">Drawdown Curve</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Max drawdown: <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatPercent(result.kpis.max_drawdown)}</span>
        </div>
      </div>
      <PeriodBar periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
          <XAxis dataKey="date" tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a2a4a' }}
            interval={Math.floor(chartData.length / 6)} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={v => `${v.toFixed(0)}%`} domain={['auto', 0]} />
          <Tooltip
            contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }}
            formatter={v => [`${v.toFixed(2)}%`, 'Drawdown']}
          />
          <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


/* ── Benchmark Tab ── */
function BenchmarkTab({ result, periods, period, onPeriodChange, loading }) {
  const ec = result.equity_curve;
  const initialPortfolio = ec.portfolio_value[0] || 1;
  const initialBenchmark = ec.benchmark_value[0] || 1;

  const chartData = ec.dates.map((d, i) => ({
    date: d,
    strategy: ((ec.portfolio_value[i] / initialPortfolio - 1) * 100),
    benchmark: ((ec.benchmark_value[i] / initialBenchmark - 1) * 100),
  })).filter((_, i) => i % Math.max(1, Math.floor(ec.dates.length / 600)) === 0);

  return (
    <div className="chart-container" id="benchmark-chart">
      <div className="chart-header">
        <div className="chart-title">Cumulative Returns — Strategy vs Buy & Hold</div>
      </div>
      <PeriodBar periods={periods} period={period} onPeriodChange={onPeriodChange} loading={loading} />
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,42,74,0.3)" />
          <XAxis dataKey="date" tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a2a4a' }}
            interval={Math.floor(chartData.length / 6)} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: '#5a6a88', fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={v => `${v.toFixed(0)}%`} />
          <Tooltip
            contentStyle={{ background: '#131b2e', border: '1px solid #1a2a4a', borderRadius: 8, fontSize: '0.82rem' }}
            formatter={(v, name) => [`${v.toFixed(2)}%`, name === 'strategy' ? 'Strategy' : 'Buy & Hold']}
          />
          <Line type="monotone" dataKey="strategy" stroke="#3b82f6" strokeWidth={2} dot={false} name="strategy" />
          <Line type="monotone" dataKey="benchmark" stroke="#5a6a88" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="benchmark" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
