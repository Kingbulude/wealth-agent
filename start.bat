@echo off
chcp 65001 >nul
echo ================================================
echo      Wealth Agent - Startup Script
echo ================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i
for /f "tokens=*" %%i in ('npm -v') do echo npm: %%i
echo.

echo [Step 1] Checking dependencies...
if not exist "node_modules\electron\dist\electron.exe" (
    echo Installing dependencies (first time may take 2-5 minutes)...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: npm install failed!
        echo Please check your network connection.
        pause
        exit /b 1
    )
    echo Dependencies installed.
) else (
    echo Dependencies found.
)
echo.

echo [Step 2] Starting Wealth Agent...
echo.
echo Press Ctrl+C to stop the application.
echo ================================================
echo.

npm run electron:dev

echo.
echo ================================================
if %errorlevel% equ 0 (
    echo App closed normally.
) else (
    echo App exited with code: %errorlevel%
    echo.
    echo If the window flashes and closes:
    echo   1. Open another CMD window in this folder
    echo   2. Run: npm run dev
    echo   3. Open another CMD window and run: npx electron .
)
pause