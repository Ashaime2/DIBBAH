import { BrowserRouter as Router, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Landing from './pages/Landing';
import Lab from './pages/Lab';
import Strategies from './pages/Strategies';
import Compare from './pages/Compare';
import Tournament from './pages/Tournament';
import Methodology from './pages/Methodology';

function Navbar() {
  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <svg className="logo-icon" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="logo-g" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="50%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#ef4444"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="#0a0e1a" stroke="#1a2a4a" strokeWidth="1"/>
            {/* Question mark made of chart */}
            <path d="M10 12 C10 8, 22 8, 22 12 C22 16, 16 15, 16 19" stroke="url(#logo-g)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="16" cy="23" r="1.5" fill="#3b82f6"/>
          </svg>
          <span className="brand-name">DIBBAH</span>
        </Link>
        <div className="navbar-links">
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Home</NavLink>
          <NavLink to="/lab" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Lab</NavLink>
          <NavLink to="/compare" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Compare</NavLink>
          <NavLink to="/tournament" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Tournament 🏆</NavLink>
          <NavLink to="/strategies" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Strategies</NavLink>
          <NavLink to="/methodology" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Methodology</NavLink>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <p><strong>DIBBAH</strong> — Do I Beat Buy And Hold?</p>
      <p style={{ marginTop: '0.25rem', fontSize: '0.78rem' }}>
        Built for critical evaluation of trading strategies. Past performance does not guarantee future results.
      </p>
    </footer>
  );
}

function PageTitleHandler() {
  const location = useLocation();
  
  useEffect(() => {
    const titles = {
      '/': 'DIBBAH | Home',
      '/lab': 'DIBBAH | Lab',
      '/compare': 'DIBBAH | Comparison',
      '/tournament': 'DIBBAH | Tournament 🏆',
      '/strategies': 'DIBBAH | Strategy Hub',
      '/methodology': 'DIBBAH | Methodology'
    };
    document.title = titles[location.pathname] || 'DIBBAH — Do I Beat Buy And Hold?';
  }, [location]);
  
  return null;
}

export default function App() {
  return (
    <Router>
      <PageTitleHandler />
      <div className="app-layout">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/tournament" element={<Tournament />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
