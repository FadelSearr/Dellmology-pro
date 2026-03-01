import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np
import logging
import argparse
from datetime import date, timedelta

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_URL = "postgresql://admin:password@localhost:5433/dellmology"
DAILY_PRICES_TABLE = "daily_prices"
PREDICTION_TABLE = "cnn_predictions"
MODEL_VERSION = "mock-v1.0"
TARGET_SYMBOLS = ["BBCA", "TLKM", "GOTO", "BBNI", "ASII", "BMRI"]

# --- Database & Seeding Functions ---

def connect_to_db():
    """Establishes a connection to the PostgreSQL database."""
    try:
        engine = create_engine(DATABASE_URL)
        return engine
    except Exception as e:
        logging.fatal(f"FATAL: Could not connect to database. Error: {e}")
        raise

def seed_daily_prices(engine, symbol):
    """Generates and inserts fake historical OHLCV data for a given symbol."""
    logging.info(f"Checking for existing historical data for {symbol}...")
    
    # Check if data already exists to avoid re-seeding
    with engine.connect() as connection:
        result = connection.execute(text(f"SELECT COUNT(*) FROM {DAILY_PRICES_TABLE} WHERE symbol = '{symbol}'")).scalar()
        if result > 100:
            logging.info(f"Sufficient historical data for {symbol} already exists. Skipping seeding.")
            return

    logging.info(f"Generating 150 days of mock historical OHLCV data for {symbol}...")
    
    today = date.today()
    dates = [today - timedelta(days=i) for i in range(150)]
    dates.reverse() # Chronological order

    # Start with a random base price
    price = np.random.uniform(500, 10000)
    prices = []

    for _ in dates:
        open_price = price * np.random.uniform(0.98, 1.02)
        close_price = open_price * np.random.uniform(0.97, 1.03)
        high_price = max(open_price, close_price) * np.random.uniform(1.0, 1.04)
        low_price = min(open_price, close_price) * np.random.uniform(0.96, 1.0)
        volume = np.random.randint(1_000_000, 100_000_000)
        
        prices.append({
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'volume': volume
        })
        price = close_price # Next day's price is based on previous close

    df = pd.DataFrame(prices, index=pd.to_datetime(dates))
    df.index.name = 'date'
    df['symbol'] = symbol
    
    # Reorder columns to match the table
    df = df[['symbol', 'open', 'high', 'low', 'close', 'volume']]
    
    try:
        # Use a transaction to delete old data and insert new to ensure atomicity
        with engine.begin() as connection:
            connection.execute(text(f"DELETE FROM {DAILY_PRICES_TABLE} WHERE symbol = '{symbol}'"))
            df.to_sql(DAILY_PRICES_TABLE, connection, if_exists='append', index=True)
        logging.info(f"Successfully seeded historical data for {symbol}.")
    except Exception as e:
        logging.error(f"Failed to seed historical data for {symbol}: {e}")


def store_mock_prediction(engine, symbol):
    """Generates and stores a single mock prediction in the database."""
    logging.info(f"Generating and storing mock prediction for {symbol}...")
    
    prediction_date = date.today()
    
    # Generate a random prediction
    confidence_up = np.random.uniform(0.3, 0.9)
    confidence_down = 1.0 - confidence_up
    predicted_class = 'UP' if confidence_up > confidence_down else 'DOWN'

    df = pd.DataFrame([{
        'date': prediction_date,
        'symbol': symbol,
        'prediction': predicted_class,
        'confidence_up': confidence_up,
        'confidence_down': confidence_down,
        'model_version': MODEL_VERSION
    }])
    
    try:
        # Use ON CONFLICT to UPSERT the prediction for the day
        query = f"""
            INSERT INTO {PREDICTION_TABLE} (date, symbol, prediction, confidence_up, confidence_down, model_version)
            VALUES (:date, :symbol, :prediction, :confidence_up, :confidence_down, :model_version)
            ON CONFLICT (date, symbol) DO UPDATE
            SET prediction = EXCLUDED.prediction,
                confidence_up = EXCLUDED.confidence_up,
                confidence_down = EXCLUDED.confidence_down,
                model_version = EXCLUDED.model_version;
        """
        with engine.begin() as connection:
            connection.execute(text(query), df.to_dict('records'))
            
        logging.info(f"Successfully stored mock prediction for {symbol}: {predicted_class} ({max(confidence_up, confidence_down):.2%})")
    except Exception as e:
        logging.error(f"Failed to store mock prediction for {symbol}: {e}")

