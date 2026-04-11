const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  async _fetch(url, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to backend. Make sure the API server is running on port 8000.');
      }
      throw err;
    }
  }

  // Market Data
  searchTickers(query) {
    return this._fetch(`/market/search?q=${encodeURIComponent(query)}`);
  }

  getMarketData(ticker, period = '5y', interval = '1d', startDate = null, endDate = null) {
    let url = `/market/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    return this._fetch(url);
  }

  getDataQuality(ticker, period = '5y') {
    return this._fetch(`/market/${encodeURIComponent(ticker)}/quality?period=${period}`);
  }

  // Strategies
  getStrategies() {
    return this._fetch('/strategies');
  }

  getStrategy(id) {
    return this._fetch(`/strategies/${id}`);
  }

  // Backtesting
  runBacktest(config) {
    return this._fetch('/backtest/run', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Robustness
  runTrainTest(config) {
    return this._fetch('/robustness/train-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  runStressTest(config) {
    return this._fetch('/robustness/stress-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  runSensitivity(config) {
    return this._fetch('/robustness/sensitivity', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  runWalkForward(config) {
    return this._fetch('/robustness/walk-forward', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  runMonteCarlo(config) {
    return this._fetch('/robustness/monte-carlo', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Compare
  compareStrategies(config) {
    return this._fetch('/compare', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

export const api = new ApiService();
export default api;
