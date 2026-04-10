import { useState } from 'react';

const INDICATORS = ['PRICE', 'SMA_10', 'SMA_50', 'SMA_200', 'EMA_20', 'RSI_14', 'MACD'];
const OPERATORS = ['>', '<', '>=', '<=', '=='];

export default function StrategyBuilder({ value, onChange }) {
  // Ensure we have a valid object structure
  const rules = (typeof value === 'string' ? JSON.parse(value || '{}') : value) || {};
  const data = {
    entry_logic: rules.entry_logic || 'AND',
    entry_conditions: rules.entry_conditions || [],
    exit_logic: rules.exit_logic || 'OR',
    exit_conditions: rules.exit_conditions || []
  };

  const notifyChange = (newData) => {
    onChange(newData); // Passing object up, backend might get it as JSON string or dict
  };

  const addCondition = (type) => {
    const newData = { ...data };
    newData[`${type}_conditions`].push({
      left: 'PRICE',
      operator: '>',
      right_type: 'number',
      right: '100'
    });
    notifyChange(newData);
  };

  const removeCondition = (type, index) => {
    const newData = { ...data };
    newData[`${type}_conditions`].splice(index, 1);
    notifyChange(newData);
  };

  const updateCondition = (type, index, field, val) => {
    const newData = { ...data };
    newData[`${type}_conditions`][index][field] = val;
    
    // Auto-correct right value if type changes
    if (field === 'right_type') {
      if (val === 'number') {
        newData[`${type}_conditions`][index]['right'] = '100';
      } else {
        newData[`${type}_conditions`][index]['right'] = 'SMA_50';
      }
    }
    
    notifyChange(newData);
  };

  const updateLogic = (type, val) => {
    const newData = { ...data };
    newData[`${type}_logic`] = val;
    notifyChange(newData);
  };

  const renderSection = (type, title) => {
    const conditions = data[`${type}_conditions`];
    const logic = data[`${type}_logic`];

    return (
      <div className="card" style={{ marginBottom: '1rem', background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: type === 'entry' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {title}
          </h3>
          <button className="btn btn-sm" onClick={() => addCondition(type)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
            + Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem' }}>
            No conditions defined. The strategy will not trigger.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {conditions.map((cond, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
                
                {i > 0 && (
                  <select 
                    className="input-field" 
                    value={logic} 
                    onChange={e => updateLogic(type, e.target.value)}
                    style={{ width: '70px', padding: '0.2rem', fontSize: '0.75rem', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' }}
                  >
                    <option value="AND" style={{ background: 'var(--bg-input)', color: '#fff' }}>AND</option>
                    <option value="OR" style={{ background: 'var(--bg-input)', color: '#fff' }}>OR</option>
                  </select>
                )}
                {i === 0 && <span style={{ width: '70px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>IF</span>}

                <select className="input-field" value={cond.left} onChange={e => updateCondition(type, i, 'left', e.target.value)} style={{ flex: 1, minWidth: '100px', padding: '0.4rem' }}>
                  {INDICATORS.map(ind => <option key={ind} value={ind} style={{ background: 'var(--bg-input)' }}>{ind.replace('_', ' ')}</option>)}
                </select>

                <select className="input-field" value={cond.operator} onChange={e => updateCondition(type, i, 'operator', e.target.value)} style={{ width: '60px', padding: '0.4rem', textAlign: 'center' }}>
                  {OPERATORS.map(op => <option key={op} value={op} style={{ background: 'var(--bg-input)' }}>{op}</option>)}
                </select>

                <select className="input-field" value={cond.right_type} onChange={e => updateCondition(type, i, 'right_type', e.target.value)} style={{ width: '100px', padding: '0.4rem' }}>
                  <option value="number" style={{ background: 'var(--bg-input)' }}>Static Value</option>
                  <option value="indicator" style={{ background: 'var(--bg-input)' }}>Indicator</option>
                </select>

                {cond.right_type === 'number' ? (
                  <input type="number" className="input-field" value={cond.right} onChange={e => updateCondition(type, i, 'right', e.target.value)} style={{ flex: 1, minWidth: '80px', padding: '0.4rem' }} />
                ) : (
                  <select className="input-field" value={cond.right} onChange={e => updateCondition(type, i, 'right', e.target.value)} style={{ flex: 1, minWidth: '100px', padding: '0.4rem' }}>
                    {INDICATORS.map(ind => <option key={ind} value={ind} style={{ background: 'var(--bg-input)' }}>{ind.replace('_', ' ')}</option>)}
                  </select>
                )}

                <button onClick={() => removeCondition(type, i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="strategy-builder" style={{ marginTop: '1rem' }}>
      {renderSection('entry', '🟢 Buy Rules')}
      {renderSection('exit', '🔴 Sell Rules')}
    </div>
  );
}
