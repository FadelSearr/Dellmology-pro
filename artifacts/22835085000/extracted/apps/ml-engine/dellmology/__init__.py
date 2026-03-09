"""
Dellmology Pro - Advanced Stock Market Analysis Platform
Main package for data pipeline, ML models, and intelligent trading insights
"""

__version__ = "2.0.0"
__author__ = "Dellmology Team"

# Package initialization
from . import data_pipeline
from . import models
from . import analysis
from . import intelligence
from . import telegram
from . import utils

__all__ = [
    'data_pipeline',
    'models',
    'analysis',
    'intelligence',
    'telegram',
    'utils',
]
