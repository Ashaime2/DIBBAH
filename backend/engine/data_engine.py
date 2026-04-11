"""
Data Engine — Fetch, clean, cache, and analyze market data via yfinance
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

import numpy as np
import pandas as pd
import yfinance as yf
import requests
from yahooquery import Ticker

yf_session = requests.Session()
yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/quote/QQQ"
})

from .database import save_market_data, load_market_data


def detect_asset_class(ticker: str) -> str:
    """Detect asset class from ticker format."""
    ticker_upper = ticker.upper()
    if ticker_upper.endswith("-USD") or ticker_upper in ("BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD"):
        return "Crypto"
    if "=" in ticker_upper or ticker_upper in ("EURUSD", "GBPUSD", "USDJPY"):
        return "Forex"
    if ticker_upper in ("SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "EEM", "GLD", "SLV", "TLT"):
        return "ETF"
    if ticker_upper.startswith("^"):
        return "Index"
    return "Stock"


def fetch_market_data(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    # Try loading from local database first
    cached_df = load_market_data(ticker, interval, start_date, end_date)
    
    # Simple check: if we have enough rows for the period, use it.
    # A standard "5y" query expects ~1250 rows. Let's say if we have >1000 rows we consider it fulfilled.
    # In a full prod system, we would accurately check if the exact dates are present.
    # For now, if the df is not empty and covers a reasonable amount of data, we return it.
    if not cached_df.empty and len(cached_df) > 200:
        # Standardize potentially duplicated columns in cache
        if "close" in cached_df.columns:
            # If multiple "close" columns exist, keep only the first one
            cols = pd.Series(cached_df.columns)
            for dupe in cols[cols.duplicated()].unique():
                cols[cols == dupe] = [f"{dupe}_{i}" if i != 0 else dupe for i in range(len(cols[cols == dupe]))]
            cached_df.columns = cols
            
        # Calculate returns missing from database
        # Use values.flatten() to ensure we are assigning a 1D array
        close_series = cached_df["close"]
        if isinstance(close_series, pd.DataFrame):
            close_series = close_series.iloc[:, 0]
        cached_df["returns"] = close_series.pct_change()
        return cached_df


    try:
        # Step 1: Try yahooquery (usually more reliable on cloud environments)
        yq_ticker = Ticker(ticker, session=yf_session)
        if start_date and end_date:
            df = yq_ticker.history(start=start_date, end=end_date, interval=interval)
        else:
            df = yq_ticker.history(period=period, interval=interval)
        
        # Check if yahooquery returned data
        if isinstance(df, pd.DataFrame) and not df.empty:
            if isinstance(df.index, pd.MultiIndex):
                df = df.reset_index()
            elif df.index.name == 'date':
                df = df.reset_index()
                
            # Rename columns to match our standard
            df = df.rename(columns={'adjclose': 'close'})
        else:
            # Step 2: Fallback to yfinance if yahooquery failed
            if start_date and end_date:
                df = yf.download(ticker, start=start_date, end=end_date, interval=interval, progress=False, session=yf_session)
            else:
                df = yf.download(ticker, period=period, interval=interval, progress=False, session=yf_session)
    except Exception as e:
        # Final Fallback Attempt with yfinance if everything above crashed
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False, session=yf_session)
        except Exception:
            raise ValueError(f"Failed to fetch data for {ticker}: {str(e)}")

    if df.empty:
        raise ValueError(f"No data found for ticker: {ticker}")

    # HANDLE MULTI-INDEX (from yahooquery or yfinance)
    if isinstance(df.index, pd.MultiIndex) or df.index.name in ['date', 'datetime']:
        df = df.reset_index()

    # Standardize column names to lowercase
    df.columns = [str(col).lower().replace(" ", "_").replace("adj_close", "close") for col in df.columns]

    # Map yahooquery 'adjclose' to 'close' if 'close' is not already what we want
    if 'adjclose' in df.columns:
        df = df.rename(columns={'adjclose': 'close'})

    # Ensure we have a 'date' column
    if 'datetime' in df.columns and 'date' not in df.columns:
        df = df.rename(columns={'datetime': 'date'})

    # Keep only what we need and in specific order to avoid any surprises
    required = ["date", "open", "high", "low", "close", "volume"]
    for col in required:
        if col not in df.columns:
             # Look for capitalized versions if lowercase failed
             for existing in df.columns:
                 if existing.lower() == col:
                     df = df.rename(columns={existing: col})
                     break
    
    # Final check for missing columns
    available = list(df.columns)
    missing = [c for c in required if c not in available]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Available: {available}")

    df = df[required].copy()

    # NORMALIZE DATES (The absolute fix for "can't compare datetime.datetime to datetime.date")
    # We force every date to be a timezone-naive pd.Timestamp
    df["date"] = pd.to_datetime(df["date"])
    if df["date"].dt.tz is not None:
        df["date"] = df["date"].dt.tz_localize(None)

    # Clean data types
    df = df.dropna(subset=["open", "high", "low", "close"])
    # Replace any NaN or Inf in the OHLCV columns with 0
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].replace([np.inf, -np.inf], np.nan).fillna(0)
    
    df = df.sort_values("date").reset_index(drop=True)

    # Save to Database
    save_market_data(df, ticker, interval)

    # Calculate returns
    # Use iloc[:, 0] if duplicate columns somehow still exist
    close_series = df["close"]
    if isinstance(close_series, pd.DataFrame):
        close_series = close_series.iloc[:, 0]
    df["returns"] = close_series.pct_change()
    df["cum_returns"] = (1 + df["returns"].fillna(0)).cumprod()

    return df


def get_ticker_name(ticker: str) -> str:
    """Get the full name of a ticker."""
    # Use local database first for speed
    common_names = {
        "SPY": "SPDR S&P 500 ETF Trust", "QQQ": "Invesco QQQ Trust",
        "AAPL": "Apple Inc.", "MSFT": "Microsoft Corporation",
        "GOOGL": "Alphabet Inc.", "AMZN": "Amazon.com Inc.",
        "NVDA": "NVIDIA Corporation", "META": "Meta Platforms Inc.",
        "TSLA": "Tesla Inc.", "BTC-USD": "Bitcoin USD",
        "ETH-USD": "Ethereum USD", "GLD": "SPDR Gold Shares",
        "IWM": "iShares Russell 2000 ETF", "DIA": "SPDR Dow Jones ETF",
        "VOO": "Vanguard S&P 500 ETF", "VTI": "Vanguard Total Stock Market ETF",
        "TLT": "iShares 20+ Year Treasury Bond ETF",
    }
    if ticker.upper() in common_names:
        return common_names[ticker.upper()]
    try:
        tk = yf.Ticker(ticker, session=yf_session)
        info = tk.info
        return info.get("longName", info.get("shortName", ticker))
    except Exception:
        return ticker


def compute_data_quality(df: pd.DataFrame, ticker: str, interval: str) -> Dict[str, Any]:
    """Compute data quality report for a dataset."""
    total_points = len(df)
    close = df["close"]
    returns = df["returns"].dropna()

    # Missing values
    total_cells = df[["open", "high", "low", "close", "volume"]].size
    missing = df[["open", "high", "low", "close", "volume"]].isna().sum().sum()
    missing_pct = (missing / total_cells * 100) if total_cells > 0 else 0

    # Date range
    start_date = str(df["date"].iloc[0].date()) if len(df) > 0 else "N/A"
    end_date = str(df["date"].iloc[-1].date()) if len(df) > 0 else "N/A"

    # Stats
    avg_return = float(returns.mean()) if len(returns) > 0 else 0
    daily_vol = float(returns.std()) if len(returns) > 0 else 0
    annual_vol = daily_vol * np.sqrt(252)

    # Outliers (returns beyond 3 standard deviations)
    if len(returns) > 0 and daily_vol > 0:
        z_scores = np.abs((returns - returns.mean()) / daily_vol)
        outlier_count = int((z_scores > 3).sum())
    else:
        outlier_count = 0

    # Quality score
    if missing_pct < 0.1 and total_points > 1000:
        quality = "Excellent"
    elif missing_pct < 1 and total_points > 500:
        quality = "Good"
    elif missing_pct < 5 and total_points > 100:
        quality = "Fair"
    else:
        quality = "Poor"

    return {
        "ticker": ticker,
        "asset_class": detect_asset_class(ticker),
        "total_points": total_points,
        "missing_values": int(missing),
        "missing_percentage": round(missing_pct, 2),
        "start_date": start_date,
        "end_date": end_date,
        "granularity": interval,
        "avg_daily_return": round(avg_return * 100, 4),
        "avg_daily_volatility": round(daily_vol * 100, 4),
        "annualized_volatility": round(annual_vol * 100, 2),
        "outlier_count": outlier_count,
        "quality_score": quality,
    }


def search_tickers(query: str) -> list:
    """Search for tickers matching a query."""
    # Common tickers database for instant search
    common = {
        "AAPL": "Apple Inc.",
        "MSFT": "Microsoft Corporation",
        "GOOGL": "Alphabet Inc.",
        "AMZN": "Amazon.com Inc.",
        "NVDA": "NVIDIA Corporation",
        "META": "Meta Platforms Inc.",
        "TSLA": "Tesla Inc.",
        "JPM": "JPMorgan Chase & Co.",
        "V": "Visa Inc.",
        "JNJ": "Johnson & Johnson",
        "WMT": "Walmart Inc.",
        "PG": "Procter & Gamble Co.",
        "MA": "Mastercard Inc.",
        "UNH": "UnitedHealth Group Inc.",
        "HD": "Home Depot Inc.",
        "DIS": "Walt Disney Co.",
        "BAC": "Bank of America Corp.",
        "XOM": "Exxon Mobil Corporation",
        "KO": "Coca-Cola Company",
        "PFE": "Pfizer Inc.",
        "NFLX": "Netflix Inc.",
        "AMD": "Advanced Micro Devices",
        "INTC": "Intel Corporation",
        "CRM": "Salesforce Inc.",
        "CSCO": "Cisco Systems Inc.",
        # ETFs
        "SPY": "SPDR S&P 500 ETF Trust",
        "QQQ": "Invesco QQQ Trust",
        "IWM": "iShares Russell 2000 ETF",
        "DIA": "SPDR Dow Jones ETF",
        "VTI": "Vanguard Total Stock Market ETF",
        "VOO": "Vanguard S&P 500 ETF",
        "GLD": "SPDR Gold Shares",
        "TLT": "iShares 20+ Year Treasury Bond ETF",
        "EEM": "iShares MSCI Emerging Markets ETF",
        "VEA": "Vanguard FTSE Developed Markets ETF",
        # Crypto
        "BTC-USD": "Bitcoin USD",
        "ETH-USD": "Ethereum USD",
        "SOL-USD": "Solana USD",
        "DOGE-USD": "Dogecoin USD",
        # Forex
        "EURUSD=X": "EUR/USD",
        "GBPUSD=X": "GBP/USD",
        "USDJPY=X": "USD/JPY",
        # Indices
        "^GSPC": "S&P 500",
        "^DJI": "Dow Jones Industrial Average",
        "^IXIC": "NASDAQ Composite",
        "^FCHI": "CAC 40",
    }

    q = query.upper().strip()
    results = []
    for ticker, name in common.items():
        if q in ticker.upper() or q in name.upper():
            results.append({
                "ticker": ticker,
                "name": name,
                "type": detect_asset_class(ticker),
            })
    return results[:20]
