"""
Backtest API Routes
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from api.models.schemas import BacktestRequest
from engine.data_engine import fetch_market_data
from engine.backtest_engine import get_strategy, run_backtest
from engine.analysis.performance import calculate_kpis, calculate_rolling_sharpe, calculate_monthly_returns

router = APIRouter()


@router.post("/run")
async def run_backtest_endpoint(request: BacktestRequest):
    """Execute a single backtest."""
    try:
        # Fetch data
        df = fetch_market_data(
            request.ticker,
            request.period,
            request.interval,
            request.start_date,
            request.end_date,
        )

        # Get strategy
        strategy = get_strategy(request.strategy_id, request.parameters)

        # Run backtest
        result = run_backtest(
            df=df,
            strategy=strategy,
            initial_capital=request.initial_capital,
            position_size=request.position_size,
            commission=request.commission,
            slippage=request.slippage,
            reinvest=request.reinvest,
        )

        result["ticker"] = request.ticker.upper()

        # Calculate KPIs
        kpis = calculate_kpis(
            portfolio_values=result["equity_curve"]["portfolio_value"],
            benchmark_values=result["equity_curve"]["benchmark_value"],
            trades=result["trades"],
            initial_capital=request.initial_capital,
        )
        result["kpis"] = kpis

        # Rolling Sharpe
        result["rolling_sharpe"] = calculate_rolling_sharpe(
            result["equity_curve"]["portfolio_value"]
        )

        # Monthly returns
        result["monthly_returns"] = calculate_monthly_returns(
            result["equity_curve"]["dates"],
            result["equity_curve"]["portfolio_value"],
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest error: {str(e)}")


@router.post("/multi")
async def run_multi_backtest(configs: Dict[str, Any]):
    """Run multiple strategies on the same data."""
    try:
        ticker = configs.get("ticker", "SPY")
        period = configs.get("period", "5y")
        interval = configs.get("interval", "1d")
        initial_capital = configs.get("initial_capital", 10000.0)
        commission = configs.get("commission", 0.001)
        slippage = configs.get("slippage", 0.0005)
        strategy_configs = configs.get("strategies", [])

        # Fetch data once
        df = fetch_market_data(ticker, period, interval)

        results = []
        for config in strategy_configs:
            strategy_id = config.get("strategy_id")
            parameters = config.get("parameters", {})

            strategy = get_strategy(strategy_id, parameters)
            result = run_backtest(
                df=df,
                strategy=strategy,
                initial_capital=initial_capital,
                commission=commission,
                slippage=slippage,
            )
            result["ticker"] = ticker.upper()

            kpis = calculate_kpis(
                portfolio_values=result["equity_curve"]["portfolio_value"],
                benchmark_values=result["equity_curve"]["benchmark_value"],
                trades=result["trades"],
                initial_capital=initial_capital,
            )
            result["kpis"] = kpis
            results.append(result)

        return {"results": results}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-backtest error: {str(e)}")
