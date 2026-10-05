#!/usr/bin/env python3
"""Zero-dependency static server for local development.

Serves the repo root so that `index.html`, `src/` and `public/` resolve exactly
as they will behind any static host. ES modules require a real HTTP origin
(they are blocked under file://), which is why this exists.

    python3 serve.py [port]   # default 12000
"""
import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 12000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # No caching during development so edits are picked up on reload.
        self.send_header("Cache-Control", "no-store")
        # Needed if you later add SharedArrayBuffer-based tooling.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Serving {ROOT} at http://0.0.0.0:{PORT}/")
        httpd.serve_forever()
