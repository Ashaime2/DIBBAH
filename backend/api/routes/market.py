"""
Market Data API Routes
"""

import math
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from engine.data_engine import fetch_market_data, compute_data_quality, search_tickers, get_ticker_name

router = APIRouter()


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    """Search for tickers by name or symbol."""
    results = search_tickers(q)
    return {"results": results}


@router.get("/{ticker}")
async def get_market_data(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Fetch OHLCV data for a ticker."""
    try:
        df = fetch_market_data(ticker, period, interval, start_date, end_date)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

    name = get_ticker_name(ticker)
    quality = compute_data_quality(df, ticker, interval)

    def safe_float(v, decimals=4):
        try:
            if v is None or (isinstance(v, float) and math.isnan(v)):
                return None
            return round(float(v), decimals)
        except (TypeError, ValueError):
            return None

    def safe_int(v):
        try:
            if v is None or (isinstance(v, float) and math.isnan(v)):
                return 0
            return int(v)
        except (TypeError, ValueError):
            return 0

    # Build response
    data = {
        "dates": [str(d)[:10] for d in df["date"]],
        "open": [safe_float(v) for v in df["open"]],
        "high": [safe_float(v) for v in df["high"]],
        "low": [safe_float(v) for v in df["low"]],
        "close": [safe_float(v) for v in df["close"]],
        "volume": [safe_int(v) for v in df["volume"]],
        "returns": [safe_float(v, 6) for v in df["returns"]],
    }

    return {
        "ticker": ticker.upper(),
        "name": name,
        "data": data,
        "quality": quality,
    }


@router.get("/{ticker}/quality")
async def get_data_quality(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
):
    """Get data quality report for a ticker."""
    try:
        df = fetch_market_data(ticker, period, interval)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    quality = compute_data_quality(df, ticker, interval)
    return quality


@router.get("/{ticker}/stats")
async def get_basic_stats(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
):
    """Get basic statistics for a ticker."""
    try:
        df = fetch_market_data(ticker, period, interval)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    import numpy as np

    close = df["close"]
    returns = df["returns"].dropna()

    stats = {
        "current_price": round(float(close.iloc[-1]), 2),
        "period_high": round(float(close.max()), 2),
        "period_low": round(float(close.min()), 2),
        "avg_price": round(float(close.mean()), 2),
        "total_return": round(float((close.iloc[-1] / close.iloc[0] - 1) * 100), 2),
        "avg_daily_return": round(float(returns.mean() * 100), 4),
        "daily_volatility": round(float(returns.std() * 100), 4),
        "annualized_volatility": round(float(returns.std() * np.sqrt(252) * 100), 2),
        "skewness": round(float(returns.skew()), 3),
        "kurtosis": round(float(returns.kurtosis()), 3),
        "max_daily_gain": round(float(returns.max() * 100), 2),
        "max_daily_loss": round(float(returns.min() * 100), 2),
    }

    return stats
