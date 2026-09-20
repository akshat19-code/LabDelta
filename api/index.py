"""
LabΔ (LabDelta) — Vercel Serverless Function Entrypoint
Exposes the core FastAPI application for Vercel Serverless Python runtime.
Zero business logic is duplicated here; imports directly from backend.main.
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
_repo_root = str(Path(__file__).resolve().parent.parent)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from backend.main import app
