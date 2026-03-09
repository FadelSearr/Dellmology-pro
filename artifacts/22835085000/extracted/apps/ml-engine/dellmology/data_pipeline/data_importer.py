"""
Data Importer Module
Loads historical and real-time market data from Yahoo Finance
"""

import yfinance as yf
import pandas as pd
from sqlalchemy import create_engine
import logging
import sys
from pathlib import Path

# Add parent to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config import Config

logger = logging.getLogger(__name__)

def connect_to_db():
    """Establishes a connection to the PostgreSQL database."""
    try:
        engine = create_engine(Config.DATABASE_URL)
        logger.info("Successfully connected to the database.")
        return engine
    except Exception as e:
        logger.fatal(f"FATAL: Could not connect to database. Error: {e}")
        raise


def fetch_historical_data(symbol, period="5y"):
    """Fetches historical OHLCV data from Yahoo Finance."""
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period=period)
        if history.empty:
            logger.warning(f"No data found for symbol {symbol}.")
            return None
        
        # Format the dataframe to match our table schema
        history.reset_index(inplace=True)
        history['symbol'] = symbol.replace('.JK', '') # Use clean symbol for DB
        history = history[['Date', 'symbol', 'Open', 'High', 'Low', 'Close', 'Volume']]
        history.columns = ['date', 'symbol', 'open', 'high', 'low', 'close', 'volume']
        history['date'] = pd.to_datetime(history['date']).dt.date
        
        logger.info(f"Successfully fetched {len(history)} records for {symbol}.")
        return history
        
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {e}")
        return None


def store_data(engine, df, table_name='daily_prices'):
    """Stores a dataframe into the specified database table."""
    try:
        df.to_sql(
            table_name,
            engine,
            if_exists='append',
            index=False,
            method=None
        )
        logger.info(f"Successfully stored {len(df)} records in '{table_name}'.")
    except Exception as e:
        logger.error(f"Error storing data. This might be due to duplicate entries. Details: {e}")


def main():
    """Main function to run the data import process."""
    logger.info("Starting historical data importer...")
    engine = connect_to_db()

    for symbol in Config.YAHOO_FINANCE_SYMBOLS:
        logger.info(f"--- Processing symbol: {symbol} ---")
        df = fetch_historical_data(symbol)
        if df is not None and not df.empty:
            store_data(engine, df)
    
    logger.info("Historical data import process finished.")


if __name__ == "__main__":
    main()
