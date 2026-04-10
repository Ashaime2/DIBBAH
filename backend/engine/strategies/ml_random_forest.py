import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier

from .base import BaseStrategy

class MLRandomForestStrategy(BaseStrategy):
    """
    Machine Learning: Random Forest Classifier
    Trains a Random Forest model on technical indicators to predict tomorrow's direction.
    """

    @staticmethod
    def info() -> Dict[str, Any]:
        return {
            "id": "ml_random_forest",
            "name": "AI Random Forest",
            "description": "Uses machine learning (Random Forest) trained on technical features to predict future market direction.",
        }

    @staticmethod
    def get_parameters() -> List[Dict[str, Any]]:
        return [
            {
                "name": "lookback_window",
                "label": "Train Window (Days)",
                "type": "slider",
                "min": 50,
                "max": 500,
                "default": 200,
                "step": 10
            },
            {
                "name": "n_estimators",
                "label": "Forest Size (Trees)",
                "type": "slider",
                "min": 10,
                "max": 100,
                "default": 30,
                "step": 10
            }
        ]

    def _add_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators to use as ML features."""
        data = df.copy()
        
        # 1. Price Momentum
        data['ret_1d'] = data['close'].pct_change(1)
        data['ret_5d'] = data['close'].pct_change(5)
        
        # 2. Moving Average Distance
        data['ma_10'] = data['close'].rolling(10).mean()
        data['ma_50'] = data['close'].rolling(50).mean()
        data['dist_ma10'] = (data['close'] - data['ma_10']) / data['ma_10']
        data['dist_ma50'] = (data['close'] - data['ma_50']) / data['ma_50']
        
        # 3. Volatility
        data['vol_20'] = data['ret_1d'].rolling(20).std()
        
        # Target: Tomorrow's return > 0 ? 1 : -1
        data['target'] = np.where(data['ret_1d'].shift(-1) > 0, 1, -1)
        
        return data

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        lookback = int(self.parameters["lookback_window"])
        trees = int(self.parameters["n_estimators"])
        
        # Generate features
        data = self._add_features(df)
        features = ['ret_1d', 'ret_5d', 'dist_ma10', 'dist_ma50', 'vol_20']
        
        # Drop initial NaNs from indicators
        data = data.dropna(subset=features)
        
        # Output signals array
        signals = pd.Series(0, index=df.index)
        
        # Only start predicting after we have enough data (lookback)
        start_idx = df.index.get_loc(data.index[0]) + lookback
        
        # Train model periodically to save time (once a week = 5 days)
        rf = RandomForestClassifier(n_estimators=trees, max_depth=5, random_state=42, n_jobs=-1)
        
        last_train_idx = 0
        
        # To avoid massive loops in python, we'll do an expanding window every 20 days
        # This keeps the UI responsive
        predict_intervals = list(range(lookback, len(data), 20))
        if len(data) not in predict_intervals:
            predict_intervals.append(len(data))
            
        for i in range(len(predict_intervals) - 1):
            train_end = predict_intervals[i]
            predict_start = predict_intervals[i]
            predict_end = predict_intervals[i+1]
            
            # Train on [train_end - lookback : train_end]
            train_start = max(0, train_end - lookback)
            train_data = data.iloc[train_start:train_end]
            
            X_train = train_data[features]
            y_train = train_data['target']
            
            # Fit model
            try:
                rf.fit(X_train, y_train)
                
                # Predict for the next interval
                X_predict = data.iloc[predict_start:predict_end][features]
                preds = rf.predict(X_predict)
                
                # Map predictions to original df index
                pred_indices = data.index[predict_start:predict_end]
                signals.loc[pred_indices] = preds
            except Exception:
                pass # If model fails to fit (e.g., all 1 class), output stays 0
                
        return signals

    def get_indicator_values(self, df: pd.DataFrame) -> Dict[str, pd.Series]:
        """Expose an AI confidence metric if needed."""
        # For simplicity, returning empty
        return {}
