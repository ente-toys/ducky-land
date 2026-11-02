#!/usr/bin/env python3
"""Local-only, no-cache preview. Run: python3 rive/web/serve.py"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os,json,re
os.chdir(Path(__file__).resolve().parent)
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/__version':
            data=':'.join(str(Path(p).stat().st_mtime_ns) for p in ['game.js','review.js','ducky-land.riv','world.json']).encode()
            self.send_response(200);self.end_headers();self.wfile.write(data);return
        super().do_GET()
    def do_POST(self):
        name=self.path.rsplit('/',1)[-1]
        if not re.fullmatch(r'[a-zA-Z0-9_.-]+',name):
            self.send_error(400);return
        data=self.rfile.read(min(int(self.headers.get('Content-Length',0)),20000000))
        out=Path(__file__).resolve().parents[2]/'shots'
        out.mkdir(exist_ok=True)
        (out/name).write_bytes(data)
        self.send_response(200);self.end_headers();self.wfile.write(b'ok')
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def log_message(self,*args):pass
print('Ducky Land: http://127.0.0.1:8801/',flush=True)
ThreadingHTTPServer(('127.0.0.1',8801),Handler).serve_forever()
