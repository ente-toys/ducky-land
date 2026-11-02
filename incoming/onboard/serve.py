"""Local-only, no-cache preview on the assigned port."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import json

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def do_POST(self):
        # Local QA artifacts only, with fixed output names and a strict size cap.
        destinations = {'/__qa/report': ('shots/browser-check.json', 'application/json'), '/__qa/wide': ('exports/my-ducky-x.png', 'image/png'), '/__qa/square': ('exports/my-ducky-square.png', 'image/png'), '/__qa/wardrobe': ('shots/wardrobe-native.png', 'image/png'), '/__qa/plaza': ('shots/plaza-native.png', 'image/png'), '/__qa/landing': ('shots/landing-native.png', 'image/png')}
        for name in ['01-join-browser','02-randomized-browser','03-landing-browser','04-plaza-browser','05-photo-mode-browser']:
            destinations['/__qa/'+name] = ('shots/'+name+'.png', 'image/png')
        target = destinations.get(self.path)
        length = int(self.headers.get('Content-Length', 0))
        if not target or length > 15_000_000:
            self.send_error(400); return
        data = self.rfile.read(length)
        if target[1] == 'application/json':
            json.loads(data)
        elif not data.startswith(b'\x89PNG\r\n\x1a\n'):
            self.send_error(400); return
        path = Path(__file__).parent / target[0]
        path.write_bytes(data)
        self.send_response(204); self.end_headers()

if __name__ == '__main__':
    root = Path(__file__).parent / 'rive' / 'web'
    print('Ducky Land join + photo: http://127.0.0.1:8806/', flush=True)
    ThreadingHTTPServer(('127.0.0.1',8806), partial(Handler,directory=str(root))).serve_forever()
