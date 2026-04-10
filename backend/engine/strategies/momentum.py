"""
Momentum Breakout Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import sma, atr, momentum as mom_indicator


class MomentumStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "momentum",
            "name": "Momentum Breakout",
            "category": "basic",
            "description": "Buy when price breaks above recent highs with strong momentum.",
            "long_description": (
                "The Momentum Breakout strategy captures trending moves by entering when price "
                "breaks above its recent high (lookback period). It uses momentum (rate of change) "
                "as confirmation and exits when momentum turns negative or price falls below "
                "a trailing stop. This is a classic trend-following approach."
            ),
            "tags": ["momentum", "breakout", "trend-following"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "lookback", "label": "Lookback Period", "type": "int", "default": 20, "min": 5, "max": 100, "step": 1, "description": "Period for determining breakout level"},
            {"name": "momentum_period", "label": "Momentum Period", "type": "int", "default": 10, "min": 3, "max": 50, "step": 1, "description": "Rate of change lookback"},
            {"name": "momentum_threshold", "label": "Momentum Threshold", "type": "float", "default": 0.0, "min": -0.05, "max": 0.10, "step": 0.005, "description": "Minimum momentum for entry"},
            {"name": "exit_lookback", "label": "Exit Lookback", "type": "int", "default": 10, "min": 3, "max": 50, "step": 1, "description": "Period for trailing low (exit)"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        high = df["high"]
        low = df["low"]
        lookback = int(self.parameters["lookback"])
        mom_period = int(self.parameters["momentum_period"])
        mom_thresh = float(self.parameters["momentum_threshold"])
        exit_lb = int(self.parameters["exit_lookback"])

        rolling_high = high.rolling(window=lookback, min_periods=lookback).max().shift(1)
        rolling_low = low.rolling(window=exit_lb, min_periods=exit_lb).min().shift(1)
        mom = mom_indicator(close, mom_period)

        signals = pd.Series(0, index=df.index)

        buy_mask = (close > rolling_high) & (mom > mom_thresh)
        sell_mask = close < rolling_low

        signals[buy_mask] = 1
        signals[sell_mask] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        lookback = int(self.parameters["lookback"])
        mom_period = int(self.parameters["momentum_period"])
        return {
            f"High ({lookback})": df["high"].rolling(window=lookback, min_periods=lookback).max().shift(1),
            f"Momentum ({mom_period})": mom_indicator(df["close"], mom_period),
        }
