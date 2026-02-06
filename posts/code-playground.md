---
title: "Learning about linux sandboxing by building a Coding Playground"
date: "2026-02-06"
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

To my surprise, the code works, yay!? This is the relevant part of the <a href="https://github.com/mfakhrusy/c-executor/blob/main/server.py" target="_blank" rel="noopener noreferrer">source code:</a>

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
        # headers goes here

    def do_OPTIONS(self):
        # OPTIONS request handler goes here

    def do_POST(self):
        # POST request handler goes here

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

The `bwrap` executable is our bubblewrap binary, with all of the configuration that is necessary to run the C code in isolation, in fact, I can import it now via iframe:

<iframe
  id="inlineFrameExample"
  title="Inline Frame Example"
  width="100%"
  height="700"
  src="https://c-playground.fahru.me">
</iframe>

To actually tested whether the sandboxing isolation works, I created some evil-looking code, for example, you can copy this C code to the playground above:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <unistd.h>
#include <sys/utsname.h>

int main() {
    printf("=== SANDBOX PENETRATION TEST ===\n\n");
    
    // 1. FULL /etc/passwd dump (remove the break to see everything)
    printf("[*] Testing /etc/passwd access...\n");
    FILE *f = fopen("/etc/passwd", "r");
    if (f) {
        printf("VULNERABILITY: Can read /etc/passwd!\n");
        char buf[256];
        int count = 0;
        while (fgets(buf, sizeof(buf), f) && count < 20) { // Limit to 20 users
            printf("  %s", buf);
            count++;
        }
        if (count >= 20) printf("  ... (truncated, total users available)\n");
        fclose(f);
    } else {
        printf("SAFE: /etc/passwd blocked\n");
    }
    
    // 2. Try to read shadow file (should fail without root perms, but test anyway)
    printf("\n[*] Testing /etc/shadow access...\n");
    f = fopen("/etc/shadow", "r");
    if (f) {
        printf("CRITICAL: Can read password hashes!\n");
        char buf[256];
        fgets(buf, sizeof(buf), f);
        printf("  %s", buf);
        fclose(f);
    } else {
        printf("SAFE: /etc/shadow blocked (permission denied)\n");
    }
    
    // 3. Hostname and system info
    printf("\n[*] Testing system information leakage...\n");
    char hostname[256];
    gethostname(hostname, sizeof(hostname));
    printf("HOSTNAME: %s\n", hostname);
    
    struct utsname uname_data;
    uname(&uname_data);
    printf("KERNEL: %s %s\n", uname_data.sysname, uname_data.release);
    
    // 4. Check if we're in a container
    printf("\n[*] Checking for container/virtualization...\n");
    f = fopen("/proc/1/cgroup", "r");
    if (f) {
        char buf[512];
        printf("CGROUPS (showing container type):\n");
        while (fgets(buf, sizeof(buf), f)) {
            if (strstr(buf, "docker") || strstr(buf, "lxc") || strstr(buf, "containerd")) {
                printf("  Container detected: %s", buf);
            }
        }
        fclose(f);
    }
    
    // 5. List /root directory (should be blocked)
    printf("\n[*] Testing /root access...\n");
    DIR *d = opendir("/root");
    if (d) {
        printf("CRITICAL: Can list /root!\n");
        struct dirent *dir;
        while ((dir = readdir(d)) != NULL) {
            if (dir->d_name[0] != '.')
                printf("  /root/%s\n", dir->d_name);
        }
        closedir(d);
    } else {
        printf("SAFE: /root blocked\n");
    }
    
    // 6. Try to read SSH keys if they exist
    printf("\n[*] Testing for SSH keys in /home...\n");
    DIR *home = opendir("/home");
    if (home) {
        struct dirent *user;
        while ((user = readdir(home)) != NULL) {
            if (user->d_name[0] == '.') continue;
            
            char ssh_path[512];
            snprintf(ssh_path, sizeof(ssh_path), "/home/%s/.ssh/id_rsa", user->d_name);
            
            f = fopen(ssh_path, "r");
            if (f) {
                printf("CRITICAL: Found SSH key: %s\n", ssh_path);
                char key_buf[128];
                fgets(key_buf, sizeof(key_buf), f);
                printf("  Preview: %.50s...\n", key_buf);
                fclose(f);
            }
        }
        closedir(home);
    }
    
    // 7. Environment variables (might contain secrets)
    printf("\n[*] Checking environment variables...\n");
    extern char **environ;
    int secrets = 0;
    for (int i = 0; environ[i] != NULL; i++) {
        if (strstr(environ[i], "KEY") || 
            strstr(environ[i], "SECRET") || 
            strstr(environ[i], "TOKEN") ||
            strstr(environ[i], "PASS") ||
            strstr(environ[i], "API")) {
            printf("POTENTIAL SECRET: %.50s...\n", environ[i]);
            secrets++;
        }
    }
    if (secrets == 0) printf("No obvious secrets found\n");
    
    // 8. Network test (can we reach out?)
    printf("\n[*] Testing network access...\n");
    int net_test = system("ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 && echo 'Network: UNRESTRICTED' || echo 'Network: BLOCKED'");
    
    // 9. Process enumeration (what can we see?)
    printf("\n[*] Enumerating processes...\n");
    DIR *proc = opendir("/proc");
    if (proc) {
        int pids = 0;
        struct dirent *entry;
        while ((entry = readdir(proc)) != NULL) {
            if (entry->d_name[0] >= '0' && entry->d_name[0] <= '9') {
                pids++;
            }
        }
        closedir(proc);
        printf("Can see %d processes (host has full process table exposed)\n", pids);
        
        if (pids > 50) {
            printf("VULNERABILITY: PID namespace not isolated!\n");
        }
    }
    
    // 10. Write test (should fail)
    printf("\n[*] Testing write access to /...\n");
    f = fopen("/hacked.txt", "w");
    if (f) {
        fprintf(f, "If you see this, the system is writable!\n");
        fclose(f);
        printf("CRITICAL: Can write to filesystem!\n");
        remove("/hacked.txt");
    } else {
        printf("SAFE: Filesystem is read-only\n");
    }
    
    printf("\n=== TEST COMPLETE ===\n");
    return 0;
}
```

This is the screenshot of the result, the "CRITICAL: Can write to filesystem!" seems like a problem at first, but actually, the "hacked.txt" is created inside the temporary root folder of the bwrap sandbox, pretty cool huh? That means, that file was indeed created when I run the code, but it's not created inside a real root, but in a simulated/sandboxed root.

![Site State](../assets/code-playground/code-playground-1.png)
