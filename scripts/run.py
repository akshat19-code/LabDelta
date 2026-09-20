"""
LabDelta (LabΔ) Unified Launcher
Runs both FastAPI backend and Vite frontend concurrently within a single console window.
Handles port collision recovery, live health checking, browser launch, and graceful process tree shutdown.
"""

import sys
import os
import time
import signal
import atexit
import threading
import subprocess
import webbrowser
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_VENV_PYTHON = os.path.join(ROOT_DIR, "backend", ".venv", "Scripts", "python.exe")

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

# Determine python executable
if os.path.exists(BACKEND_VENV_PYTHON):
    PYTHON_EXE = BACKEND_VENV_PYTHON
else:
    PYTHON_EXE = sys.executable

procs = []
_cleaned_up = False

def kill_port_listeners(port):
    """Cleanly terminates any lingering process on the given port to avoid [Errno 10048]."""
    if sys.platform != "win32":
        return
    try:
        cmd = f'netstat -aon | findstr ":{port}" | findstr "LISTENING"'
        out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
        pids = set()
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5:
                pids.add(parts[-1])
        current_pid = str(os.getpid())
        for pid in pids:
            if pid and pid != "0" and pid != current_pid:
                subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def cleanup():
    """Gracefully terminates all child processes and process trees."""
    global _cleaned_up
    if _cleaned_up:
        return
    _cleaned_up = True
    for p in procs:
        if p and p.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
                else:
                    p.terminate()
            except Exception:
                pass

atexit.register(cleanup)

def signal_handler(sig, frame):
    print("\n\n[LabΔ] Stopping servers...")
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
if hasattr(signal, "SIGTERM"):
    signal.signal(signal.SIGTERM, signal_handler)

def stream_output(pipe, prefix, color_code):
    """Pumps child process stdout lines with clean colored prefixes."""
    try:
        for line in iter(pipe.readline, ""):
            if line:
                sys.stdout.write(f"\033[{color_code}m[{prefix}]\033[0m {line}")
                sys.stdout.flush()
    except Exception:
        pass

def wait_for_url(url, timeout=12.0):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LabDelta-Launcher"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in (200, 304):
                    return True
        except Exception:
            pass
        time.sleep(0.25)
    return False

def main():
    # Enable ANSI escape sequences on Windows console
    if sys.platform == "win32":
        os.system("")

    print("\033[1;35m" + "=" * 62 + "\033[0m")
    print("\033[1;35m            LabΔ — LabDelta Development Launcher           \033[0m")
    print("\033[1;35m" + "=" * 62 + "\033[0m")
    print()

    # 1. Clear any zombie listeners on ports 8000 and 5173
    print("Checking ports 8000 and 5173...")
    kill_port_listeners(BACKEND_PORT)
    kill_port_listeners(FRONTEND_PORT)

    # 2. Launch FastAPI backend
    print(f"Starting FastAPI Backend on http://127.0.0.1:{BACKEND_PORT}...")
    backend_cmd = [
        PYTHON_EXE,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(BACKEND_PORT),
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    procs.append(backend_proc)

    # 3. Launch Vite frontend
    print(f"Starting Vite Frontend on http://127.0.0.1:{FRONTEND_PORT}...")
    if sys.platform == "win32":
        frontend_cmd = ["cmd.exe", "/c", "npm", "run", "dev"]
    else:
        frontend_cmd = ["npm", "run", "dev"]

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    procs.append(frontend_proc)

    # Start stream threads
    t_back = threading.Thread(target=stream_output, args=(backend_proc.stdout, "backend", "36"), daemon=True)
    t_front = threading.Thread(target=stream_output, args=(frontend_proc.stdout, "frontend", "35"), daemon=True)
    t_back.start()
    t_front.start()

    # 4. Wait for both servers to be ready
    print("Waiting for servers to initialize...")
    b_ready = wait_for_url(f"http://127.0.0.1:{BACKEND_PORT}/health", timeout=12.0)
    f_ready = wait_for_url(f"http://127.0.0.1:{FRONTEND_PORT}", timeout=12.0)

    print()
    print("\033[1;32m" + "=" * 62 + "\033[0m")
    if b_ready and f_ready:
        print("\033[1;32m  ✓ LabΔ is active and ready!                             \033[0m")
    else:
        print("\033[1;33m  ! LabΔ servers started (still warming up...)            \033[0m")
    print(f"  • Application : \033[1;34mhttp://localhost:{FRONTEND_PORT}\033[0m")
    print(f"  • API Backend : \033[1;34mhttp://127.0.0.1:{BACKEND_PORT}\033[0m")
    print(f"  • Docs / OpenAPI: http://127.0.0.1:{BACKEND_PORT}/docs")
    print()
    print("  \033[1mPress [Ctrl+C] in this window to stop both servers.\033[0m")
    print("\033[1;32m" + "=" * 62 + "\033[0m")
    print()

    # Open browser
    try:
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")
    except Exception:
        pass

    # Keep alive while child processes run
    try:
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print(f"\n[LabΔ] Backend process exited (code {backend_proc.returncode}).")
                break
            if frontend_proc.poll() is not None:
                print(f"\n[LabΔ] Frontend process exited (code {frontend_proc.returncode}).")
                break
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == "__main__":
    main()
