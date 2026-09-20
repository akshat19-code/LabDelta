@echo off
title LabΔ — LabDelta
cd /d "%~dp0"

set "PYTHON_EXE=.\backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" run.py %*
if errorlevel 1 (
    echo.
    echo LabDelta exited with an error.
    pause
)
