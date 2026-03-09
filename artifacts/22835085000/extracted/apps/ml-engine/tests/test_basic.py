"""
Test Suite for Dellmology Modules
"""

import pytest
import logging

logger = logging.getLogger(__name__)


def test_config_loading():
    """Test configuration loading"""
    from config import Config, validate_config
    assert validate_config() is True
    assert Config.DATABASE_URL is not None


def test_data_importer():
    """Test data importer module"""
    from dellmology.data_pipeline import data_importer
    assert data_importer is not None


def test_screener():
    """Test screener module"""
    from dellmology.analysis.screener import AdvancedScreener
    screener = AdvancedScreener()
    assert screener is not None
