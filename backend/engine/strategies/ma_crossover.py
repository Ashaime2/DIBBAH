"""
Moving Average Crossover Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import sma, ema


class MACrossoverStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "ma_crossover",
            "name": "Moving Average Crossover",
            "category": "basic",
            "description": "Buy when the fast MA crosses above the slow MA, sell on the opposite cross.",
            "long_description": (
                "The Moving Average Crossover strategy is one of the most popular trend-following "
                "approaches. It generates a buy signal when a short-term moving average crosses above "
                "a long-term moving average (golden cross), indicating upward momentum. A sell signal "
                "occurs on the opposite crossover (death cross). The strategy can use Simple (SMA) "
                "or Exponential (EMA) moving averages."
            ),
            "tags": ["trend-following", "moving-average", "crossover"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "fast_period", "label": "Fast MA Period", "type": "int", "default": 20, "min": 5, "max": 100, "step": 1, "description": "Short-term moving average window"},
            {"name": "slow_period", "label": "Slow MA Period", "type": "int", "default": 50, "min": 20, "max": 300, "step": 1, "description": "Long-term moving average window"},
            {"name": "ma_type", "label": "MA Type", "type": "str", "default": "sma", "min": None, "max": None, "step": None, "description": "Type of moving average: sma or ema"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        fast_p = int(self.parameters["fast_period"])
        slow_p = int(self.parameters["slow_period"])
        ma_type = self.parameters.get("ma_type", "sma")

        ma_func = ema if ma_type == "ema" else sma
        fast_ma = ma_func(close, fast_p)
        slow_ma = ma_func(close, slow_p)

        signals = pd.Series(0, index=df.index)

        # Generate crossover signals
        prev_fast = fast_ma.shift(1)
        prev_slow = slow_ma.shift(1)

        # Golden cross: fast crosses above slow
        buy_signal = (fast_ma > slow_ma) & (prev_fast <= prev_slow)
        # Death cross: fast crosses below slow
        sell_signal = (fast_ma < slow_ma) & (prev_fast >= prev_slow)

        signals[buy_signal] = 1
        signals[sell_signal] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        close = df["close"]
        fast_p = int(self.parameters["fast_period"])
        slow_p = int(self.parameters["slow_period"])
        ma_type = self.parameters.get("ma_type", "sma")
        ma_func = ema if ma_type == "ema" else sma
        return {
            f"Fast MA ({fast_p})": ma_func(close, fast_p),
            f"Slow MA ({slow_p})": ma_func(close, slow_p),
        }
