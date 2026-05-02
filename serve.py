#!/usr/bin/env python3
"""
local static server for testing the bleelblep website.

usage:
    python serve.py            # serves on http://127.0.0.1:8000
    python serve.py 9000       # serves on http://127.0.0.1:9000

bound to localhost only — won't expose anything on your LAN.
caching is disabled so re-builds (notes / glypnik dev-view) show up
on a normal refresh without needing ctrl+F5.
"""
import http.server
import socketserver
import sys
import os
import mimetypes
import webbrowser

# windows console is cp1252 by default — make it utf-8 so ♡ prints fine
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# .ct (ciphertext) files are plain base64 text — make sure fetch() sees that
mimetypes.add_type("text/plain", ".ct")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
HOST = "127.0.0.1"

# serve from the directory this script lives in, regardless of cwd
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # quieter logging — drop the address, keep the request line
        sys.stderr.write(f"  {self.log_date_time_string()}  {fmt % args}\n")


def main():
    with socketserver.TCPServer((HOST, PORT), NoCacheHandler) as httpd:
        url = f"http://{HOST}:{PORT}/"
        print(f"\n  ♡ bleelblep · serving {ROOT}")
        print(f"    open: {url}")
        print(f"    notes: {url}notes/")
        print(f"    glypnik: {url}glypnik/")
        print(f"\n  ctrl+C to stop\n")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  bye ♡\n")


if __name__ == "__main__":
    main()
