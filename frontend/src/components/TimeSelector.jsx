import React from 'react';

const PERIODS = [
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

const INTERVALS = [
  { value: '1d', label: 'Daily' },
  { value: '1wk', label: 'Weekly' },
  { value: '1mo', label: 'Monthly' },
];

const SCENARIOS = [
  { label: "Dotcom Bubble", start: "2000-01-01", end: "2002-12-31", desc: "Tech crash & Bear market" },
  { label: "2008 Financial Crisis", start: "2007-10-01", end: "2009-03-31", desc: "Subprime mortgage drop" },
  { label: "COVID-19 Crash", start: "2020-02-15", end: "2020-04-15", desc: "Global pandemic panic" },
  { label: "Post-Covid Bull", start: "2020-04-16", end: "2021-12-31", desc: "ZIRP & Tech rally" },
  { label: "2022 Bear Market", start: "2022-01-01", end: "2022-12-31", desc: "Inflation & rate hikes" },
];

export default function TimeSelector({
  period, onPeriodChange,
  interval, onIntervalChange,
  dateMode, onDateModeChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange
}) {
  return (
    <div style={{ textAlign: 'left' }}>
      {onIntervalChange && (
        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <label className="input-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interval</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {INTERVALS.map(iv => (
              <button key={iv.value}
                className={`btn btn-sm ${interval === iv.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onIntervalChange(iv.value)}
                style={{ borderRadius: 100 }}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="input-group" style={{ marginBottom: '0' }}>
        <label className="input-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Time Window</label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button className={`btn btn-sm ${dateMode === 'preset' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onDateModeChange('preset')} style={{ borderRadius: 100 }}>
            Preset
          </button>
          <button className={`btn btn-sm ${dateMode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onDateModeChange('custom')} style={{ borderRadius: 100 }}>
            Custom Range
          </button>
          <button className={`btn btn-sm ${dateMode === 'scenario' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onDateModeChange('scenario')} style={{ borderRadius: 100 }}>
            Historical Scenarios
          </button>
        </div>

        {dateMode === 'preset' ? (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.value}
                className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onPeriodChange(p.value)}
                style={{ borderRadius: 100, minWidth: 36 }}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : dateMode === 'custom' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Start Date</label>
              <input type="date" className="input-field" value={startDate}
                onChange={e => onStartDateChange(e.target.value)} style={{ padding: '0.4rem 0.6rem' }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.75rem' }}>End Date</label>
              <input type="date" className="input-field" value={endDate}
                onChange={e => onEndDateChange(e.target.value)} style={{ padding: '0.4rem 0.6rem' }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {SCENARIOS.map(s => (
              <button key={s.label} className="btn btn-ghost btn-sm"
                onClick={() => {
                  onStartDateChange(s.start);
                  onEndDateChange(s.end);
                  onDateModeChange('custom');
                }}
                style={{ 
                  justifyContent: 'space-between', textAlign: 'left', 
                  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem'
                }}>
                <span style={{ fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.desc} • {s.start.substring(0,4)}-{s.end.substring(0,4)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
