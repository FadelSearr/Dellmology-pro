"""Minimal Keras model scaffold for Fase 5 (CNN pattern recognition).

This file provides a tiny in-memory Keras model and a `predict` wrapper
that mirrors the simplified interface used by `inference.py`.

It is intentionally lightweight so it can run without GPU and be used in
CI/dev. Replace with a proper model when available.
"""
import numpy as np

try:
    # Import TensorFlow only when available; fall back to numpy-based stub
    import tensorflow as tf
    from tensorflow import keras
    USING_TF = True
except Exception:
    USING_TF = False


class SimpleCNN:
    def __init__(self):
        # input_shape: height, width, channels
        self.input_shape = (16, 16, 1)
        if USING_TF:
            self.model = self._build_keras_model()
        else:
            self.model = None

    def _build_keras_model(self):
        inputs = keras.Input(shape=self.input_shape)
        x = keras.layers.Rescaling(1.0 / 255)(inputs)
        x = keras.layers.Conv2D(8, 3, activation='relu')(x)
        x = keras.layers.MaxPool2D(2)(x)
        x = keras.layers.Flatten()(x)
        x = keras.layers.Dense(8, activation='relu')(x)
        outputs = keras.layers.Dense(2, activation='softmax')(x)
        model = keras.Model(inputs, outputs)
        # lightweight compile to allow predict calls
        model.compile(optimizer='adam', loss='sparse_categorical_crossentropy')
        return model

    def predict(self, batch_inputs):
        # batch_inputs: list of HxW arrays (no channels) or arrays shaped (H,W,1)
        b = np.array(batch_inputs)
        # add channel dim if missing
        if b.ndim == 3:
            b = b[..., np.newaxis]
        # resize/cast to model input shape if needed (naive)
        h, w, c = self.input_shape
        if b.shape[1] != h or b.shape[2] != w:
            # naive center-crop or pad with zeros
            out = np.zeros((b.shape[0], h, w, c), dtype=b.dtype)
            minh = min(h, b.shape[1])
            minw = min(w, b.shape[2])
            out[:, :minh, :minw, :] = b[:, :minh, :minw, :]
            b = out

        if USING_TF and self.model is not None:
            preds = self.model.predict(b, verbose=0)
            return preds.tolist()
        # fallback: return uniform dummy predictions
        probs = np.full((b.shape[0], 2), 0.5)
        return probs.tolist()


if __name__ == '__main__':
    m = SimpleCNN()
    print('SimpleCNN ready, input_shape=', m.input_shape, 'USING_TF=', USING_TF)
