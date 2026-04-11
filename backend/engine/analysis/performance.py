"""
Performance Analysis Module — Calculate all KPIs from backtest results.
"""

import numpy as np
from typing import Dict, Any, List


def calculate_kpis(
    portfolio_values: List[float],
    benchmark_values: List[float],
    trades: List[Dict[str, Any]],
    initial_capital: float = 10000.0,
    trading_days_per_year: int = 252,
) -> Dict[str, Any]:
    """
    Calculate comprehensive KPIs from backtest results.

    Returns dict with all performance metrics.
    """
    pv = np.array(portfolio_values)
    bv = np.array(benchmark_values)

    if len(pv) < 2:
        return _empty_kpis()

    # Returns
    daily_returns = np.diff(pv) / pv[:-1]
    daily_returns = daily_returns[np.isfinite(daily_returns)]

    if len(daily_returns) == 0:
        return _empty_kpis()

    # Total return
    total_return = (pv[-1] - initial_capital) / initial_capital

    # Annualized return
    n_days = len(pv)
    n_years = n_days / trading_days_per_year
    if n_years > 0 and pv[-1] > 0 and initial_capital > 0:
        annualized_return = (pv[-1] / initial_capital) ** (1 / n_years) - 1
    else:
        annualized_return = 0

    # Volatility
    daily_vol = float(np.std(daily_returns, ddof=1)) if len(daily_returns) > 1 else 0
    annualized_vol = daily_vol * np.sqrt(trading_days_per_year)

    # Sharpe Ratio (assuming risk-free rate = 0 for simplicity)
    mean_daily_return = float(np.mean(daily_returns))
    sharpe = (mean_daily_return / daily_vol * np.sqrt(trading_days_per_year)) if daily_vol > 0 else 0

    # Sortino Ratio
    downside_returns = daily_returns[daily_returns < 0]
    downside_vol = float(np.std(downside_returns, ddof=1)) if len(downside_returns) > 1 else 0
    sortino = (mean_daily_return / downside_vol * np.sqrt(trading_days_per_year)) if downside_vol > 0 else 0

    # Max Drawdown
    peak = np.maximum.accumulate(pv)
    drawdowns = (pv - peak) / peak
    max_drawdown = float(np.min(drawdowns))

    # Calmar Ratio
    calmar = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0

    # Trade stats
    n_trades = len(trades)
    if n_trades > 0:
        pnls = [t["pnl"] for t in trades]
        pnl_pcts = [t["pnl_pct"] for t in trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]

        win_rate = len(wins) / n_trades
        avg_win = float(np.mean([p for p in pnl_pcts if p > 0])) if wins else 0
        avg_loss = float(np.mean([p for p in pnl_pcts if p <= 0])) if losses else 0
        best_trade = float(max(pnl_pcts)) if pnl_pcts else 0
        worst_trade = float(min(pnl_pcts)) if pnl_pcts else 0

        # Profit Factor
        total_gains = sum(p for p in pnls if p > 0)
        total_losses = abs(sum(p for p in pnls if p < 0))
        profit_factor = total_gains / total_losses if total_losses > 0 else float('inf') if total_gains > 0 else 0

        # Avg trade duration
        holding_days = [t.get("holding_days", 0) for t in trades]
        avg_duration = float(np.mean(holding_days)) if holding_days else 0

        # Consecutive wins/losses
        max_consec_wins = _max_consecutive(pnls, lambda x: x > 0)
        max_consec_losses = _max_consecutive(pnls, lambda x: x <= 0)
    else:
        win_rate = 0
        profit_factor = 0
        avg_duration = 0
        avg_win = 0
        avg_loss = 0
        best_trade = 0
        worst_trade = 0
        max_consec_wins = 0
        max_consec_losses = 0

    # Market exposure (fraction of time in position)
    # Estimate from portfolio changes vs benchmark
    market_exposure = n_trades * avg_duration / n_days if n_days > 0 else 0
    market_exposure = min(market_exposure, 1.0)

    # Final Sanitization: Ensure all values are JSON-serializable (no NaN/Inf)
    res = {
        "total_return": round(total_return * 100, 2),
        "annualized_return": round(annualized_return * 100, 2),
        "annualized_volatility": round(annualized_vol * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "max_drawdown": round(max_drawdown * 100, 2),
        "calmar_ratio": round(calmar, 2),
        "win_rate": round(win_rate * 100, 1),
        "profit_factor": round(profit_factor, 2) if (profit_factor != float('inf') and not np.isnan(profit_factor)) else 999.99,
        "total_trades": n_trades,
        "avg_trade_duration": round(avg_duration, 1),
        "market_exposure": round(market_exposure * 100, 1),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        "max_consecutive_wins": max_consec_wins,
        "max_consecutive_losses": max_consec_losses,
    }
    
    # Global replacement for any lingering NaNs
    for k, v in res.items():
        if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
            res[k] = 0.0
            
    return res


def _max_consecutive(values: List[float], condition) -> int:
    """Count maximum consecutive items satisfying condition."""
    max_count = 0
    current = 0
    for v in values:
        if condition(v):
            current += 1
            max_count = max(max_count, current)
        else:
            current = 0
    return max_count


def _empty_kpis() -> Dict[str, Any]:
    """Return empty KPIs for edge cases."""
    return {
        "total_return": 0, "annualized_return": 0, "annualized_volatility": 0,
        "sharpe_ratio": 0, "sortino_ratio": 0, "max_drawdown": 0,
        "calmar_ratio": 0, "win_rate": 0, "profit_factor": 0,
        "total_trades": 0, "avg_trade_duration": 0, "market_exposure": 0,
        "avg_win": 0, "avg_loss": 0, "best_trade": 0, "worst_trade": 0,
        "max_consecutive_wins": 0, "max_consecutive_losses": 0,
    }


def calculate_rolling_sharpe(portfolio_values: List[float], window: int = 63) -> List[float]:
    """Calculate rolling Sharpe ratio (quarterly window by default)."""
    pv = np.array(portfolio_values)
    returns = np.diff(pv) / pv[:-1]
    rolling = []

    for i in range(len(returns)):
        if i < window:
            rolling.append(None)
        else:
            window_returns = returns[i - window:i]
            mean_r = np.mean(window_returns)
            std_r = np.std(window_returns, ddof=1)
            sharpe = (mean_r / std_r * np.sqrt(252)) if std_r > 0 else 0
            rolling.append(round(sharpe, 2))

    return rolling


def calculate_monthly_returns(dates: List[str], portfolio_values: List[float]) -> Dict[str, Dict[str, float]]:
    """Calculate monthly returns for heatmap display."""
    import pandas as pd

    df = pd.DataFrame({"date": pd.to_datetime(dates), "value": portfolio_values})
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month

    monthly = {}
    for (year, month), group in df.groupby(["year", "month"]):
        start_val = group["value"].iloc[0]
        end_val = group["value"].iloc[-1]
        ret = (end_val - start_val) / start_val * 100 if start_val > 0 else 0
        year_str = str(year)
        if year_str not in monthly:
            monthly[year_str] = {}
        monthly[year_str][str(month)] = round(ret, 2)

    return monthly
