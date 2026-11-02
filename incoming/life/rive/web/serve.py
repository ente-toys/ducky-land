"""Local-only server, explicit root and no browser cache."""
import http.server
import re
from pathlib import Path
from functools import partial
class Fresh(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # Fixed local review output, never a path supplied by a web page.
        m=re.fullmatch(r'/__qa/([a-zA-Z0-9_-]+\.(?:png|json|webm))',self.path)
        n=int(self.headers.get('Content-Length','0'))
        if not m or n > 20000000:
            self.send_error(400); return
        dest=Path(__file__).resolve().parents[2]/'shots'/m.group(1)
        dest.write_bytes(self.rfile.read(n))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
if __name__=='__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1',8805),partial(Fresh,directory=str(Path(__file__).parent))).serve_forever()
