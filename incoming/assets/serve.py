#!/usr/bin/env python3
"""Local static preview only. No network services, account or deployment."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os,argparse
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8809);a=p.parse_args()
os.chdir(Path(__file__).resolve().parent)
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store');super().end_headers()
print(f'Ducky assets: http://127.0.0.1:{a.port}/proof.html',flush=True)
ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
