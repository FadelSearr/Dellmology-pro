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
    # Tests run under pytest which intentionally lazy-loads the real backtest
    # runner. Patch `run_backtest` with a lightweight stub so the endpoint
    # returns a deterministic response without invoking heavy I/O.
    import main as ml_main
    ml_main.run_backtest = lambda model_name, start_date, end_date: {
        'model_name': model_name,
        'trades': 0,
        'net_return_pct': 0.0,
        'max_drawdown_pct': 0.0,
        'sharpe': 0.0
    }

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
