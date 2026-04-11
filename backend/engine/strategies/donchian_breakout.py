"""
Donchian Breakout Strategy — Classic "Turtle Trading" breakout system.
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy


class DonchianBreakoutStrategy(BaseStrategy):
    """
    Donchian Channel Breakout strategy.
    Enters Buy when price breaks above the N-period High.
    Exits Buy when price breaks below the M-period Low.
    """

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "donchian_breakout",
            "name": "Donchian Breakout",
            "description": "The foundation of the Turtle Trading system. Buys on price breakouts of the N-period range.",
            "category": "Breakout",
            "icon": "🐢",
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "period", "label": "Breakout Period", "type": "int", "default": 20, "min": 5, "max": 100, "step": 1},
            {"name": "exit_period", "label": "Exit Period", "type": "int", "default": 10, "min": 2, "max": 50, "step": 1},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        period = int(self.parameters.get("period", 20))
        exit_period = int(self.parameters.get("exit_period", 10))

        # Donchian Channels
        # Use shift() to avoid look-ahead bias (we must break the PREVIOUS n-day high)
        upper_channel = df["high"].rolling(window=period).max().shift(1)
        lower_channel = df["low"].rolling(window=exit_period).min().shift(1)

        signals = pd.Series(index=df.index, data=0)
        
        # State tracking for position
        in_position = False
        
        for i in range(1, len(df)):
            if not in_position:
                if df["high"].iloc[i] > upper_channel.iloc[i]:
                    signals.iloc[i] = 1
                    in_position = True
            else:
                if df["low"].iloc[i] < lower_channel.iloc[i]:
                    signals.iloc[i] = -1
                    in_position = False

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        period = int(self.parameters.get("period", 20))
        exit_period = int(self.parameters.get("exit_period", 10))

        upper = df["high"].rolling(window=period).max()
        lower = df["low"].rolling(window=exit_period).min()
        
        return {
            "upper_donchian": upper,
            "lower_donchian": lower
        }