def cnn_predict(symbol: str, engine, use_real_model: bool = True) -> dict:
    """Generate and store a prediction using the trained CNN model.

    If a checkpoint cannot be found or an error occurs, fall back to the
    mock prediction generator.

    Returns a dictionary with the stored prediction record.
    """
    if not use_real_model:
        store_mock_prediction(engine, symbol)
        return {'status': 'mock', 'symbol': symbol}

    # Attempt real model inference
    logging.info(f"Running CNN inference for {symbol}...")
    try:
        import tensorflow as tf
        from model import StockCNN
    except ImportError as e:
        logging.error(f"TensorFlow/model import failed: {e}")
        store_mock_prediction(engine, symbol)
        return {'status': 'fallback', 'symbol': symbol}

    # load most recent 128 records from DB
    with engine.connect() as conn:
        query = text(f"SELECT open, high, low, close, volume FROM {DAILY_PRICES_TABLE} "
                     f"WHERE symbol = :sym ORDER BY date DESC LIMIT {MOVING_WINDOW_SIZE}")
        df = pd.read_sql(query, conn, params={"sym": symbol})

    if df.empty or len(df) < MOVING_WINDOW_SIZE:
        logging.warning("Not enough data for real prediction, using mock.")
        store_mock_prediction(engine, symbol)
        return {'status': 'fallback', 'symbol': symbol}

    # arrange in chronological order
    df = df.iloc[::-1]
    window = df[FEATURES].to_numpy()

    # normalize min-max per column
    min_vals = window.min(axis=0)
    max_vals = window.max(axis=0)
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1
    normalized_window = (window - min_vals) / range_vals

    # reshape to (1, MOVING_WINDOW_SIZE, len(FEATURES))
    input_array = normalized_window.reshape(1, MOVING_WINDOW_SIZE, len(FEATURES))

    # create graph and restore latest checkpoint
    checkpoint_dir = os.path.join(os.getcwd(), "checkpoints")
    saver = None
    prediction = None
    tf.compat.v1.reset_default_graph()
    with tf.compat.v1.Session() as sess:
        # placeholders same as in train.py
        image_ph = tf.compat.v1.placeholder(tf.float32, [None, MOVING_WINDOW_SIZE, len(FEATURES)], name="input_image")
        label_ph = tf.compat.v1.placeholder(tf.float32, [None, 2], name="input_label")
        dropout_ph = tf.compat.v1.placeholder(tf.float32, name="dropout_prob")

        model = StockCNN(image_ph, label_ph, dropout_prob=dropout_ph)
        saver = tf.compat.v1.train.Saver()

        # restore latest checkpoint
        try:
            latest = tf.train.latest_checkpoint(checkpoint_dir)
            if latest is None:
                raise FileNotFoundError("No checkpoint found")
            saver.restore(sess, latest)
        except Exception as e:
            logging.error(f"Failed to restore model: {e}")
            store_mock_prediction(engine, symbol)
            return {'status': 'fallback', 'symbol': symbol}

        # run prediction
        logits = sess.run(model.prediction, {image_ph: input_array, dropout_ph: 1.0})
        probs = tf.nn.softmax(logits).eval(session=sess)[0]
        up_conf, down_conf = float(probs[0]), float(probs[1])
        predicted = 'UP' if up_conf > down_conf else 'DOWN'

    # store prediction to DB
    prediction_date = date.today()
    df_rec = pd.DataFrame([{
        'date': prediction_date,
        'symbol': symbol,
        'prediction': predicted,
        'confidence_up': up_conf,
        'confidence_down': down_conf,
        'model_version': os.path.basename(latest) if latest else 'unknown'
    }])
    try:
        query = f"""
            INSERT INTO {PREDICTION_TABLE} (date, symbol, prediction, confidence_up, confidence_down, model_version)
            VALUES (:date, :symbol, :prediction, :confidence_up, :confidence_down, :model_version)
            ON CONFLICT (date, symbol) DO UPDATE
            SET prediction = EXCLUDED.prediction,
                confidence_up = EXCLUDED.confidence_up,
                confidence_down = EXCLUDED.confidence_down,
                model_version = EXCLUDED.model_version;
        """
        with engine.begin() as conn:
            conn.execute(text(query), df_rec.to_dict('records'))
        logging.info(f"Stored real prediction for {symbol}: {predicted} ({max(up_conf, down_conf):.2%})")
    except Exception as e:
        logging.error(f"Failed to store real prediction: {e}")
        return {'status': 'error', 'symbol': symbol}

    return {'status': 'real', 'symbol': symbol, 'prediction': predicted, 'confidence_up': up_conf, 'confidence_down': down_conf}


def main(symbol, real: bool = True):
    """Main function to run the data seeding and prediction process."""
    if symbol.upper() == 'ALL':
        symbols_to_process = TARGET_SYMBOLS
    else:
        symbols_to_process = [symbol.upper()]

    engine = connect_to_db()

    for sym in symbols_to_process:
        logging.info(f"--- Processing symbol: {sym} ---")
        # 1. Ensure historical data exists
        seed_daily_prices(engine, sym)
        
        # 2. Generate prediction (real or mock)
        result = cnn_predict(sym, engine, use_real_model=real)
        logging.info(f"Prediction result: {result}")
        logging.info(f"--- Finished processing {sym} ---")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed historical price data and generate a CNN prediction.")
    parser.add_argument("symbol", help="Stock symbol to process (e.g., BBCA), or 'ALL' to process all target symbols.")
    parser.add_argument("--real", action="store_true", help="Use trained CNN model for prediction instead of mock.")
    args = parser.parse_args()
    main(args.symbol, real=args.real)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed historical price data and generate a mock CNN prediction.")
    parser.add_argument("symbol", help="Stock symbol to process (e.g., BBCA), or 'ALL' to process all target symbols.")
    args = parser.parse_args()
    main(args.symbol)
