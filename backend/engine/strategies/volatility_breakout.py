"""
Volatility Breakout Strategy
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy
from ..indicators import atr, sma, rolling_volatility


class VolatilityBreakoutStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "volatility_breakout",
            "name": "Volatility Breakout",
            "category": "basic",
            "description": "Enter when price breaks out of a volatility-based channel defined by ATR.",
            "long_description": (
                "The Volatility Breakout strategy enters trades when price moves beyond an "
                "ATR-based channel around a moving average. During quiet markets, the channel "
                "narrows, making breakouts more significant. During volatile markets, the channel "
                "widens, requiring larger moves to trigger signals. This adapts to changing market conditions."
            ),
            "tags": ["breakout", "volatility", "ATR", "adaptive"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "ma_period", "label": "MA Period", "type": "int", "default": 20, "min": 10, "max": 100, "step": 1, "description": "Moving average center of channel"},
            {"name": "atr_period", "label": "ATR Period", "type": "int", "default": 14, "min": 5, "max": 30, "step": 1, "description": "ATR calculation period"},
            {"name": "atr_multiplier", "label": "ATR Multiplier", "type": "float", "default": 2.0, "min": 0.5, "max": 4.0, "step": 0.1, "description": "Multiplier for channel width"},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        ma = sma(close, int(self.parameters["ma_period"]))
        atr_vals = atr(df["high"], df["low"], close, int(self.parameters["atr_period"]))
        mult = float(self.parameters["atr_multiplier"])

        upper_channel = ma + (atr_vals * mult)
        lower_channel = ma - (atr_vals * mult)

        signals = pd.Series(0, index=df.index)

        prev_close = close.shift(1)
        buy_mask = (close > upper_channel) & (prev_close <= upper_channel.shift(1))
        sell_mask = (close < lower_channel) & (prev_close >= lower_channel.shift(1))

        signals[buy_mask] = 1
        signals[sell_mask] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        close = df["close"]
        ma = sma(close, int(self.parameters["ma_period"]))
        atr_vals = atr(df["high"], df["low"], close, int(self.parameters["atr_period"]))
        mult = float(self.parameters["atr_multiplier"])
        return {
            "MA": ma,
            "Upper Channel": ma + (atr_vals * mult),
            "Lower Channel": ma - (atr_vals * mult),
        }
