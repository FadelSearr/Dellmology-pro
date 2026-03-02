# Python API Entry Point
"""
Main API application using FastAPI
Dellmology Pro REST API
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
from pathlib import Path

# Setup path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import Config, validate_config, setup_logging
from dellmology.analysis.screener_api import router as screener_router
from broker_flow import main as broker_flow_main
from exit_whale import main as exit_whale_main
from apscheduler.schedulers.background import BackgroundScheduler

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dellmology Pro API",
    description="Advanced stock market analysis platform",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(screener_router)


@app.on_event("startup")
async def startup_event():
    """Startup event - validate configuration and kick off scheduled jobs"""
    logger.info("Starting Dellmology API...")
    if not validate_config():
        logger.error("Configuration validation failed!")
        raise RuntimeError("Invalid configuration")
    logger.info("Configuration validated successfully")

    # schedule broker flow job daily at 18:00
    scheduler = BackgroundScheduler()
    scheduler.add_job(lambda: broker_flow_main(), 'cron', hour=18, minute=0, id='broker_flow')
    # schedule exit whale detection shortly after broker flow (e.g. 18:15)
    scheduler.add_job(lambda: exit_whale_main(), 'cron', hour=18, minute=15, id='exit_whale')
    scheduler.start()
    logger.info("Scheduled broker flow job (18:00 daily)")
    logger.info("Scheduled exit whale detection job (18:15 daily)")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "service": "dellmology-api"
    }


@app.get("/config")
async def get_config_endpoint():
    """Get current configuration (sanitized)"""
    config = Config.to_dict()
    # Hide sensitive data
    for key in ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'REDIS_HOST']:
        if key in config:
            config[key] = '***' if config[key] else None
    return config


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting API server on {Config.API_HOST}:{Config.API_PORT}")
    uvicorn.run(
        "main:app",
        host=Config.API_HOST,
        port=Config.API_PORT,
        workers=Config.API_WORKERS,
        reload=True
    )
