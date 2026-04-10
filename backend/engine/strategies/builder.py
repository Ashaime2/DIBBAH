import pandas as pd
import numpy as np
from typing import Dict, Any, List

from .base import BaseStrategy

class BuilderStrategy(BaseStrategy):
    """
    Visual Builder Strategy
    Executes a dynamic JSON tree of technical conditions.
    """

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "custom_builder",
            "name": "Custom Builder",
            "description": "A customized strategy built from visual logic blocks.",
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        # The frontend will inject a custom JSON object into 'rules_json'
        return [
            {
                "name": "rules",
                "label": "Rules Configuration",
                "type": "json",
                "default": {
                    "entry_logic": "AND",
                    "entry_conditions": [],
                    "exit_logic": "OR",
                    "exit_conditions": []
                }
            }
        ]

    def _ensure_indicator(self, df: pd.DataFrame, indicator_str: str):
        if indicator_str in df.columns or indicator_str == "PRICE":
            return
            
        parts = indicator_str.split("_")
        base = parts[0]
        
        if base == "SMA" and len(parts) == 2:
            period = int(parts[1])
            df[indicator_str] = df['close'].rolling(window=period).mean()
            
        elif base == "EMA" and len(parts) == 2:
            period = int(parts[1])
            df[indicator_str] = df['close'].ewm(span=period, adjust=False).mean()
            
        elif base == "RSI" and len(parts) == 2:
            period = int(parts[1])
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            df[indicator_str] = 100 - (100 / (1 + rs))
            
        elif base == "MACD":
            # Just a simple MACD line for demonstration
            exp1 = df['close'].ewm(span=12, adjust=False).mean()
            exp2 = df['close'].ewm(span=26, adjust=False).mean()
            df[indicator_str] = exp1 - exp2

    def _evaluate_conditions(self, df: pd.DataFrame, conditions: List[Dict], logic: str) -> pd.Series:
        if not conditions:
            # If no rules, return False
            return pd.Series(False, index=df.index)
            
        # Initialize master mask
        master_mask = pd.Series(True, index=df.index) if logic == "AND" else pd.Series(False, index=df.index)
        
        for cond in conditions:
            left_id = cond.get("left")
            op = cond.get("operator")
            right_type = cond.get("right_type", "number")
            right_val = cond.get("right")
            
            if not left_id or not op or right_val is None:
                continue
                
            # Prepare left operand
            if left_id == "PRICE":
                left_series = df['close']
            else:
                self._ensure_indicator(df, left_id)
                left_series = df[left_id]
                
            # Prepare right operand
            if right_type == "indicator":
                if right_val == "PRICE":
                    right_series = df['close']
                else:
                    self._ensure_indicator(df, right_val)
                    right_series = df[right_val]
            else:
                right_series = float(right_val)
                
            # Evaluate
            if op == ">":
                mask = left_series > right_series
            elif op == "<":
                mask = left_series < right_series
            elif op == ">=":
                mask = left_series >= right_series
            elif op == "<=":
                mask = left_series <= right_series
            elif op == "==":
                mask = left_series == right_series
            else:
                mask = pd.Series(False, index=df.index)
                
            # Combine
            if logic == "AND":
                master_mask = master_mask & mask
            else:
                master_mask = master_mask | mask
                
        return master_mask

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        rules = self.parameters.get("rules", {})
        
        if isinstance(rules, str):
            import json
            try:
                rules = json.loads(rules)
            except Exception:
                rules = {}
                
        entry_conds = rules.get("entry_conditions", [])
        entry_logic = rules.get("entry_logic", "AND")
        
        exit_conds = rules.get("exit_conditions", [])
        exit_logic = rules.get("exit_logic", "OR")
        
        # Working copy
        data = df.copy()
        
        # Determine masks
        buy_mask = self._evaluate_conditions(data, entry_conds, entry_logic)
        sell_mask = self._evaluate_conditions(data, exit_conds, exit_logic)
        
        # Generate signal series
        signals = pd.Series(0, index=df.index)
        
        # In a real engine, we buy on mask=True, and hold until sell_mask=True.
        # But this backtest_engine iterates date by date, taking:
        # signal = 1 (BUY), signal = -1 (SELL)
        # So we just assign the masks directly.
        signals[buy_mask] = 1
        signals[sell_mask] = -1
        
        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        return {}
