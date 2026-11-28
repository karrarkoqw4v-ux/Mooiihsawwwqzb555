# تلفزيون Roku وهمي على الجهاز المضيف: يرد على الاكتشاف ويسجل كل أمر يصله من التطبيق
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
LOG = open('roku.log', 'a', buffering=1)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        LOG.write(f'GET {self.path}\n')
        if self.path.startswith('/query/device-info'):
            body = b'<device-info><friendly-device-name>Fake Roku</friendly-device-name></device-info>'
            self.send_response(200); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        LOG.write(f'POST {self.path}\n')
        self.send_response(200); self.send_header('Content-Length', '0'); self.end_headers()

ThreadingHTTPServer(('0.0.0.0', 8060), H).serve_forever()
