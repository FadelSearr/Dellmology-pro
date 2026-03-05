import requests

API_URL = "https://analyze-deployment-approaches-gem.trycloudflare.com"  # Ganti dengan PUBLIC_ENGINE_URL dari .env
ML_ENGINE_KEY = "development_key_change_in_production"  # Ganti sesuai .env

def check_endpoint(path, method="GET", data=None):
    url = f"{API_URL}{path}"
    headers = {"Authorization": f"Bearer {ML_ENGINE_KEY}"}
    try:
        if method == "GET":
            r = requests.get(url, headers=headers)
        else:
            r = requests.post(url, headers=headers, json=data)
        print(f"{path}: {r.status_code} - {r.text[:100]}")
    except Exception as e:
        print(f"{path}: ERROR - {e}")

# Cek endpoint GET
for ep in [
    "/api/market-regime?symbol=BBCA",
    "/api/market-intelligence?symbol=BBCA",
    "/api/broker-flow?symbol=BBCA&days=7",
    "/api/global-correlation",
    "/events",
    "/api/metrics?symbol=BBCA",
    "/model-alerts/thresholds?symbol=BBCA",
    "/retrain/status",
    "/telegram/history"
]:
    check_endpoint(ep)

# Cek endpoint POST
check_endpoint("/cnn/predict", method="POST", data={"symbol": "BBCA"})
check_endpoint("/xai/explain", method="POST", data={"symbol": "BBCA"})
check_endpoint("/retrain/trigger", method="POST", data={"symbol": "BBCA"})
check_endpoint("/telegram/alert", method="POST", data={"message": "Test alert"})