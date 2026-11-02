"""Loopback-only Python http.server with fresh development assets."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def log_message(self,*args):
        pass
if __name__=='__main__':
    directory=Path(__file__).resolve().parent/'rive/web'
    print('Ducky Land: http://127.0.0.1:8800/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8800),partial(Handler,directory=str(directory))).serve_forever()
