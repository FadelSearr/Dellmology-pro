from pathlib import Path

# Provide a compatibility namespace package so imports like
# `import apps.ml_engine` work while the actual code directory
# is named `ml-engine` (contains a hyphen and isn't a valid
# Python module name). We prepend the real package path to
# this package's __path__ so the import machinery finds it.
package_dir = Path(__file__).resolve().parent.parent / "ml-engine"
if package_dir.exists():
    __path__.insert(0, str(package_dir))
import os

# Make this package point to the existing `apps/ml-engine` directory (hyphenated).
# This allows imports like `apps.ml_engine.data_validator` to resolve without
# renaming the original folder.
__path__ = [os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'ml-engine'))]
