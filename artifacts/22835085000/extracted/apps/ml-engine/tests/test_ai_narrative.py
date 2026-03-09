import os
import sys, importlib.util
import pytest

# determine project root regardless of current working directory
proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(proj_root)

# load module directly using root-based path
spec = importlib.util.spec_from_file_location(
    "ai_narrative",
    os.path.join(proj_root, "dellmology", "intelligence", "ai_narrative.py"),
)
ai_narrative = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_narrative)

class DummyResponse:
    def __init__(self, text):
        self.output_text = text

class DummyGenAI:
    def __init__(self):
        pass
    def responses(self):
        pass

@pytest.fixture(autouse=True)
def patch_genai(monkeypatch):
    # Create a simple mock object with both configure and responses
    class MockGenAI:
        @staticmethod
        def configure(**kwargs):
            pass
        
        class responses:
            @staticmethod
            def create(**kwargs):
                return DummyResponse("dummy narrative")
    
    monkeypatch.setattr(ai_narrative, 'genai', MockGenAI())
    yield


def test_generate_narrative_no_key(monkeypatch):
    if 'GEMINI_API_KEY' in os.environ:
        del os.environ['GEMINI_API_KEY']
    result = ai_narrative.generate_narrative({}, symbol='BBCA')
    assert result == ""


def test_generate_narrative_success(monkeypatch):
    os.environ['GEMINI_API_KEY'] = 'fake'
    res = ai_narrative.generate_narrative({'stats': {'avg_score':0}} , symbol='BBCA')
    assert res == "dummy narrative"


if __name__ == "__main__":
    pytest.main([__file__])