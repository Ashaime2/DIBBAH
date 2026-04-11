import asyncio
import gc
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

from api.models.schemas import CompareRequest
from engine.data_engine import fetch_market_data
from engine.backtest_engine import get_strategy, run_backtest
from engine.analysis.performance import calculate_kpis

router = APIRouter()

# Global semaphore to limit heavy backtests to 1 at a time on memory-constrained Render instances
# This prevents OOM (Out of Memory) by queuing concurrent requests instead of crashing the server.
COMPARE_SEMAPHORE = asyncio.Semaphore(1)


@router.post("")
async def compare_strategies(request: CompareRequest):
    """Compare multiple strategies on the same data with concurrency protection."""
    async with COMPARE_SEMAPHORE:
        try:
            df = fetch_market_data(request.ticker, request.period, request.interval)
            
            if len(df) < 2:
                raise ValueError(f"Insufficient data points ({len(df)}) for ticker {request.ticker} on interval {request.interval}. Please choose a longer period or a more granular interval.")

            results = []
            for config in request.strategy_configs:
                strategy_id = config.get("strategy_id")
                parameters = config.get("parameters", {})

                strategy = get_strategy(strategy_id, parameters)
                result = run_backtest(
                    df=df,
                    strategy=strategy,
                    initial_capital=request.initial_capital,
                    commission=request.commission,
                    slippage=request.slippage,
                )
                result["ticker"] = request.ticker.upper()

                # Extract curve for performance calc before we potentially downsample
                portfolio_vals = result["equity_curve"]["portfolio_value"]
                benchmark_vals = result["equity_curve"]["benchmark_value"]
                
                kpis = calculate_kpis(
                    portfolio_values=portfolio_vals,
                    benchmark_values=benchmark_vals,
                    trades=result["trades"],
                    initial_capital=request.initial_capital,
                )
                result["kpis"] = kpis
                
                # --- MEMORY OPTIMIZATION: Downsample Equity Curve ---
                # We don't need 20,000 points in the browser chart for a 5y backtest.
                # Downsampling to 600-800 points preserves the visual shape and saves MASSIVE RAM.
                MAX_POINTS = 800
                curve_len = len(result["equity_curve"]["dates"])
                if curve_len > MAX_POINTS:
                    step = curve_len // MAX_POINTS
                    ec = result["equity_curve"]
                    ec["dates"] = ec["dates"][::step]
                    ec["portfolio_value"] = ec["portfolio_value"][::step]
                    ec["benchmark_value"] = ec["benchmark_value"][::step]
                    if "cash" in ec: ec["cash"] = ec["cash"][::step]
                    if "drawdown" in ec: ec["drawdown"] = ec["drawdown"][::step]

                results.append(result)
                
                # Explicit cleanup after each strategy iteration
                gc.collect()

            # Generate ranking
            ranking = _generate_ranking(results)

            return {
                "results": results,
                "ranking": ranking,
            }

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # Important: ensure we catch and don't leak the semaphore lock if something weird happens 
            # (though 'async with' handles this automatically)
            raise HTTPException(status_code=500, detail=f"Compare error: {str(e)}")
        finally:
            # Final cleanup
            gc.collect()


def _generate_ranking(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate rankings across multiple criteria."""
    if not results:
        return {}

    strategies = [(r["strategy_name"], r["kpis"]) for r in results]

    rankings = {
        "by_return": sorted(strategies, key=lambda x: x[1]["total_return"], reverse=True),
        "by_sharpe": sorted(strategies, key=lambda x: x[1]["sharpe_ratio"], reverse=True),
        "by_drawdown": sorted(strategies, key=lambda x: abs(x[1]["max_drawdown"])),
        "by_win_rate": sorted(strategies, key=lambda x: x[1]["win_rate"], reverse=True),
    }

    # Mapping of ranking criterion to their actual KPI keys
    kpi_map = {
        "by_return": "total_return",
        "by_sharpe": "sharpe_ratio",
        "by_drawdown": "max_drawdown",
        "by_win_rate": "win_rate"
    }

    formatted = {}
    for criterion, ranked in rankings.items():
        kpi_key = kpi_map.get(criterion, criterion.replace("by_", ""))
        formatted[criterion] = [
            {"rank": i + 1, "strategy": name, "value": kpis.get(kpi_key, 0)}
            for i, (name, kpis) in enumerate(ranked)
        ]

    return formatted
