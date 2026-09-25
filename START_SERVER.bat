@echo off
title HIMGAURAV v8 Server
color 0A
echo ==========================================
echo   HIMGAURAV v8 - Killing ghost processes
echo ==========================================

:: Kill anything on port 8818
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr "8818.*LISTEN"') do (
    echo Killing old process %%a...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo ==========================================
echo   Starting HIMGAURAV server on :8818
echo ==========================================
python serve.py
pause
