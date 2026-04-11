"""
SignalForge Backend — FastAPI Application
Quantitative Strategy Backtesting & Critical Analysis Engine
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import market, backtest, strategies, robustness, compare

app = FastAPI(
    title="SignalForge API",
    description="Quantitative Strategy Backtesting & Critical Analysis Engine",
    version="1.0.0",
)

import os

# Permissive CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
)

@app.get("/")
async def root():
    return {"message": "SignalForge API is running. Use /api/health for status."}

# Register routers
app.include_router(market.router, prefix="/api/market", tags=["Market Data"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtesting"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])
app.include_router(robustness.router, prefix="/api/robustness", tags=["Robustness"])
app.include_router(compare.router, prefix="/api/compare", tags=["Compare"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "SignalForge API"}
