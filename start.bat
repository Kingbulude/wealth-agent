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

echo [1/3] Checking dependencies...
if not exist "node_modules" (
    echo node_modules not found, installing...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
    echo.
)

echo [2/3] Checking dev dependencies...
if not exist "node_modules\.bin\concurrently" (
    echo Missing dev dependencies, reinstalling...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
    echo.
)

echo [3/3] Starting Wealth Agent...
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
    echo If the window flashes and closes, try running:
    echo   npm run dev
    echo Then in another terminal:
    echo   npx electron .
)
pause