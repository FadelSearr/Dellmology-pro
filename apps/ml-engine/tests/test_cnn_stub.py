from cnn_model import SimpleCNN


def test_cnn_predict_shape():
    model = SimpleCNN(input_shape=(8, 8, 1), num_classes=2)
    batch = [ [[0.0 for _ in range(8)] for _ in range(8)] for _ in range(3) ]
    preds = model.predict(batch)
    assert isinstance(preds, list)
    assert len(preds) == 3
    assert all(len(p) == 2 for p in preds)
