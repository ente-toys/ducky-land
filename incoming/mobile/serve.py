#!/usr/bin/env python3
"""Local, uncached playground on the mobile lane's assigned port."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Uncached(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    root = Path(__file__).resolve().parent / 'rive/web'
    server = ThreadingHTTPServer(('127.0.0.1', 8807), partial(Uncached, directory=str(root)))
    print('Ducky Land mobile: http://127.0.0.1:8807/', flush=True)
    server.serve_forever()
