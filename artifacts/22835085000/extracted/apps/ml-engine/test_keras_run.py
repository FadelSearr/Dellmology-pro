from keras_model import SimpleCNN

if __name__ == '__main__':
    m = SimpleCNN()
    print('Model input shape:', m.input_shape)
    preds = m.predict([[[0.0]*16 for _ in range(16)], [[0.0]*16 for _ in range(16)]])
    print('Predictions:', preds)
