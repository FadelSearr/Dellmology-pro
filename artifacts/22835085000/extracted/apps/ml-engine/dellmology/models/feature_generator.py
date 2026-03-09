"""
Feature Generator Module
Generates technical analysis features for ML models
"""

import pandas as pd
import numpy as np
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


def generate_features(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    """
    Generate technical features from OHLCV data
    
    Args:
        df: DataFrame with OHLCV columns
        window: Lookback window for feature calculation
    
    Returns:
        DataFrame with additional feature columns
    """
    df = df.copy()
    
    # Calculate returns
    df['returns'] = df['close'].pct_change()
    
    # Volatility (20-period rolling std)
    df['volatility'] = df['returns'].rolling(window=window).std()
    
    # Simple Moving Average
    df['sma_20'] = df['close'].rolling(window=window).mean()
    
    # Relative Strength Index (RSI)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # MACD
    exp1 = df['close'].ewm(span=12, adjust=False).mean()
    exp2 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = exp1 - exp2
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    
    # Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=window).mean()
    df['bb_std'] = df['close'].rolling(window=window).std()
    df['bb_upper'] = df['bb_middle'] + (df['bb_std'] * 2)
    df['bb_lower'] = df['bb_middle'] - (df['bb_std'] * 2)
    
    # Drop rows with NaN from rolling calculations
    df = df.dropna()
    
    return df


def prepare_sequence(df: pd.DataFrame, sequence_length: int = 20) -> Tuple[np.ndarray, np.ndarray]:
    """
    Prepare sequences for LSTM/CNN training
    
    Args:
        df: DataFrame with features
        sequence_length: Length of each sequence
    
    Returns:
        Tuple of (X, y) arrays
    """
    feature_cols = ['open', 'high', 'low', 'close', 'volume', 'returns', 'rsi', 'macd']
    X, y = [], []
    
    for i in range(len(df) - sequence_length):
        X.append(df[feature_cols].iloc[i:i+sequence_length].values)
        y.append(1 if df['close'].iloc[i+sequence_length] > df['close'].iloc[i+sequence_length-1] else 0)
    
    return np.array(X), np.array(y)
