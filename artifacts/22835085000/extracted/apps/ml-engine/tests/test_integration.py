"""
Integration tests for Dellmology
"""

import pytest
import logging

logger = logging.getLogger(__name__)


class TestDatabaseIntegration:
    """Test database connectivity"""
    
    def test_db_health(self):
        """Test database health check"""
        from dellmology.utils.db_utils import get_db_health
        health = get_db_health()
        assert isinstance(health, dict)
