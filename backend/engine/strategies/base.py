"""
Base Strategy Class — All strategies inherit from this.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List
import pandas as pd


class BaseStrategy(ABC):
    """Abstract base class for all trading strategies."""

    def __init__(self, parameters: Dict[str, Any] = None):
        self.parameters = parameters or {}
        self._apply_defaults()

    def _apply_defaults(self):
        """Apply default parameter values if not provided."""
        for p in self.get_parameters():
            if p["name"] not in self.parameters:
                self.parameters[p["name"]] = p["default"]

    @staticmethod
    @abstractmethod
    def info() -> Dict[str, Any]:
        """Return strategy metadata."""
        pass

    @staticmethod
    @abstractmethod
    def get_parameters() -> List[Dict[str, Any]]:
        """Return list of parameter definitions."""
        pass

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """
        Generate trading signals from OHLCV data.
        Returns a Series with values:
          1  = Buy signal
         -1  = Sell signal
          0  = No action / hold
        """
        pass

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        """Return indicator values for visualization (optional override)."""
        return {}
