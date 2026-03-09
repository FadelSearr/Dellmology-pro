import sys, os
# allow imports from ml-engine folder so the `dellmology` package is discoverable
sys.path.append(os.path.join(os.getcwd(), "apps", "ml-engine"))
import numpy as np
from dellmology.models.cnn_pattern_detector import detect_patterns


def test_basic_detection():
    arr = np.zeros(10)
    res = detect_patterns(arr)
    assert isinstance(res, dict)
