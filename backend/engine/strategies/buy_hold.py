"""
Buy & Hold Strategy — Simplest baseline benchmark.
"""

import pandas as pd
from typing import Dict, Any, List
from .base import BaseStrategy


class BuyHoldStrategy(BaseStrategy):

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "buy_hold",
            "name": "Buy & Hold",
            "category": "basic",
            "description": "Buy at the start and hold until the end. The ultimate passive benchmark.",
            "long_description": (
                "The Buy & Hold strategy purchases the asset on the first available day "
                "and holds it for the entire period. This is the simplest and most common "
                "benchmark against which all active strategies should be compared. "
                "If your strategy cannot beat Buy & Hold, it adds no value."
            ),
            "tags": ["benchmark", "passive", "long-only"],
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return []  # No configurable parameters

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        signals = pd.Series(0, index=df.index)
        if len(df) > 0:
            signals.iloc[0] = 1  # Buy on first day
        return signals
