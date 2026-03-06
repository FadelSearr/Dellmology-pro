#!/usr/bin/env python3
"""Lightweight HTTP inference server for the SimpleCNN dummy harness.

Usage: python inference_server.py
Listens on 127.0.0.1:5000 and exposes `/infer?symbol=SYMBOL` which runs
`run_dummy_inference()` from `inference.py` and returns JSON.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import json
import time
import threading

import inference as inference_module


START_TIME = time.time()


class InferenceHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        # health endpoint
        if parsed.path == '/health':
            uptime = time.time() - START_TIME
            self._send_json({'status': 'ok', 'uptime_seconds': uptime})
            return

        if parsed.path != '/infer':
            self._send_json({'error': 'not found'}, status=404)
            return

        params = parse_qs(parsed.query)
        symbol = params.get('symbol', [''])[0]
        try:
            preds = inference_module.run_dummy_inference(batch_size=2)
            resp = {
                'symbol': symbol,
                'timestamp': time.time(),
                'predictions': preds,
            }
            self._send_json(resp)
        except Exception as e:
            self._send_json({'error': str(e)}, status=500)


def run_server(host='127.0.0.1', port=5000):
    server = HTTPServer((host, port), InferenceHandler)
    print(f'Inference server listening on http://{host}:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down inference server...')
        server.shutdown()


if __name__ == '__main__':
    run_server()
