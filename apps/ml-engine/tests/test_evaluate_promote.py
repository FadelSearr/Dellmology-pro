import sys, os
proj_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(proj_root)

from fastapi.testclient import TestClient
import json
from pathlib import Path


def test_evaluate_promote_writes_ups_and_promotes():
    from main import app as ml_app
    from dellmology.models.model_registry import registry

    client = TestClient(ml_app)

    # Ensure a predictable challenger/metrics
    with registry._lock:
        registry.champion = 'champion_v1'
        registry.champion_metrics = {}
        registry.challenger = 'test_challenger_123'
        registry.challenger_metrics = {'net_return_pct': 2.0, 'trades': 10}

    # locate UPS events file and note initial count
    logs_dir = Path(__file__).parent.parent / 'logs'
    out_file = logs_dir / 'ups_events.jsonl'
    initial_lines = []
    if out_file.exists():
        initial_lines = out_file.read_text(encoding='utf-8').splitlines()

    # Call evaluate-promote with auto_promote True
    resp = client.post('/api/maintenance/evaluate-promote', json={'auto_promote': True})
    assert resp.status_code == 200
    data = resp.json()

    # Verify evaluation result fields
    assert data.get('challenger') == 'test_challenger_123'
    assert data.get('passed') is True
    # When auto_promote True and thresholds met, registry should include 'promoted' True
    assert data.get('promoted') is True

    # Verify UPS event file was written/appended
    assert out_file.exists(), 'UPS events file should exist after evaluation'
    lines = out_file.read_text(encoding='utf-8').splitlines()
    assert len(lines) >= len(initial_lines) + 1

    # Check last event payload references our challenger
    last = json.loads(lines[-1])
    payload = last.get('payload') or {}
    assert payload.get('challenger') == 'test_challenger_123'
