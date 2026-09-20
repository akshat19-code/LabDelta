@echo off
title Stop LabDelta
echo Stopping LabDelta backend and frontend servers...

taskkill /F /FI "WINDOWTITLE eq LabDelta Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq LabDelta Frontend*" >nul 2>&1

:: Also kill python uvicorn or node on ports 8000 and 5173 if lingering
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo LabDelta servers stopped.
timeout /t 2 >nul
