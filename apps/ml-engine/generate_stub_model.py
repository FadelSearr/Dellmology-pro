#!/usr/bin/env python3
"""Generate a lightweight JSON stub model for inference_server testing.

This writes `toy_cnn_stub.json` next to `inference_server.py`. The stub contains
an `input_shape` and optional fixed `predictions` array.

Usage:
    python generate_stub_model.py --output-dir . --classes 2 --samples 2
"""
import json
import argparse
import os

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', default='.', help='Directory to write the stub')
parser.add_argument('--classes', type=int, default=2, help='Number of output classes')
parser.add_argument('--samples', type=int, default=2, help='Number of sample predictions to include')
args = parser.parse_args()

stub = {
    'input_shape': [16, 16, 1],
    'predictions': []
}
# create simple uniform predictions
for _ in range(args.samples):
    p = [round(1.0/args.classes, 6) for _ in range(args.classes)]
    stub['predictions'].append(p)

out_path = os.path.join(args.output_dir, 'toy_cnn_stub.json')
with open(out_path, 'w') as f:
    json.dump(stub, f, indent=2)
print('Wrote stub model to', out_path)
