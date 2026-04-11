"""
Backtest Engine — Core simulation loop with realistic execution.
Handles order execution, fees, slippage, position management, and trade logging.
"""

import uuid
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple

from .strategies.base import BaseStrategy
from .strategies.buy_hold import BuyHoldStrategy
from .strategies.ma_crossover import MACrossoverStrategy
from .strategies.rsi_reversion import RSIReversionStrategy
from .strategies.momentum import MomentumStrategy
from .strategies.bollinger import BollingerStrategy
from .strategies.macd import MACDStrategy
from .strategies.volatility_breakout import VolatilityBreakoutStrategy
from .strategies.ml_random_forest import MLRandomForestStrategy
from .strategies.builder import BuilderStrategy
from .strategies.supertrend import SuperTrendStrategy
from .strategies.parabolic_sar import ParabolicSARStrategy
from .strategies.donchian_breakout import DonchianBreakoutStrategy


# Strategy Registry
STRATEGY_REGISTRY = {
    "buy_hold": BuyHoldStrategy,
    "ma_crossover": MACrossoverStrategy,
    "rsi_reversion": RSIReversionStrategy,
    "momentum": MomentumStrategy,
    "bollinger": BollingerStrategy,
    "macd": MACDStrategy,
    "volatility_breakout": VolatilityBreakoutStrategy,
    "ml_random_forest": MLRandomForestStrategy,
    "custom_builder": BuilderStrategy,
    "supertrend": SuperTrendStrategy,
    "parabolic_sar": ParabolicSARStrategy,
    "donchian_breakout": DonchianBreakoutStrategy,
}


def get_strategy(strategy_id: str, parameters: Dict[str, Any] = None) -> BaseStrategy:
    """Instantiate a strategy by ID with given parameters."""
    if strategy_id not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy: {strategy_id}. Available: {list(STRATEGY_REGISTRY.keys())}")
    return STRATEGY_REGISTRY[strategy_id](parameters or {})


def get_all_strategies() -> List[Dict[str, Any]]:
    """Return metadata for all available strategies."""
    result = []
    for cls in STRATEGY_REGISTRY.values():
        info = cls.info()
        info["parameters"] = cls.get_parameters()
        result.append(info)
    return result


def run_backtest(
    df: pd.DataFrame,
    strategy: BaseStrategy,
    initial_capital: float = 10000.0,
    position_size: float = 1.0,
    commission: float = 0.001,
    slippage: float = 0.0005,
    reinvest: bool = True,
) -> Dict[str, Any]:
    """
    Execute a backtest simulation.

    Args:
        df: OHLCV DataFrame with columns: date, open, high, low, close, volume, returns
        strategy: Strategy instance
        initial_capital: Starting capital
        position_size: Fraction of capital to use per trade (0-1)
        commission: Commission as fraction (0.001 = 0.1%)
        slippage: Slippage as fraction (0.0005 = 0.05%)
        reinvest: Whether to reinvest profits

    Returns:
        Dictionary with equity curve, trades, signals, and KPIs
    """
    if len(df) < 2:
        raise ValueError("Insufficient data for backtesting")

    # Generate signals
    signals = strategy.generate_signals(df)
    indicator_values = strategy.get_indicator_values(df)

    # Simulation state
    cash = initial_capital
    position = 0.0          # Number of shares held
    position_value = 0.0
    entry_price = 0.0
    entry_date = None
    entry_reason = ""

    # Track results
    portfolio_values = []
    cash_values = []
    drawdown_values = []
    trades = []
    signal_log = []
    peak_value = initial_capital

    for i in range(len(df)):
        date = df["date"].iloc[i]
        close_price = df["close"].iloc[i]
        open_price = df["open"].iloc[i] if i > 0 else close_price
        signal = signals.iloc[i]

        # Execute at next bar's open (realistic execution)
        # For simplicity, we use current close with slippage penalty
        exec_price = close_price

        current_value = cash + position * close_price

        # Process signals
        if signal == 1 and position == 0:
            # BUY
            buy_price = exec_price * (1 + slippage)
            available = cash if reinvest else min(cash, initial_capital * position_size)
            invest_amount = available * position_size
            cost = invest_amount * commission
            shares = (invest_amount - cost) / buy_price

            if shares > 0 and invest_amount > 0:
                position = shares
                cash -= invest_amount
                entry_price = buy_price
                entry_date = date
                entry_reason = f"Signal: BUY"

                signal_log.append({
                    "date": str(date)[:10],
                    "signal": "BUY",
                    "price": round(buy_price, 2),
                    "shares": round(shares, 4),
                    "indicators": {k: round(float(v.iloc[i]), 4) if pd.notna(v.iloc[i]) else None
                                   for k, v in indicator_values.items()},
                })

        elif signal == -1 and position > 0:
            # SELL
            sell_price = exec_price * (1 - slippage)
            proceeds = position * sell_price
            cost = proceeds * commission
            cash += proceeds - cost

            pnl = (sell_price - entry_price) * position
            pnl_pct = (sell_price - entry_price) / entry_price if entry_price > 0 else 0

            holding_days = 0
            if entry_date is not None:
                try:
                    d1 = pd.Timestamp(date).tz_localize(None) if pd.Timestamp(date).tz else pd.Timestamp(date)
                    d2 = pd.Timestamp(entry_date).tz_localize(None) if pd.Timestamp(entry_date).tz else pd.Timestamp(entry_date)
                    holding_days = (d1 - d2).days
                except Exception:
                    holding_days = 0

            trades.append({
                "entry_date": str(entry_date)[:10] if entry_date else "",
                "exit_date": str(date)[:10],
                "entry_price": round(entry_price, 2),
                "exit_price": round(sell_price, 2),
                "quantity": round(position, 4),
                "side": "long",
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct * 100, 2),
                "entry_reason": entry_reason,
                "exit_reason": f"Signal: SELL",
                "holding_days": holding_days,
            })

            signal_log.append({
                "date": str(date)[:10],
                "signal": "SELL",
                "price": round(sell_price, 2),
                "shares": round(position, 4),
                "indicators": {k: round(float(v.iloc[i]), 4) if pd.notna(v.iloc[i]) else None
                               for k, v in indicator_values.items()},
            })

            position = 0
            entry_price = 0
            entry_date = None

        # Calculate portfolio value
        current_value = cash + position * close_price
        peak_value = max(peak_value, current_value)
        dd = (current_value - peak_value) / peak_value if peak_value > 0 else 0

        portfolio_values.append(current_value)
        cash_values.append(cash)
        drawdown_values.append(dd)

    # Build benchmark (Buy & Hold)
    benchmark_values = []
    if len(df) > 0:
        first_price = df["close"].iloc[0]
        benchmark_shares = initial_capital / first_price
        for i in range(len(df)):
            benchmark_values.append(benchmark_shares * df["close"].iloc[i])

    # Build result
    dates = [str(d)[:10] for d in df["date"]]

    result = {
        "id": str(uuid.uuid4())[:8],
        "ticker": "",  # Will be set by caller
        "strategy_id": strategy.info()["id"],
        "strategy_name": strategy.info()["name"],
        "parameters": strategy.parameters,
        "equity_curve": {
            "dates": dates,
            "portfolio_value": [round(v, 2) for v in portfolio_values],
            "benchmark_value": [round(v, 2) for v in benchmark_values],
            "drawdown": [round(v, 4) for v in drawdown_values],
            "cash": [round(v, 2) for v in cash_values],
        },
        "trades": trades,
        "signals": signal_log,
    }

    return result
