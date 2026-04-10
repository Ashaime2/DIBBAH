"""
RSI Mean Reversion Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import rsi, sma


class RSIReversionStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "rsi_reversion",
            "name": "RSI Mean Reversion",
            "category": "basic",
            "description": "Buy when RSI indicates oversold, sell when overbought. Classic mean-reversion.",
            "long_description": (
                "The RSI Mean Reversion strategy exploits the tendency of prices to revert to their "
                "mean after extreme moves. When the RSI drops below the oversold threshold, it signals "
                "a potential buying opportunity. When RSI rises above the overbought threshold, it "
                "suggests the asset is overextended and may pull back. An optional trend filter "
                "(price above/below a long-term MA) can be added to avoid fighting the trend."
            ),
            "tags": ["mean-reversion", "oscillator", "RSI"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "rsi_period", "label": "RSI Period", "type": "int", "default": 14, "min": 5, "max": 50, "step": 1, "description": "RSI lookback window"},
            {"name": "oversold", "label": "Oversold Threshold", "type": "int", "default": 30, "min": 10, "max": 45, "step": 1, "description": "Buy when RSI drops below this level"},
            {"name": "overbought", "label": "Overbought Threshold", "type": "int", "default": 70, "min": 55, "max": 90, "step": 1, "description": "Sell when RSI rises above this level"},
            {"name": "use_trend_filter", "label": "Use Trend Filter", "type": "bool", "default": False, "min": None, "max": None, "step": None, "description": "Only buy if price is above 200-day MA"},
            {"name": "trend_ma_period", "label": "Trend MA Period", "type": "int", "default": 200, "min": 50, "max": 300, "step": 10, "description": "MA period for trend filter"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        rsi_vals = rsi(close, int(self.parameters["rsi_period"]))
        oversold = int(self.parameters["oversold"])
        overbought = int(self.parameters["overbought"])

        signals = pd.Series(0, index=df.index)

        buy_mask = rsi_vals < oversold
        sell_mask = rsi_vals > overbought

        if self.parameters.get("use_trend_filter", False):
            trend_ma = sma(close, int(self.parameters["trend_ma_period"]))
            buy_mask = buy_mask & (close > trend_ma)

        signals[buy_mask] = 1
        signals[sell_mask] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        close = df["close"]
        rsi_vals = rsi(close, int(self.parameters["rsi_period"]))
        result = {"RSI": rsi_vals}
        if self.parameters.get("use_trend_filter", False):
            result[f"Trend MA ({self.parameters['trend_ma_period']})"] = sma(close, int(self.parameters["trend_ma_period"]))
        return result
