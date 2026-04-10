import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const CATEGORY_LABELS = {
  basic: { label: 'Classic Strategies', icon: '📈', color: 'var(--accent-blue)' },
  quant: { label: 'Quantitative', icon: '🧮', color: 'var(--accent-purple)' },
  ml: { label: 'Machine Learning', icon: '🤖', color: 'var(--accent-cyan)' },
};

const STRATEGY_ICONS = {
  buy_hold: '📦',
  ma_crossover: '📐',
  rsi_reversion: '🔄',
  momentum: '🚀',
  bollinger: '📊',
  macd: '📉',
  volatility_breakout: '⚡',
};

export default function Strategies() {
  const [strategies, setStrategies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStrategies().then(data => {
      setStrategies(data.strategies || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selected = strategies.find(s => s.id === selectedId);
  const categories = [...new Set(strategies.map(s => s.category))];

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container"><div className="spinner" /><span>Loading strategies...</span></div>
      </div>
    );
  }

  return (
    <div className="page-container" id="strategies-page">
      <div className="page-header">
        <h1 className="page-title">Strategy Library</h1>
        <p className="page-subtitle">Explore, understand, and select trading strategies for backtesting</p>
      </div>

      <div className="sidebar-layout" style={{ gridTemplateColumns: '1fr 380px' }}>
        {/* Left: Strategy Grid */}
        <div>
          {categories.map(cat => {
            const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: '📊', color: 'var(--accent-blue)' };
            const catStrategies = strategies.filter(s => s.category === cat);

            return (
              <div key={cat} style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{catInfo.icon}</span>
                  <span>{catInfo.label}</span>
                  <span className="badge badge-blue" style={{ marginLeft: '0.25rem' }}>{catStrategies.length}</span>
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {catStrategies.map((s, i) => (
                    <motion.div
                      key={s.id}
                      className={`strategy-card ${selectedId === s.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>{STRATEGY_ICONS[s.id] || '📊'}</span>
                        <div className="strategy-name">{s.name}</div>
                      </div>
                      <div className="strategy-desc">{s.description}</div>
                      <div className="strategy-tags">
                        {(s.tags || []).map(t => <span key={t} className="strategy-tag">{t}</span>)}
                      </div>
                      {s.parameters && s.parameters.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.parameters.length} adjustable parameter{s.parameters.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Detail Panel */}
        <div>
          {selected ? (
            <motion.div
              className="panel"
              style={{ position: 'sticky', top: 'calc(var(--header-height) + 1rem)' }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>{STRATEGY_ICONS[selected.id] || '📊'}</span>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.name}</h3>
                  <span className={`badge badge-${selected.category === 'quant' ? 'purple' : 'blue'}`}>
                    {CATEGORY_LABELS[selected.category]?.label || selected.category}
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                {selected.long_description || selected.description}
              </p>

              {selected.parameters && selected.parameters.length > 0 && (
                <>
                  <div className="panel-title" style={{ marginTop: '1rem' }}>Parameters</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selected.parameters.map(p => (
                      <div key={p.name} style={{
                        padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.label}</span>
                          <span className="text-mono" style={{ fontSize: '0.82rem', color: 'var(--accent-blue)' }}>{String(p.default)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.description}</div>
                        {p.min != null && p.max != null && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Range: {p.min} — {p.max} (step: {p.step || 1})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Link to="/lab" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Use This Strategy →
              </Link>
            </motion.div>
          ) : (
            <div className="panel" style={{ position: 'sticky', top: 'calc(var(--header-height) + 1rem)', textAlign: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📊</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Select a strategy to see details, parameters, and documentation
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
