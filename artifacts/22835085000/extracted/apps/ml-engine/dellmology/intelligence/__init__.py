"""
Intelligence Module
AI narrative generation and explainable AI (XAI) for trading decisions
"""

from .ai_narrative import generate_narrative
from .xai_explainer import explain_prediction

__all__ = [
    'generate_narrative',
    'explain_prediction',
]
