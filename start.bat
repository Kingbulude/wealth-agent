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
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

if not exist "node_modules\electron\dist\electron.exe" goto install_deps
goto check_electron

:install_deps
echo Installing dependencies (first time may take 2-5 minutes)
echo Using Chinese mirror for faster download
echo.

call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund

if errorlevel 1 (
    echo.
    echo npm install failed, retrying with clean install
    if exist "node_modules" rmdir /s /q node_modules
    if exist "package-lock.json" del package-lock.json
    call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
)

:check_electron
if exist "node_modules\electron\dist\electron.exe" goto electron_ok

echo.
echo ERROR: Electron binary not found.
echo.
echo Please try these solutions:
echo.
echo 1. Open CMD in this folder and run:
echo    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
echo    npx install-electron
echo.
echo 2. Or download manually from:
echo    https://npmmirror.com/mirrors/electron/
echo    Find v43.1.0, download electron-v43.1.0-win32-x64.zip
echo    Extract all files to: node_modules\electron\dist\
echo.
echo 3. Or use web version: run "npm run dev" and open http://localhost:5173
echo.
pause
exit /b 1

:electron_ok
if not exist "node_modules\electron\path.txt" (
    echo electron.exe > "node_modules\electron\path.txt"
    echo Created path.txt for electron
)
echo Dependencies ready
echo.

echo [Step 2] Starting Wealth Agent
echo.
echo Press Ctrl+C to stop the application.
echo ================================================
echo.

call npm run electron:dev

echo.
echo ================================================
if errorlevel 1 (
    echo App exited with error.
    echo.
    echo If the window flashes and closes:
    echo   1. Open another CMD window in this folder
    echo   2. Run: npm run dev
    echo   3. Open another CMD window and run: npx electron .
) else (
    echo App closed normally.
)
echo.
pause