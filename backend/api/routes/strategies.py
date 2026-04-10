"""
Strategies API Routes
"""

from fastapi import APIRouter, HTTPException

from engine.backtest_engine import get_all_strategies, STRATEGY_REGISTRY

router = APIRouter()


@router.get("")
async def list_strategies():
    """List all available strategies with their parameters."""
    return {"strategies": get_all_strategies()}


@router.get("/{strategy_id}")
async def get_strategy_info(strategy_id: str):
    """Get detailed information about a specific strategy."""
    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found")

    cls = STRATEGY_REGISTRY[strategy_id]
    info = cls.info()
    info["parameters"] = cls.get_parameters()
    return info
