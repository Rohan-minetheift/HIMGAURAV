@echo off
setlocal
cd /d "%~dp0"
echo.
echo =====================================================
echo   HIMGAURAV v7.0 - Satellite + IoT + Working Alerts + AcuSearch Lab
echo =====================================================
echo.
echo Opening the AcuSearch Lab on http://127.0.0.1:8807/#rescue
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8807/#rescue"
  set PORT=8807
  py serve.py
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8807/#rescue"
  set PORT=8807
  python serve.py
  goto :eof
)
echo Python 3 was not found. Install Python 3, then run this file again.
pause
