"""Local-only server, no cache, no external dependencies."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import base64
import re
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def do_POST(self):
        # Optional local QA sink. Only our own test page can save named evidence.
        if not getattr(self.server, 'qa', False) or self.path != '/__qa':
            self.send_error(404); return
        origin = self.headers.get('Origin')
        if origin != f'http://127.0.0.1:{self.server.server_port}':
            self.send_error(403); return
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 15000000:
            self.send_error(413); return
        try:
            body=json.loads(self.rfile.read(length))
            name=body['name']
            if not re.fullmatch(r'[a-z0-9-]{1,70}',name): raise ValueError('name')
            shots=Path(__file__).resolve().parent/'shots'
            shots.mkdir(exist_ok=True)
            if 'png' in body:
                data=base64.b64decode(body.pop('png').split(',',1)[1],validate=True)
                if not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('png')
                (shots/(name+'.png')).write_bytes(data)
            (shots/(name+'.json')).write_text(json.dumps(body,indent=2)+'\n')
        except (ValueError,KeyError,IndexError):
            self.send_error(400); return
        self.send_response(204); self.end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8802);p.add_argument('--qa',action='store_true');a=p.parse_args()
    web=Path(__file__).resolve().parent/'web'
    server=ThreadingHTTPServer(('127.0.0.1',a.port),lambda *args,**kw:Handler(*args,directory=str(web),**kw))
    server.qa=a.qa
    print(f'Ducky Land activities: http://127.0.0.1:{a.port}/',flush=True)
    server.serve_forever()
