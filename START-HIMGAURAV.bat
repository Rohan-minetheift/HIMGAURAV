@echo off
setlocal
cd /d "%~dp0"
echo.
echo =====================================================
echo   HIMGAURAV v8.0 - Validation + Sentinel-1 SAR/InSAR Lab
echo =====================================================
echo.
echo Opening http://127.0.0.1:8818/#validation
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8818/#validation"
  set PORT=8818
  py serve.py
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8818/#validation"
  set PORT=8818
  python serve.py
  goto :eof
)
echo Python 3 was not found. Install Python 3, then run this file again.
pause
