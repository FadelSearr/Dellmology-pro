import http.server
import json
import sys

class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''
        try:
            parsed = json.loads(body.decode('utf-8')) if body else None
        except Exception as e:
            parsed = None
        print('--- Received POST ---')
        print('Path:', self.path)
        print('Headers:', dict(self.headers))
        print('Body:', body.decode('utf-8'))
        print('Parsed JSON:', parsed)
        sys.stdout.flush()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        resp = {'ok': True}
        self.wfile.write(json.dumps(resp).encode('utf-8'))

if __name__ == '__main__':
    port = 3001
    server = http.server.ThreadingHTTPServer(('0.0.0.0', port), WebhookHandler)
    print(f'Mock webhook listening on http://0.0.0.0:{port}/webhook')
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    print('Server stopped')
