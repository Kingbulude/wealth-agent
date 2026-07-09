@echo off
cd /d "%~dp0"

echo ================================================
echo      Wealth Agent - Startup Script
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found.
    echo Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i
for /f "tokens=*" %%i in ('npm -v') do echo npm: %%i
echo.

echo [Step 1] Checking dependencies

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

if not exist "node_modules" (
    echo Installing dependencies (first time may take 2-5 minutes)
    call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    if errorlevel 1 (
        echo npm install failed, retrying
        if exist "node_modules" rmdir /s /q node_modules
        if exist "package-lock.json" del package-lock.json
        call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    )
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo Electron binary not found, installing
    call npm install electron --registry=https://registry.npmmirror.com --no-audit --no-fund
)

if exist "node_modules\electron\dist\electron.exe" (
    if not exist "node_modules\electron\path.txt" (
        echo electron.exe> "node_modules\electron\path.txt"
    )
    echo Dependencies ready
) else (
    echo.
    echo ERROR: Electron binary not found
    echo.
    echo Please download manually:
    echo   https://npmmirror.com/mirrors/electron/
    echo   Download electron-v43.1.0-win32-x64.zip
    echo   Extract to: node_modules\electron\dist\
    echo.
    pause
    exit /b 1
)
echo.

echo [Step 2] Starting Vite dev server
echo.
start "Vite Dev Server" cmd /c "npm run dev"
echo Waiting for dev server to be ready

:wait_loop
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_loop

echo Dev server is ready
echo.

echo [Step 3] Starting Electron
echo.
echo Press Ctrl+C to stop the application
echo ================================================
echo.

set NODE_ENV=development
call npx electron .

echo.
echo ================================================
echo App closed
echo.
pause