"""
Prediction Manager Module
Handles inference and predictions
"""

import logging
import numpy as np
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def predict(model, X: np.ndarray) -> np.ndarray:
    """
    Make predictions using trained model
    
    Args:
        model: Trained Keras model
        X: Input features
    
    Returns:
        Predictions
    """
    return model.predict(X)
