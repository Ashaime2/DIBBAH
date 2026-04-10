"""
Robustness API Routes — Train/test, stress test, sensitivity analysis
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from api.models.schemas import TrainTestRequest, StressTestRequest, SensitivityRequest
from engine.data_engine import fetch_market_data
from engine.backtest_engine import get_strategy, run_backtest
from engine.analysis.performance import calculate_kpis

router = APIRouter()


@router.post("/train-test")
async def train_test_split(request: TrainTestRequest):
    """Run backtest on train and test periods separately."""
    try:
        df = fetch_market_data(request.ticker, request.period)
        split_idx = int(len(df) * request.train_ratio)

        if split_idx < 50 or len(df) - split_idx < 20:
            raise ValueError("Insufficient data for train/test split")

        train_df = df.iloc[:split_idx].reset_index(drop=True)
        test_df = df.iloc[split_idx:].reset_index(drop=True)

        strategy_train = get_strategy(request.strategy_id, request.parameters)
        strategy_test = get_strategy(request.strategy_id, request.parameters)

        train_result = run_backtest(
            train_df, strategy_train,
            initial_capital=request.initial_capital,
            commission=request.commission,
            slippage=request.slippage,
        )
        test_result = run_backtest(
            test_df, strategy_test,
            initial_capital=request.initial_capital,
            commission=request.commission,
            slippage=request.slippage,
        )

        train_kpis = calculate_kpis(
            train_result["equity_curve"]["portfolio_value"],
            train_result["equity_curve"]["benchmark_value"],
            train_result["trades"],
            request.initial_capital,
        )
        test_kpis = calculate_kpis(
            test_result["equity_curve"]["portfolio_value"],
            test_result["equity_curve"]["benchmark_value"],
            test_result["trades"],
            request.initial_capital,
        )

        # Detect overfitting signals
        warnings = []
        if train_kpis["sharpe_ratio"] > 0 and test_kpis["sharpe_ratio"] < 0:
            warnings.append("Sharpe ratio turns negative out-of-sample — strong overfitting signal")
        if train_kpis["total_return"] > 0 and test_kpis["total_return"] < train_kpis["total_return"] * 0.3:
            warnings.append("Out-of-sample return is less than 30% of in-sample — potential overfitting")
        if train_kpis["max_drawdown"] != 0 and abs(test_kpis["max_drawdown"]) > abs(train_kpis["max_drawdown"]) * 2:
            warnings.append("Max drawdown doubles out-of-sample — strategy may not be robust")
        if test_kpis["total_trades"] < 5:
            warnings.append("Very few trades out-of-sample — insufficient for statistical significance")

        return {
            "train": {
                "period": f"{train_df['date'].iloc[0].strftime('%Y-%m-%d')} to {train_df['date'].iloc[-1].strftime('%Y-%m-%d')}",
                "kpis": train_kpis,
                "equity_curve": train_result["equity_curve"],
                "trades": len(train_result["trades"]),
            },
            "test": {
                "period": f"{test_df['date'].iloc[0].strftime('%Y-%m-%d')} to {test_df['date'].iloc[-1].strftime('%Y-%m-%d')}",
                "kpis": test_kpis,
                "equity_curve": test_result["equity_curve"],
                "trades": len(test_result["trades"]),
            },
            "warnings": warnings,
            "performance_drop": round(
                (1 - test_kpis["total_return"] / train_kpis["total_return"]) * 100, 1
            ) if train_kpis["total_return"] != 0 else 0,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Train/test error: {str(e)}")


@router.post("/stress-test")
async def stress_test(request: StressTestRequest):
    """Test strategy under degraded conditions."""
    try:
        df = fetch_market_data(request.ticker, request.period)
        strategy = get_strategy(request.strategy_id, request.parameters)
        base_commission = 0.001
        base_slippage = 0.0005

        results = []

        # Test fee sensitivity
        for mult in request.fee_multipliers:
            s = get_strategy(request.strategy_id, request.parameters)
            result = run_backtest(
                df, s,
                initial_capital=request.initial_capital,
                commission=base_commission * mult,
                slippage=base_slippage,
            )
            kpis = calculate_kpis(
                result["equity_curve"]["portfolio_value"],
                result["equity_curve"]["benchmark_value"],
                result["trades"],
                request.initial_capital,
            )
            results.append({
                "scenario": f"Fees x{mult}",
                "type": "fee",
                "multiplier": mult,
                "kpis": kpis,
            })

        # Test slippage sensitivity
        for mult in request.slippage_multipliers:
            if mult == 1.0:
                continue  # Already computed above
            s = get_strategy(request.strategy_id, request.parameters)
            result = run_backtest(
                df, s,
                initial_capital=request.initial_capital,
                commission=base_commission,
                slippage=base_slippage * mult,
            )
            kpis = calculate_kpis(
                result["equity_curve"]["portfolio_value"],
                result["equity_curve"]["benchmark_value"],
                result["trades"],
                request.initial_capital,
            )
            results.append({
                "scenario": f"Slippage x{mult}",
                "type": "slippage",
                "multiplier": mult,
                "kpis": kpis,
            })

        return {"scenarios": results}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stress test error: {str(e)}")


@router.post("/sensitivity")
async def parameter_sensitivity(request: SensitivityRequest):
    """Analyze sensitivity to a single parameter."""
    try:
        df = fetch_market_data(request.ticker, request.period)
        results = []

        for val in request.param_range:
            params = {**request.base_parameters, request.param_name: val}
            strategy = get_strategy(request.strategy_id, params)
            result = run_backtest(
                df, strategy,
                initial_capital=request.initial_capital,
                commission=request.commission,
                slippage=request.slippage,
            )
            kpis = calculate_kpis(
                result["equity_curve"]["portfolio_value"],
                result["equity_curve"]["benchmark_value"],
                result["trades"],
                request.initial_capital,
            )
            results.append({
                "param_value": val,
                "total_return": kpis["total_return"],
                "sharpe_ratio": kpis["sharpe_ratio"],
                "max_drawdown": kpis["max_drawdown"],
                "win_rate": kpis["win_rate"],
                "total_trades": kpis["total_trades"],
            })

        return {
            "param_name": request.param_name,
            "results": results,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sensitivity error: {str(e)}")


@router.post("/walk-forward")
async def walk_forward_analysis(request: Dict[str, Any]):
    """Walk-forward optimization: sliding window re-calibration."""
    import numpy as np
    try:
        ticker = request.get("ticker", "SPY")
        strategy_id = request.get("strategy_id")
        parameters = request.get("parameters", {})
        period = request.get("period", "5y")
        initial_capital = request.get("initial_capital", 10000.0)
        commission = request.get("commission", 0.001)
        slippage = request.get("slippage", 0.0005)
        n_windows = request.get("n_windows", 5)

        df = fetch_market_data(ticker, period)

        if len(df) < 100:
            raise ValueError("Insufficient data for walk-forward analysis")

        window_size = len(df) // n_windows
        windows = []

        for i in range(n_windows):
            start = i * window_size
            end = min(start + window_size, len(df))
            if end - start < 20:
                continue

            window_df = df.iloc[start:end].reset_index(drop=True)
            strategy = get_strategy(strategy_id, parameters)
            result = run_backtest(
                window_df, strategy,
                initial_capital=initial_capital,
                commission=commission,
                slippage=slippage,
            )
            kpis = calculate_kpis(
                result["equity_curve"]["portfolio_value"],
                result["equity_curve"]["benchmark_value"],
                result["trades"],
                initial_capital,
            )
            windows.append({
                "window": i + 1,
                "period": f"{window_df['date'].iloc[0].strftime('%Y-%m-%d')} to {window_df['date'].iloc[-1].strftime('%Y-%m-%d')}",
                "kpis": kpis,
                "trades": len(result["trades"]),
            })

        # Compute consistency
        returns = [w["kpis"]["total_return"] for w in windows]
        sharpes = [w["kpis"]["sharpe_ratio"] for w in windows]
        positive_windows = sum(1 for r in returns if r > 0)
        consistency = positive_windows / len(windows) if windows else 0

        return {
            "windows": windows,
            "consistency": round(consistency * 100, 1),
            "avg_return": round(np.mean(returns), 2) if returns else 0,
            "std_return": round(np.std(returns), 2) if returns else 0,
            "avg_sharpe": round(np.mean(sharpes), 3) if sharpes else 0,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Walk-forward error: {str(e)}")


@router.post("/monte-carlo")
async def monte_carlo_simulation(request: Dict[str, Any]):
    """Monte Carlo simulation: shuffle trade outcomes to estimate distribution."""
    import numpy as np
    try:
        ticker = request.get("ticker", "SPY")
        strategy_id = request.get("strategy_id")
        parameters = request.get("parameters", {})
        period = request.get("period", "5y")
        initial_capital = request.get("initial_capital", 10000.0)
        commission = request.get("commission", 0.001)
        slippage = request.get("slippage", 0.0005)
        n_simulations = min(request.get("n_simulations", 1000), 2000)

        df = fetch_market_data(ticker, period)
        strategy = get_strategy(strategy_id, parameters)
        result = run_backtest(
            df, strategy,
            initial_capital=initial_capital,
            commission=commission,
            slippage=slippage,
        )

        trades = result["trades"]
        if len(trades) < 3:
            raise ValueError("Not enough trades for Monte Carlo (need at least 3)")

        # Extract trade PnL percentages
        trade_pnls = [t["pnl_pct"] / 100 for t in trades]
        actual_return = result["equity_curve"]["portfolio_value"][-1] / initial_capital - 1

        # Run simulations by shuffling trade order
        sim_returns = []
        sim_drawdowns = []

        for _ in range(n_simulations):
            shuffled = np.random.permutation(trade_pnls)
            equity = initial_capital
            peak = equity
            max_dd = 0

            for pnl in shuffled:
                equity *= (1 + pnl)
                peak = max(peak, equity)
                dd = (equity - peak) / peak if peak > 0 else 0
                max_dd = min(max_dd, dd)

            sim_returns.append((equity / initial_capital - 1) * 100)
            sim_drawdowns.append(max_dd * 100)

        sim_returns = sorted(sim_returns)
        sim_drawdowns = sorted(sim_drawdowns)

        # Percentiles
        p5 = np.percentile(sim_returns, 5)
        p25 = np.percentile(sim_returns, 25)
        p50 = np.percentile(sim_returns, 50)
        p75 = np.percentile(sim_returns, 75)
        p95 = np.percentile(sim_returns, 95)

        # Build histogram
        hist_bins = 30
        hist, bin_edges = np.histogram(sim_returns, bins=hist_bins)
        histogram = [
            {"bin_start": round(bin_edges[i], 2), "bin_end": round(bin_edges[i+1], 2), "count": int(hist[i])}
            for i in range(hist_bins)
        ]

        # Where does the actual return rank?
        rank = sum(1 for r in sim_returns if r <= actual_return * 100) / len(sim_returns) * 100

        return {
            "n_simulations": n_simulations,
            "n_trades": len(trades),
            "actual_return": round(actual_return * 100, 2),
            "percentiles": {
                "p5": round(p5, 2),
                "p25": round(p25, 2),
                "p50": round(p50, 2),
                "p75": round(p75, 2),
                "p95": round(p95, 2),
            },
            "mean_return": round(np.mean(sim_returns), 2),
            "std_return": round(np.std(sim_returns), 2),
            "probability_positive": round(sum(1 for r in sim_returns if r > 0) / len(sim_returns) * 100, 1),
            "actual_rank_percentile": round(rank, 1),
            "histogram": histogram,
            "median_max_drawdown": round(np.percentile(sim_drawdowns, 50), 2),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monte Carlo error: {str(e)}")

