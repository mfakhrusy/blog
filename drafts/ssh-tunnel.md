---
title: "SSH Tunnel"
date: "2026-01-25"
slug: "ssh-tunnel"
---

```python
#!/usr/bin/env python3
"""
Minimal demo: localhost-only admin route with SSH tunnel access.

Run on remote server:
    python3 demo_localhost_only.py

Access from local machine:
    ssh -L 8080:localhost:8080 user@remote-server
    Then open: http://localhost:8080/admin
"""

from http.server import HTTPServer, BaseHTTPRequestHandler


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        client_ip = self.client_address[0]
        
        if self.path.startswith("/admin"):
            # Only allow localhost (127.0.0.1 or ::1)
            if client_ip not in ("127.0.0.1", "::1"):
                self.send_error(403, f"Forbidden: admin access blocked for {client_ip}")
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Admin Panel</h1><p>You accessed this via localhost!</p>")
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(f"<h1>Public Page</h1><p>Your IP: {client_ip}</p>".encode())


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8080), Handler)
    print("Server running on http://0.0.0.0:8080")
    print("Admin at /admin (localhost only)")
    print("\nTo access remotely: ssh -L 8080:localhost:8080 user@this-server")
    server.serve_forever()
```
