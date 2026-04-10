"""
MACD Trend-Following Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import macd as macd_indicator, sma


class MACDStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "macd",
            "name": "MACD Trend Following",
            "category": "basic",
            "description": "Follow trends using MACD line crossovers with optional histogram confirmation.",
            "long_description": (
                "The MACD (Moving Average Convergence Divergence) strategy identifies trend changes "
                "using the relationship between two exponential moving averages. A buy signal occurs "
                "when the MACD line crosses above the signal line, indicating bullish momentum. "
                "A sell signal triggers on the opposite cross. The histogram can provide additional "
                "confirmation of trend strength."
            ),
            "tags": ["trend-following", "MACD", "momentum"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "fast_period", "label": "Fast EMA", "type": "int", "default": 12, "min": 5, "max": 30, "step": 1, "description": "Fast EMA period"},
            {"name": "slow_period", "label": "Slow EMA", "type": "int", "default": 26, "min": 15, "max": 60, "step": 1, "description": "Slow EMA period"},
            {"name": "signal_period", "label": "Signal Period", "type": "int", "default": 9, "min": 3, "max": 20, "step": 1, "description": "Signal line smoothing period"},
            {"name": "use_histogram", "label": "Histogram Filter", "type": "bool", "default": False, "min": None, "max": None, "step": None, "description": "Only trade when histogram confirms direction"},
            {"name": "use_zero_line", "label": "Zero Line Filter", "type": "bool", "default": False, "min": None, "max": None, "step": None, "description": "Only buy above zero line, sell below"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        fast = int(self.parameters["fast_period"])
        slow = int(self.parameters["slow_period"])
        sig = int(self.parameters["signal_period"])

        macd_line, signal_line, histogram = macd_indicator(close, fast, slow, sig)

        signals = pd.Series(0, index=df.index)

        prev_macd = macd_line.shift(1)
        prev_signal = signal_line.shift(1)

        buy_mask = (macd_line > signal_line) & (prev_macd <= prev_signal)
        sell_mask = (macd_line < signal_line) & (prev_macd >= prev_signal)

        if self.parameters.get("use_histogram", False):
            buy_mask = buy_mask & (histogram > 0)
            sell_mask = sell_mask & (histogram < 0)

        if self.parameters.get("use_zero_line", False):
            buy_mask = buy_mask & (macd_line > 0)
            sell_mask = sell_mask & (macd_line < 0)

        signals[buy_mask] = 1
        signals[sell_mask] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        close = df["close"]
        fast = int(self.parameters["fast_period"])
        slow = int(self.parameters["slow_period"])
        sig = int(self.parameters["signal_period"])
        macd_line, signal_line, histogram = macd_indicator(close, fast, slow, sig)
        return {
            "MACD": macd_line,
            "Signal": signal_line,
            "Histogram": histogram,
        }
