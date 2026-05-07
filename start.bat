@echo off
setlocal

set "BACKEND_DIR=%~dp0backend"
set "MONGO_URL=mongodb://localhost:27017"
set "MONGO_DB=SmartCare"
set "PORT=3000"

cd /d "%BACKEND_DIR%"
if errorlevel 1 (
  echo Backend directory not found: %BACKEND_DIR%
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=[int]$env:PORT; Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Host ('Stopping old process on port ' + $port + ': ' + $_); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo MongoDB: %MONGO_URL%/%MONGO_DB%
echo Server: http://localhost:%PORT%
node "%BACKEND_DIR%\server.js"

pause
