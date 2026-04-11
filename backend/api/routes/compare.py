"""
Compare API Routes — Side-by-side strategy comparison
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from api.models.schemas import CompareRequest
from engine.data_engine import fetch_market_data
from engine.backtest_engine import get_strategy, run_backtest
from engine.analysis.performance import calculate_kpis

router = APIRouter()


@router.post("")
async def compare_strategies(request: CompareRequest):
    """Compare multiple strategies on the same data."""
    try:
        df = fetch_market_data(request.ticker, request.period, request.interval)

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

            kpis = calculate_kpis(
                portfolio_values=result["equity_curve"]["portfolio_value"],
                benchmark_values=result["equity_curve"]["benchmark_value"],
                trades=result["trades"],
                initial_capital=request.initial_capital,
            )
            result["kpis"] = kpis
            results.append(result)

        # Generate ranking
        ranking = _generate_ranking(results)

        return {
            "results": results,
            "ranking": ranking,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compare error: {str(e)}")


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
