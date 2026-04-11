"""
Parabolic SAR Strategy — Trend reversal indicator with acceleration factor.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List
from .base import BaseStrategy


class ParabolicSARStrategy(BaseStrategy):
    """
    Parabolic SAR strategy.
    Enters Buy when price crosses above the dot.
    Enters Sell when price crosses below the dot.
    """

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "parabolic_sar",
            "name": "Parabolic SAR",
            "description": "Stop and Reverse (SAR) indicator that trail the price as it trends, accelerating as the trend persists.",
            "category": "Trend",
            "icon": "🎈",
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {"name": "af_start", "label": "AF Start", "type": "float", "default": 0.02, "min": 0.01, "max": 0.1, "step": 0.01},
            {"name": "af_step", "label": "AF Step", "type": "float", "default": 0.02, "min": 0.01, "max": 0.1, "step": 0.01},
            {"name": "af_max", "label": "AF Max", "type": "float", "default": 0.2, "min": 0.05, "max": 1.0, "step": 0.01},
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        af_start = float(self.parameters.get("af_start", 0.02))
        af_step = float(self.parameters.get("af_step", 0.02))
        af_max = float(self.parameters.get("af_max", 0.2))

        # Basic Parabolic SAR calculation
        # Simplified manual calculation for reliability
        high = df["high"].values
        low = df["low"].values
        close = df["close"].values
        
        sar = [0.0] * len(df)
        direction = [1] * len(df) # 1 for Long, -1 for Short
        af = [af_start] * len(df)
        ep = [0.0] * len(df) # Extreme Point

        # Initial values
        direction[0] = 1
        sar[0] = low[0]
        ep[0] = high[0]

        for i in range(1, len(df)):
            # SAR(i) = SAR(i-1) + AF(i-1) * (EP(i-1) - SAR(i-1))
            sar[i] = sar[i-1] + af[i-1] * (ep[i-1] - sar[i-1])

            if direction[i-1] == 1:
                # Long
                if low[i] < sar[i]:
                    # Switch to Short
                    direction[i] = -1
                    sar[i] = ep[i-1]
                    ep[i] = low[i]
                    af[i] = af_start
                else:
                    direction[i] = 1
                    if high[i] > ep[i-1]:
                        ep[i] = high[i]
                        af[i] = min(af_max, af[i-1] + af_step)
                    else:
                        ep[i] = ep[i-1]
                        af[i] = af[i-1]
            else:
                # Short
                if high[i] > sar[i]:
                    # Switch to Long
                    direction[i] = 1
                    sar[i] = ep[i-1]
                    ep[i] = high[i]
                    af[i] = af_start
                else:
                    direction[i] = -1
                    if low[i] < ep[i-1]:
                        ep[i] = low[i]
                        af[i] = min(af_max, af[i-1] + af_step)
                    else:
                        ep[i] = ep[i-1]
                        af[i] = af[i-1]

        # Generate Signals
        signals = pd.Series(index=df.index, data=0)
        dir_series = pd.Series(index=df.index, data=direction)
        diff = dir_series.diff().fillna(0)
        
        signals[diff > 0] = 1
        signals[diff < 0] = -1

        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        # Reuse signal logic for sar dots
        af_start = float(self.parameters.get("af_start", 0.02))
        af_step = float(self.parameters.get("af_step", 0.02))
        af_max = float(self.parameters.get("af_max", 0.2))

        high = df["high"].values
        low = df["low"].values
        sar = [0.0] * len(df)
        direction = [1] * len(df)
        af = [af_start] * len(df)
        ep = [0.0] * len(df)

        sar[0] = low[0]
        ep[0] = high[0]

        for i in range(1, len(df)):
            sar[i] = sar[i-1] + af[i-1] * (ep[i-1] - sar[i-1])
            if direction[i-1] == 1:
                if low[i] < sar[i]:
                    direction[i] = -1
                    sar[i] = ep[i-1]
                    ep[i] = low[i]
                    af[i] = af_start
                else:
                    direction[i] = 1
                    if high[i] > ep[i-1]:
                        ep[i] = high[i]
                        af[i] = min(af_max, af[i-1] + af_step)
                    else:
                        ep[i] = ep[i-1]
                        af[i] = af[i-1]
            else:
                if high[i] > sar[i]:
                    direction[i] = 1
                    sar[i] = ep[i-1]
                    ep[i] = high[i]
                    af[i] = af_start
                else:
                    direction[i] = -1
                    if low[i] < ep[i-1]:
                        ep[i] = low[i]
                        af[i] = min(af_max, af[i-1] + af_step)
                    else:
                        ep[i] = ep[i-1]
                        af[i] = af[i-1]

        return {"sar": pd.Series(sar, index=df.index)}
