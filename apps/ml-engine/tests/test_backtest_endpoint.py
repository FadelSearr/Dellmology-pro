import os
from fastapi.testclient import TestClient


def test_models_backtest_endpoint(monkeypatch):
    # Ensure admin token is present before importing the app
    # Set both keys to be safe: some codepaths compare against ADMIN_TOKEN
    # while others use ML_ENGINE_KEY. Set both before importing the app.
    monkeypatch.setenv('ML_ENGINE_KEY', 'testkey')
    monkeypatch.setenv('ADMIN_TOKEN', 'testkey')

    # Import app after setting env
    from main import app

    client = TestClient(app)

    payload = {
        'model_name': 'TEST_MODEL',
        'start_date': '2023-01-01',
        'end_date': '2023-02-01'
    }

    headers = {'x-admin-token': 'testkey'}
    resp = client.post('/models/backtest', json=payload, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert 'backtest' in body
    result = body['backtest']
    # basic shape expectations
    assert result.get('model_name') == 'TEST_MODEL'
    assert 'trades' in result
    assert 'net_return_pct' in result
