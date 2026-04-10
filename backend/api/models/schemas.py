"""
Pydantic models for API request/response schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date


# ─── Market Data ─────────────────────────────────────────────

class MarketDataRequest(BaseModel):
    ticker: str
    period: str = "5y"
    interval: str = "1d"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DataQualityReport(BaseModel):
    ticker: str
    asset_class: str
    total_points: int
    missing_values: int
    missing_percentage: float
    start_date: str
    end_date: str
    granularity: str
    avg_daily_return: float
    avg_daily_volatility: float
    annualized_volatility: float
    outlier_count: int
    quality_score: str  # "Excellent", "Good", "Fair", "Poor"


class OHLCVData(BaseModel):
    dates: List[str]
    open: List[float]
    high: List[float]
    low: List[float]
    close: List[float]
    volume: List[float]
    returns: List[Optional[float]]


class MarketDataResponse(BaseModel):
    ticker: str
    name: str
    data: OHLCVData
    quality: DataQualityReport


# ─── Strategy ────────────────────────────────────────────────

class StrategyParameter(BaseModel):
    name: str
    label: str
    type: str  # "int", "float", "bool"
    default: Any
    min: Optional[Any] = None
    max: Optional[Any] = None
    step: Optional[Any] = None
    description: str = ""


class StrategyInfo(BaseModel):
    id: str
    name: str
    category: str  # "basic", "quant", "ml"
    description: str
    long_description: str = ""
    parameters: List[StrategyParameter]
    tags: List[str] = []


# ─── Backtest ────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    ticker: str
    strategy_id: str
    parameters: Dict[str, Any] = {}
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    period: str = "5y"
    interval: str = "1d"
    initial_capital: float = 10000.0
    position_size: float = 1.0  # fraction of capital
    commission: float = 0.001   # 0.1%
    slippage: float = 0.0005    # 0.05%
    reinvest: bool = True


class Trade(BaseModel):
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    quantity: float
    side: str  # "long" or "short"
    pnl: float
    pnl_pct: float
    entry_reason: str
    exit_reason: str
    holding_days: int


class KPIs(BaseModel):
    total_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    calmar_ratio: float
    win_rate: float
    profit_factor: float
    total_trades: int
    avg_trade_duration: float
    market_exposure: float
    avg_win: float
    avg_loss: float
    best_trade: float
    worst_trade: float
    max_consecutive_wins: int
    max_consecutive_losses: int


class EquityCurve(BaseModel):
    dates: List[str]
    portfolio_value: List[float]
    benchmark_value: List[float]
    drawdown: List[float]
    cash: List[float]


class BacktestResult(BaseModel):
    id: str
    ticker: str
    strategy_id: str
    strategy_name: str
    parameters: Dict[str, Any]
    kpis: KPIs
    equity_curve: EquityCurve
    trades: List[Trade]
    signals: List[Dict[str, Any]]  # date, signal, price, indicators


# ─── Comparison ──────────────────────────────────────────────

class CompareRequest(BaseModel):
    ticker: str
    strategy_configs: List[Dict[str, Any]]
    period: str = "5y"
    interval: str = "1d"
    initial_capital: float = 10000.0
    commission: float = 0.001
    slippage: float = 0.0005


# ─── Robustness ──────────────────────────────────────────────

class TrainTestRequest(BaseModel):
    ticker: str
    strategy_id: str
    parameters: Dict[str, Any] = {}
    train_ratio: float = 0.7
    period: str = "5y"
    initial_capital: float = 10000.0
    commission: float = 0.001
    slippage: float = 0.0005


class StressTestRequest(BaseModel):
    ticker: str
    strategy_id: str
    parameters: Dict[str, Any] = {}
    period: str = "5y"
    initial_capital: float = 10000.0
    fee_multipliers: List[float] = [1.0, 2.0, 5.0, 10.0]
    slippage_multipliers: List[float] = [1.0, 2.0, 5.0, 10.0]
    signal_delays: List[int] = [0, 1, 2, 3]


class SensitivityRequest(BaseModel):
    ticker: str
    strategy_id: str
    param_name: str
    param_range: List[Any]
    base_parameters: Dict[str, Any] = {}
    period: str = "5y"
    initial_capital: float = 10000.0
    commission: float = 0.001
    slippage: float = 0.0005
