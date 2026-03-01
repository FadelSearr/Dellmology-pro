# 📈 CNN Model Training Guide

Dellmology Pro includes a deep convolutional neural network (CNN) for short-term price direction prediction. This document explains how to generate features, train the model, run inference, and integrate results into the dashboard.

## 1. Data Preparation

Historical price data is stored in the `daily_prices` table. Use the provided script to generate features for a given symbol:

```bash
cd apps/ml-engine
python feature_generator.py BBCA
```

The script:
- Downloads OHLCV rows from the database
- Normalizes each 128-day window using min-max scaling
- Labels each example based on 5-day forward return
- Saves two `.npy` files (`*_features.npy` and `*_labels.npy`) in `apps/ml-engine/processed_data`

> Repeat for other symbols as needed. You can run `python feature_generator.py ALL` once multiple symbols are configured.

## 2. Training the Model

Train the CNN using the `train.py` script, which reads the feature files:

```bash
cd apps/ml-engine
python train.py BBCA       # train on BBCA data only
# or
python train.py ALL --real  # train on all TARGET_SYMBOLS
```

Training configuration is at the top of `train.py` (batch size, steps, dropout, etc.). Checkpoints are saved in `apps/ml-engine/checkpoints`.

> The Docker image `ml-engine` already exposes training capability. You may start training via API call (see below).

## 3. Generating Predictions

Once the model is trained, produce daily predictions:

```bash
cd apps/ml-engine
python predict.py BBCA --real
```

 Predictions are stored in `cnn_predictions` table and include:
- `date`, `symbol`
- `prediction` (UP or DOWN)
- `confidence_up`, `confidence_down`
- `model_version` (checkpoint filename)

The `predict.py` command automatically seeds fake daily price history if needed. If no valid checkpoint exists, it falls back to a mock prediction.

### API Endpoints (ML Engine)

The FastAPI service exposes:

- `POST /cnn/train` – start training asynchronously
  ```json
  {"symbol":"BBCA"}
  ```

- `POST /cnn/predict` – run inference and store result
  ```json
  {"symbol":"BBCA","real":true}
  ```

Both endpoints require the `Authorization: Bearer <ML_ENGINE_KEY>` header.

### Frontend Access

The dashboard has an existing API route `/api/prediction?symbol=BBCA` that returns the latest prediction. This is used by the Market Intelligence Canvas to display model output.

> The frontend automatically polls this endpoint when the component loads.

## 4. UI Integration

The prediction appears as a small badge in the Market Intelligence Canvas header showing `UP` or `DOWN` with confidence bar. You can customize styling in `MarketIntelligenceCanvas.tsx`.

## 5. Monitoring & Retraining

- Retrain weekly or after major market regime shifts.
- Store historical performance metrics separately for evaluation.
- Add long‑running logs or integrate with MLflow if scaling.

## 6. Future Enhancements

- Automate daily prediction job via cron or scheduler.
- Add alerting based on model predictions (e.g., send Telegram when confidence > 80%).
- Explore more advanced models (LSTM, multi-symbol networks).
- Implement explainability (show which days influenced prediction).

Happy modelling! 🎯
