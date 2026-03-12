"""
Compatibility shim package so tests importing `apps.ml_engine` can load
modules from the existing `apps/ml-engine` directory (which uses a hyphen).

This package sets its `__path__` to point to the real implementation
directory so submodule imports like `apps.ml_engine.train_cnn` resolve.
"""
import os

_BASE = os.path.dirname(__file__)
_REAL = os.path.normpath(os.path.join(_BASE, '..', 'ml-engine'))
if os.path.isdir(_REAL):
    __path__ = [__path__[0], _REAL]
else:
    # Fallback: leave default path
    __path__ = __path__
