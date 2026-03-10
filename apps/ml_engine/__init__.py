import os

# Make this package point to the existing `apps/ml-engine` directory (hyphenated).
# This allows imports like `apps.ml_engine.data_validator` to resolve without
# renaming the original folder.
__path__ = [os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'ml-engine'))]
