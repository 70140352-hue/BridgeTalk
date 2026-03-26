#!/usr/bin/env python3
"""
Bridge Talk — Local Development Server
Run: python serve.py
Then open: http://localhost:8000
"""

import http.server
import socketserver
import os
import sys

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required for webcam (getUserMedia) to work on localhost
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"  {self.address_string()} → {format % args}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("  🤝 Bridge Talk — PSL Sign Language App")
print("=" * 50)
print(f"  Server: http://localhost:{PORT}")
print(f"  Press Ctrl+C to stop")
print("=" * 50)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        sys.exit(0)
