"""Local only, no-cache prototype server. python3 rive/serve.py"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent / 'web')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
print('Ducky Land crowd brain: http://127.0.0.1:8808/', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8808), Handler).serve_forever()
