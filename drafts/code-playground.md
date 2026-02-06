---
title: "Learning about linux sandboxing by building a Coding Playground"
date: "2026-01-28"
slug: "code-playground"
---

Initially, I wanted to write something about C, but the problem with C is that, it's not easy to run it interactively on the browsers, unlike Javascript.
So, I was thinking, maybe we can use web assembly? Then I went to [wasmer-js](https://github.com/wasmerio/wasmer-js)
but there are issues with their [Cross-origin Isolation](https://github.com/wasmerio/wasmer-js?tab=readme-ov-file#cross-origin-isolation) headers that I couldn't fix after some tries :\\
"Well, you know what, let's just make my own flavour of web-based C compiler," I said. So I did, with the help of some AI tools, I managed to draft something using python and GCC.
The code was simply to run GCC in a python backend, run it in my private server, and that was it, I was done, I could run C in my browser by injecting GCC with values directly from browsers.

So, finished, right? not yet. I actually asked another LLM to scan for "security vulnerabilities", the nature of transformer's attention is that, if we asked an LLM to generate something without the correct prompt, it will not focus on that side.
In my case, I did not ask for any security-related prompt in my initial code generation, so I imagined my generated python code was unsecure in a way that I didn't aware of.

After a couple of prompts, I managed to install a safer version using [firejail](https://github.com/netblue30/firejail), but the code did not work at all! Then, I did the thing: I kept asking LLM to "fix this" and "this does not worked" to NO AVAIL.
This behaviour is probably one of the most dangerous behaviour a programmer can do while interacting with LLMs. While LLMs can help in increasing productivity in some code that have multitude of training data, it's still so bad in a very niche environments. In my case, the firejail error is never successfully resolved by every LLM that I used (agent mode / chatbot mode), so I asked for an alternative: Bubblewrap.
Then I checked [bubblewrap's repository](https://github.com/containers/bubblewrap) and raised my eyebrow when it's said that bubblewrap is used in Flatpak. "Huh?" I thought, positively, and I was certain that this journey will probably have a better end than to keep fixing firejail's bug, and I was correct.

To my surprise, the code works, yay!? The final code looks like this:

```python
#!/usr/bin/env python3
"""C Code Executor with bubblewrap sandbox."""

import subprocess
import tempfile
import os
import json
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3001
MAX_CODE_SIZE = 64 * 1024

MAX_STDERR = 10000
MAX_STDOUT = 10000


class CExecutorHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_POST(self):
        if self.path != '/execute':
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())
            return

        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0 or content_length > MAX_CODE_SIZE:
            self._set_headers(413)
            self.wfile.write(json.dumps({'error': 'Invalid size'}).encode())
            return

        body = self.rfile.read(content_length)
        try:
            data = json.loads(body.decode('utf-8'))
            code = data.get('code', '')
        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode())
            return

        result = self.execute_c_code(code)
        self._set_headers(200)
        self.wfile.write(json.dumps(result).encode())

    def execute_c_code(self, code):
        work_dir = tempfile.mkdtemp(prefix='c_exec_')
        source_file = os.path.join(work_dir, 'main.c')
        binary_file = os.path.join(work_dir, 'main')

        try:
            with open(source_file, 'w') as f:
                f.write(code)

            # Compile with bwrap (read-only root, writable work_dir)
            compile_result = subprocess.run(
                [
                    'bwrap',
                    '--tmpfs', '/',
                    '--unshare-pid',
                    '--ro-bind', '/usr', '/usr',
                    '--ro-bind', '/bin', '/bin',
                    '--ro-bind', '/lib', '/lib',
                    '--ro-bind', '/lib64', '/lib64',
                    '--dir', '/work',
                    '--ro-bind', '/etc/alternatives', '/etc/alternatives',  # GCC needs this
                    '--ro-bind', '/etc/ld.so.cache', '/etc/ld.so.cache',   # Dynamic linker needs this
                    '--bind', work_dir, work_dir,
                    '--dev', '/dev',
                    '--proc', '/proc',
                    '--die-with-parent',  # Kill if server dies
                    '--',
                    'gcc', '-o', binary_file, source_file, '-lm', '-Wall', '-Wextra',
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if compile_result.returncode != 0:
                return {
                    'success': False,
                    'stage': 'compile',
                    'stderr': compile_result.stderr[:MAX_STDERR],
                    'exit_code': compile_result.returncode
                }

            if not os.path.exists(binary_file):
                return {
                    'success': False,
                    'stage': 'compile',
                    'stderr': 'Compilation failed: no binary output',
                    'exit_code': -1
                }

            # Run with bwrap (isolated /tmp, read-only system)
            run_result = subprocess.run(
                [
                    'bwrap',
                    '--tmpfs', '/',
                    '--unshare-pid',
                    '--ro-bind', '/usr', '/usr',
                    '--ro-bind', '/bin', '/bin',
                    '--ro-bind', '/lib', '/lib',
                    '--ro-bind', '/lib64', '/lib64',
                    '--dir', '/work',
                    '--ro-bind', '/etc/alternatives', '/etc/alternatives',  # GCC needs this
                    '--ro-bind', '/etc/ld.so.cache', '/etc/ld.so.cache',   # Dynamic linker needs this
                    '--bind', work_dir, work_dir,
                    '--dev', '/dev',
                    '--proc', '/proc',
                    '--die-with-parent',
                    '--',
                    binary_file,
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )

            return {
                'success': run_result.returncode == 0,
                'stage': 'run',
                'stdout': run_result.stdout[:MAX_STDOUT],
                'stderr': run_result.stderr[:MAX_STDERR],
                'exit_code': run_result.returncode
            }

        except subprocess.TimeoutExpired:
            return {'success': False, 'stage': 'timeout', 'stderr': 'Execution timed out', 'exit_code': -1}
        except Exception as e:
            return {'success': False, 'stage': 'error', 'stderr': str(e), 'exit_code': -1}
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), CExecutorHandler)
    print(f"C Executor running on http://127.0.0.1:{PORT}")
    print("Sandbox: bubblewrap (read-only filesystem)")
    server.serve_forever()
```
