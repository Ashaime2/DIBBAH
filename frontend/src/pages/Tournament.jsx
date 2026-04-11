import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { formatPercent, formatRatio } from '../utils/formatters';
import TimeSelector from '../components/TimeSelector';

export default function Tournament() {
  const [ticker, setTicker] = useState('QQQ');
  const [period, setPeriod] = useState('5y');
  const [interval, setInterval_] = useState('1d');
  const [dateMode, setDateMode] = useState('preset');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedSetupId, setExpandedSetupId] = useState(null);
  const [expandedResultIdx, setExpandedResultIdx] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Execution settings
  const [commission, setCommission] = useState(0.001); // 0.1%
  const [slippage, setSlippage] = useState(0.0005);   // 0.05%
  const [initialCapital, setInitialCapital] = useState(10000);

  const handleSearch = async (query) => {
    setTicker(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await api.searchTickers(query);
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const selectAsset = (asset) => {
    setTicker(asset.ticker);
    setSearchResults([]);
  };

  useEffect(() => {
    api.getStrategies().then(data => {
      const loaded = (data.strategies || [])
        .filter(s => s.id !== 'custom_builder' && s.id !== 'ml_random_forest')
        .map(s => {
          const defaults = {};
          if (s.parameters) {
            s.parameters.forEach(p => { defaults[p.name] = p.default; });
          }
          return { ...s, customParameters: defaults };
        });
      setStrategies(loaded);
    }).catch(console.error);
  }, []);

  const updateStrategyParam = (strategyId, paramName, value) => {
    setStrategies(prev => prev.map(s => {
      if (s.id === strategyId) {
        return { ...s, customParameters: { ...s.customParameters, [paramName]: value } };
      }
      return s;
    }));
  };

  const startTournament = async () => {
    if (!ticker) {
      setError("Please select a ticker");
      return;
    }
    if (strategies.length === 0) {
      setError("No strategies available");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Build configs for ALL strategies with their custom parameters
      const configs = strategies.map(s => ({
        strategy_id: s.id, 
        parameters: s.customParameters || {}
      }));

      const payload = {
        ticker: ticker.toUpperCase(),
        period: dateMode === 'preset' ? period : '5y',
        interval: interval,
        start_date: dateMode !== 'preset' && startDate ? startDate : undefined,
        end_date: dateMode !== 'preset' && endDate ? endDate : undefined,
        initial_capital: initialCapital,
        commission: commission,
        slippage: slippage,
        strategy_configs: configs
      };
      
      const data = await api.compareStrategies(payload);
      setResults(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="page-container" id="tournament-page">
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="page-title" style={{ fontSize: '3rem', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)', WebkitBackgroundClip: 'text' }}>
          Strategy Tournament
        </h1>
        <p className="page-subtitle" style={{ fontSize: '1.2rem' }}>
          Pit every single strategy against each other in an ultimate battle for Alpha.
        </p>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--accent-red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', marginBottom: '1.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Arena Setup */}
      {!loading && !results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '3rem 2rem', overflow: 'visible' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏟️</div>
          <h2 style={{ marginBottom: '2rem' }}>Configure the Arena</h2>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{ textAlign: 'left', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Battleground (Ticker)</label>
              <input type="text" value={ticker} onChange={e => handleSearch(e.target.value)} 
                className="input-field" placeholder="e.g. SPY"
                style={{ width: '180px', textAlign: 'left', fontSize: '1.2rem', fontWeight: 'bold' }} 
              />
              
              {/* Search Suggestions Dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', 
                  borderRadius: 'var(--radius-md)', marginTop: '0.2rem', maxHeight: '200px', overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  {searchResults.map(r => (
                    <div key={r.ticker} onClick={() => selectAsset(r)}
                      style={{
                        padding: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid var(--border-primary)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{r.ticker}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{r.name}</span>
                      </div>
                      <span className={`badge badge-${r.type === 'Crypto' ? 'purple' : r.type === 'ETF' ? 'blue' : 'green'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                        {r.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <TimeSelector 
                period={period} onPeriodChange={setPeriod}
                interval={interval} onIntervalChange={setInterval_}
                dateMode={dateMode} onDateModeChange={setDateMode}
                startDate={startDate} onStartDateChange={setStartDate}
                endDate={endDate} onEndDateChange={setEndDate}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '2.5rem', textAlign: 'left' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.8rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}
              onClick={() => setExpandedSetupId(expandedSetupId === 'all' ? null : 'all')}
            >
              <div style={{ fontWeight: 600 }}>🛠️ Configure Participants ({strategies.length})</div>
              <div>{expandedSetupId === 'all' ? '▲' : '▼'}</div>
            </div>
            
            {expandedSetupId === 'all' && (
              <div style={{ padding: '1rem', border: '1px solid var(--border-primary)', borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)' }}>
                {strategies.map(s => (
                  <div key={s.id} style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{s.name}</div>
                    {(!s.parameters || s.parameters.length === 0) ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No configurable parameters</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {s.parameters.map(p => (
                          <div key={p.name}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.label}</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                              value={s.customParameters?.[p.name] ?? p.default} 
                              onChange={e => updateStrategyParam(s.id, p.name, parseFloat(e.target.value))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2.5rem', position: 'relative' }}>
            <button 
              className={`btn btn-sm ${showSettings ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setShowSettings(!showSettings)}
              style={{ borderRadius: '100px', padding: '0.4rem 1rem' }}
            >
              ⚙️ Execution Settings
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{ 
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '100%', 
                    marginTop: '0.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)', padding: '1.2rem', width: '250px', zIndex: 10,
                    boxShadow: 'var(--shadow-lg)', textAlign: 'left'
                  }}
                >
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Initial Capital</label>
                    <input type="number" className="input-field" value={initialCapital} onChange={e => setInitialCapital(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Commission (%)</label>
                    <input type="number" step="0.01" className="input-field" value={(commission * 100).toFixed(2)} onChange={e => setCommission(Number(e.target.value) / 100)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Slippage (%)</label>
                    <input type="number" step="0.01" className="input-field" value={(slippage * 100).toFixed(2)} onChange={e => setSlippage(Number(e.target.value) / 100)} style={{ width: '100%' }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem', borderRadius: '100px' }} onClick={startTournament}>
            Start the Tournament!
          </button>
        </motion.div>
      )}

      {loading && (
        <div className="loading-container" style={{ height: '50vh' }}>
          <div className="spinner" style={{ width: 60, height: 60, borderWidth: 4 }}></div>
          <div style={{ fontSize: '1.2rem', color: 'var(--accent-amber)', marginTop: '2rem', animation: 'pulse 1.5s infinite', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
            Simulating {strategies.length} concurrent backtests...
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
              This may take few minutes or even crash : I'm too broke to pay actual servers
            </p>
          </div>
        </div>
      )}

      {results && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>Official Results</h2>
              <div style={{ color: 'var(--text-muted)' }}>Ticker: <strong style={{color: 'var(--accent-blue)'}}>{ticker}</strong> | Period: {period}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => setResults(null)}>New Tournament</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {results.ranking.by_return.map((rankedItem, index) => {
              // Find the full result for this strategy to get all KPIs
              const fullResult = results.results.find(r => r.strategy_name === rankedItem.strategy);
              const kpis = fullResult.kpis;
              // Extract benchmark return for comparison
              const ec = fullResult.equity_curve;
              const benchReturn = ec.benchmark_value.length > 0 ? ((ec.benchmark_value[ec.benchmark_value.length - 1] / ec.benchmark_value[0] - 1) * 100) : 0;
              const beatsBench = kpis.total_return > benchReturn;

              return (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="card"
                  onClick={() => setExpandedResultIdx(expandedResultIdx === index ? null : index)}
                  style={{ 
                    display: 'flex', flexDirection: 'column', padding: '1.25rem', cursor: 'pointer',
                    background: index === 0 ? 'linear-gradient(90deg, rgba(245,158,11,0.1) 0%, transparent 100%)' : 'var(--bg-card)',
                    borderColor: index === 0 ? 'var(--accent-amber)' : 'var(--border-primary)',
                    transform: index === 0 ? 'scale(1.02)' : 'none',
                    zIndex: 10 - index
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '60px', fontSize: index === 0 ? '2.5rem' : '1.5rem', fontWeight: 900, color: index === 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                    #{index + 1}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {rankedItem.strategy}
                      {index === 0 && <span style={{ fontSize: '1rem' }}>👑</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.3rem' }}>
                      {fullResult.strategy_id === 'buy_hold' ? (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>— Benchmark —</span>
                      ) : (
                        <span style={{ color: beatsBench ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {beatsBench ? 'Beats B&H' : 'Loses to B&H'}
                        </span>
                      )}
                      {fullResult.strategy_id === 'ml_random_forest' && <span style={{ color: 'var(--accent-blue)' }}>🤖 AI Strategy</span>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)', gap: '2rem', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Return</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: kpis.total_return > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatPercent(kpis.total_return)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sharpe</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {formatRatio(kpis.sharpe_ratio)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Drawdown</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {formatPercent(kpis.max_drawdown)}
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Expanded Parameters View */}
                  {expandedResultIdx === index && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-primary)', width: '100%' }}
                    >
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Parameters Used
                      </div>
                      {(!fullResult.parameters || Object.keys(fullResult.parameters).length === 0) ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No configurable parameters.</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          {Object.entries(fullResult.parameters).map(([key, val]) => (
                            <div key={key} style={{ background: 'var(--bg-elevated)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>{key}</span>
                              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
