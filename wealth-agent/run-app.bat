@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Wealth Agent - Launcher
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Please install LTS from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\electron" (
    echo [1/2] First run - installing Electron runtime (1-3 min)...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   Primary source failed, trying China mirror...
        set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
        call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
    )
)

echo [2/2] Starting application...
echo.

npx electron .

if errorlevel 1 (
    echo.
    echo [TIP] If startup failed, try deleting the node_modules folder and run this script again.
    echo.
    pause
)

endlocal
