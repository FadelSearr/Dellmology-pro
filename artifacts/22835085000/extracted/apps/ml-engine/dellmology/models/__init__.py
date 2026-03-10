"""
ML Models Module
Deep Learning models for pattern detection and price prediction
"""

# expose helpers while guarding against heavy dependencies
try:
    from .cnn_model import build_cnn_model
except ImportError:
    # tensorflow may not be available in lightweight environments or during testing
    build_cnn_model = None

from .feature_generator import generate_features
from .train_manager import train_model
from .predict_manager import predict

__all__ = [
    'build_cnn_model',
    'generate_features',
    'train_model',
    'predict',
]
