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
        # Calculate returns missing from database
        cached_df["returns"] = cached_df["close"].pct_change()
        return cached_df


    try:
        if start_date and end_date:
            df = yf.download(ticker, start=start_date, end=end_date, interval=interval, progress=False, session=yf_session)
        else:
            df = yf.download(ticker, period=period, interval=interval, progress=False, session=yf_session)
    except Exception as e:
        raise ValueError(f"Failed to fetch data for {ticker}: {str(e)}")

    if df.empty:
        raise ValueError(f"No data found for ticker: {ticker}")

    # Handle MultiIndex columns from yfinance v1.x
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    # Standardize columns
    df = df.reset_index()
    rename_map = {}
    for col in df.columns:
        if isinstance(col, str):
            lower = col.lower().replace(" ", "_")
            rename_map[col] = lower
    df = df.rename(columns=rename_map)

    # Ensure we have required columns
    if "date" not in df.columns and "datetime" in df.columns:
        df = df.rename(columns={"datetime": "date"})

    # Remove timezone info from date
    if pd.api.types.is_datetime64_any_dtype(df["date"]):
        try:
            df["date"] = df["date"].dt.tz_localize(None)
        except TypeError:
            pass  # Already timezone-naive

    # Keep only OHLCV
    required = ["date", "open", "high", "low", "close", "volume"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Available: {list(df.columns)}")

    df = df[required].copy()

    # Clean data
    df = df.dropna(subset=["open", "high", "low", "close"])
    df = df.sort_values("date").reset_index(drop=True)

    # Save to SQLite Database
    save_market_data(df, ticker, interval)

    # Calculate returns
    df["returns"] = df["close"].pct_change()

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
