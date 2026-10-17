@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-sql.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Review the message above.
  pause
)
endlocal
