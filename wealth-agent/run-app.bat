@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Wealth Agent - Launcher (v10)
echo ==============================================
echo.
echo Current directory: %cd%
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo Please install LTS from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js version: %%i
for /f "tokens=*" %%i in ('npm -v') do echo npm version: %%i
echo.

if not exist "node_modules\electron" (
    echo [Step 1/2] Installing Electron runtime - this takes 1-3 minutes on first run...
    echo.
    call npm install --no-audit --no-fund
    echo.
    if errorlevel 1 (
        echo [ERROR] npm install failed. Trying with China mirror...
        set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
        call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
        if errorlevel 1 (
            echo.
            echo [FATAL] Cannot install dependencies.
            echo Please check your internet or npm configuration and try again.
            echo.
            pause
            exit /b 1
        )
    )
    echo [OK] Dependencies installed.
    echo.
)

if not exist "dist\index.html" (
    echo [ERROR] dist\index.html not found!
    echo The frontend build output is missing.
    echo.
    pause
    exit /b 1
)

echo [Step 2/2] Starting application...
echo.

if exist "node_modules\.bin\electron.cmd" (
    call node_modules\.bin\electron.cmd .
) else (
    call npx electron .
)

set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Application exited with code %EXIT_CODE%
    echo.
    echo Troubleshooting tips:
    echo   1. Delete the node_modules folder and run this script again
    echo   2. Make sure no antivirus is blocking electron.exe
    echo   3. Try: set ELECTRON_SKIP_BINARY_DOWNLOAD=
    echo.
)

echo.
echo Window closed. Press any key to exit.
pause >nul

endlocal
