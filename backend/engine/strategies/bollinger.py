"""
Bollinger Bands Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import bollinger_bands, rsi


class BollingerStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "bollinger",
            "name": "Bollinger Bands",
            "category": "basic",
            "description": "Buy at the lower band, sell at the upper band. Classic volatility-based mean reversion.",
            "long_description": (
                "The Bollinger Bands strategy uses volatility-adjusted price channels to identify "
                "potential entry and exit points. When price touches or crosses below the lower band, "
                "it suggests the asset is oversold relative to recent volatility. When price reaches "
                "the upper band, it may be overbought. An optional RSI confirmation filter reduces "
                "false signals."
            ),
            "tags": ["mean-reversion", "volatility", "bollinger"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "bb_period", "label": "BB Period", "type": "int", "default": 20, "min": 10, "max": 50, "step": 1, "description": "Bollinger Bands lookback period"},
            {"name": "bb_std", "label": "BB Std Dev", "type": "float", "default": 2.0, "min": 1.0, "max": 3.0, "step": 0.1, "description": "Number of standard deviations"},
            {"name": "use_rsi_confirm", "label": "RSI Confirmation", "type": "bool", "default": False, "min": None, "max": None, "step": None, "description": "Require RSI confirmation for signals"},
            {"name": "rsi_period", "label": "RSI Period", "type": "int", "default": 14, "min": 5, "max": 30, "step": 1, "description": "RSI period for confirmation"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        period = int(self.parameters["bb_period"])
        std = float(self.parameters["bb_std"])

        upper, middle, lower = bollinger_bands(close, period, std)

        signals = pd.Series(0, index=df.index)

        buy_mask = close <= lower
        sell_mask = close >= upper

        if self.parameters.get("use_rsi_confirm", False):
            rsi_vals = rsi(close, int(self.parameters["rsi_period"]))
            buy_mask = buy_mask & (rsi_vals < 35)
            sell_mask = sell_mask & (rsi_vals > 65)

        signals[buy_mask] = 1
        signals[sell_mask] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        close = df["close"]
        period = int(self.parameters["bb_period"])
        std = float(self.parameters["bb_std"])
        upper, middle, lower = bollinger_bands(close, period, std)
        result = {
            "BB Upper": upper,
            "BB Middle": middle,
            "BB Lower": lower,
        }
        if self.parameters.get("use_rsi_confirm", False):
            result["RSI"] = rsi(close, int(self.parameters["rsi_period"]))
        return result
