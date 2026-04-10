import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/* ── Animated mini chart for hero ── */
function HeroChart() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 600, H = 280;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Generate Buy & Hold data
    let bh = 100;
    const bhData = [bh];
    for (let i = 1; i < 120; i++) {
      bh += (Math.random() - 0.46) * 2.8;
      bh = Math.max(bh, 55);
      bhData.push(bh);
    }

    // Generate strategy data (sometimes beats, sometimes doesn't)
    let strat = 100;
    const stratData = [strat];
    for (let i = 1; i < bhData.length; i++) {
      const bhChange = (bhData[i] - bhData[i-1]) / bhData[i-1];
      // Strategy is more cautious, avoids some drawdowns but misses some upside
      const stratChange = bhChange > 0 ? bhChange * 0.85 : bhChange * 0.5;
      strat *= (1 + stratChange + (Math.random() - 0.5) * 0.005);
      stratData.push(strat);
    }

    const allVals = [...bhData, ...stratData];
    const minP = Math.min(...allVals) * 0.95;
    const maxP = Math.max(...allVals) * 1.05;
    const toX = (i) => (i / (bhData.length - 1)) * W;
    const toY = (v) => H - ((v - minP) / (maxP - minP)) * H;

    let frame = 0;
    const totalFrames = bhData.length;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(26,42,74,0.4)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const y = (H / 5) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const drawCount = Math.min(Math.floor(frame), totalFrames - 1);

      // Buy & Hold line (dashed gray)
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.strokeStyle = '#5a6a88';
      ctx.lineWidth = 2;
      for (let i = 0; i <= drawCount; i++) {
        const x = toX(i), y = toY(bhData[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Strategy line (gradient)
      if (drawCount > 0) {
        const beats = stratData[drawCount] > bhData[drawCount];
        ctx.beginPath();
        ctx.strokeStyle = beats ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2.5;
        for (let i = 0; i <= drawCount; i++) {
          const x = toX(i), y = toY(stratData[i]);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Area fill
        ctx.lineTo(toX(drawCount), H);
        ctx.lineTo(toX(0), H);
        ctx.closePath();
        const color = beats ? '16,185,129' : '239,68,68';
        const areaGrad = ctx.createLinearGradient(0, 0, 0, H);
        areaGrad.addColorStop(0, `rgba(${color},0.12)`);
        areaGrad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = areaGrad;
        ctx.fill();
      }

      // End labels
      if (drawCount > 20) {
        const X = toX(drawCount);
        // BH label
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = '#5a6a88';
        ctx.fillText('Buy & Hold', X + 6, toY(bhData[drawCount]) + 4);
        // Strat label
        const beats = stratData[drawCount] > bhData[drawCount];
        ctx.fillStyle = beats ? '#10b981' : '#ef4444';
        ctx.fillText('Your Strategy', X + 6, toY(stratData[drawCount]) + 4);
      }

      // Verdict at the end
      if (drawCount >= totalFrames - 1) {
        const beats = stratData[drawCount] > bhData[drawCount];
        ctx.font = '800 28px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = beats ? '#10b981' : '#ef4444';
        ctx.fillText(beats ? '✓ YES' : '✗ NO', W / 2, H / 2 - 10);
        ctx.font = '500 13px Inter, sans-serif';
        ctx.fillStyle = '#8899bb';
        ctx.fillText('Do you beat Buy & Hold?', W / 2, H / 2 + 15);
        ctx.textAlign = 'start';
      }

      frame += 0.8;
      if (frame <= totalFrames + 50) {
        requestAnimationFrame(draw);
      } else {
        setTimeout(() => { frame = 0; draw(); }, 3000);
      }
    }

    draw();
  }, []);

  return (
    <div style={{
      position: 'relative',
      maxWidth: 600,
      margin: '0 auto',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--border-primary)',
      background: 'var(--bg-card)',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 280, display: 'block' }} />
    </div>
  );
}

/* ── Live metric counter ── */
function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const start = performance.now();
        const animate = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(target * eased * 100) / 100);
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{Math.round(value)}{suffix}</span>;
}

export default function Landing() {
  return (
    <div>
      {/* ── Hero Section ── */}
      <section className="hero" id="hero-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{
              display: 'inline-block',
              padding: '0.3rem 0.85rem',
              borderRadius: 100,
              fontSize: '0.78rem',
              fontWeight: 600,
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: 'var(--accent-blue)',
              letterSpacing: '0.05em',
            }}>
              BACKTESTING PLATFORM
            </span>
          </div>
          <h1 className="hero-title">
            Do I Beat<br />
            <span className="gradient-text">Buy And Hold</span>
            <span style={{ color: 'var(--accent-blue)' }}>?</span>
          </h1>
          <p className="hero-subtitle">
            The one question every strategy must answer.
            Test against real market data with honest metrics, realistic costs, and zero delusions.
          </p>
          <div className="hero-actions">
            <Link to="/lab" className="btn btn-primary btn-lg" id="cta-launch">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Find Out Now
            </Link>
            <Link to="/strategies" className="btn btn-secondary btn-lg" id="cta-explore">
              Explore Strategies
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <HeroChart />
        </motion.div>
      </section>

      {/* ── The Challenge ── */}
      <section style={{ padding: '4rem 2rem' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem' }}>
              Most strategies <span style={{ color: 'var(--accent-red)' }}>don't</span> beat Buy & Hold.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.8 }}>
              After fees, slippage, and bad timing, the majority of active strategies underperform a simple buy-and-hold approach.
              <strong style={{ color: 'var(--text-primary)' }}> DIBBAH</strong> helps you find out if yours is the exception — or the rule.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Three Promises ── */}
      <section style={{ padding: '0 2rem 4rem' }}>
        <div className="features-grid">
          {[
            {
              icon: '📊',
              title: 'Backtest',
              desc: 'Run realistic simulations with transaction costs, slippage, and proper execution modeling on years of historical data.',
              gradient: 'rgba(59,130,246,0.1)',
              border: 'rgba(59,130,246,0.2)',
            },
            {
              icon: '⚖️',
              title: 'Compare',
              desc: 'Evaluate your strategy against Buy & Hold across 12+ performance metrics. No cherry-picking — the benchmark is always there.',
              gradient: 'rgba(139,92,246,0.1)',
              border: 'rgba(139,92,246,0.2)',
            },
            {
              icon: '🔬',
              title: 'Stress-Test',
              desc: 'Challenge your results with train/test splits, fee stress tests, and parameter sensitivity. Separate signal from noise.',
              gradient: 'rgba(6,182,212,0.1)',
              border: 'rgba(6,182,212,0.2)',
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="feature-icon" style={{ background: f.gradient, borderColor: f.border }}>
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{
        padding: '3rem 2rem',
        borderTop: '1px solid var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', gap: '2rem' }}>
          {[
            { value: 7, suffix: '', label: 'Strategies' },
            { value: 12, suffix: '+', label: 'Performance KPIs' },
            { value: 40, suffix: '+', label: 'Asset Tickers' },
            { value: 3, suffix: '', label: 'Robustness Tests' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 800 }} className="text-gradient">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why this matters ── */}
      <section style={{ padding: '5rem 2rem', maxWidth: 900, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', textAlign: 'center' }}>
            Honest <span className="text-gradient">answers</span>, not pretty curves
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.8, textAlign: 'center', marginBottom: '3rem' }}>
            Every backtest on DIBBAH is designed to answer the hard question first.
          </p>

          <div className="grid-2" style={{ gap: '1rem' }}>
            {[
              {
                title: 'Overfitting Detection',
                desc: 'Many strategies look great in-sample but fail catastrophically out-of-sample. We systematically test for this.',
                icon: '🎯',
                color: 'var(--accent-red)',
              },
              {
                title: 'Look-Ahead Bias Prevention',
                desc: 'Our engine strictly uses information available at the time of each decision. No future data leakage.',
                icon: '🔒',
                color: 'var(--accent-amber)',
              },
              {
                title: 'Realistic Execution',
                desc: 'Transaction costs, slippage, and execution delay are modeled. Results reflect real-world constraints.',
                icon: '⚙️',
                color: 'var(--accent-blue)',
              },
              {
                title: 'The Benchmark Is Always There',
                desc: 'Every chart, every metric is shown side-by-side with Buy & Hold. No hiding from the truth.',
                icon: '📋',
                color: 'var(--accent-green)',
              },
            ].map((item, i) => (
              <div key={i} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  background: `${item.color}15`, border: `1px solid ${item.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{item.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA Bottom ── */}
      <section style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, transparent, var(--bg-secondary))',
      }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>
          So... do <span className="text-gradient">you</span> beat Buy & Hold?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          Select an asset, pick a strategy, and find out.
        </p>
        <Link to="/lab" className="btn btn-primary btn-lg">
          Find Out Now →
        </Link>
      </section>
    </div>
  );
}
