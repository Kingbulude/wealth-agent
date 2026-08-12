@echo off
setlocal

echo ============================================================
echo   WEALTH AGENT - BUILD SCRIPT
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/5] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ERROR: Node.js not found!
    echo   Please install from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo   OK: Node.js %NODE_VER%
echo.

echo [2/5] Checking npm dependencies...
if not exist "node_modules\vite" (
    echo   Installing dependencies (first time may be slow)...
    set ELECTRON_SKIP_BINARY_DOWNLOAD=1
    call npm config set registry https://registry.npmjs.org
    call npm install
    if %errorlevel% neq 0 (
        echo   WARNING: Official source failed, trying mirror...
        call npm config set registry https://registry.npmmirror.com
        call npm install
    )
) else (
    echo   OK: Dependencies already installed
)
echo.

echo [3/5] Cleaning old build output...
if exist "release" (
    rmdir /s /q "release"
    echo   OK: Cleaned release folder
)
echo.

echo [4/5] Building frontend pages...
call npm run build
if %errorlevel% neq 0 (
    echo   ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo   OK: Frontend built successfully
echo.

echo [5/5] Packaging Electron application...
call npx electron-builder --win --x64
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Electron packaging failed!
    echo.
    echo   Possible causes and solutions:
    echo.
    echo   1. Antivirus blocking app-builder.exe
    echo      -> Temporarily disable antivirus/Windows Defender real-time protection
    echo.
    echo   2. Electron binary not downloaded
    echo      -> Run these commands:
    echo         set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    echo         call node node_modules\electron\install.js
    echo.
    echo   3. Old release files are locked
    echo      -> Close all running .exe windows and run again
    echo.
    pause
    exit /b 1
)
echo   OK: Packaging complete!
echo.

echo ============================================================
echo   SUCCESS! Your .exe files are ready:
echo.
echo   - Portable dir: %cd%\release\win-unpacked\
echo     (Double-click the .exe inside, no install needed)
echo.
echo   - Installer:  %cd%\release\wealth-agent-1.0.0-x64.exe
echo     (Double-click to install)
echo.
echo   - Portable exe: %cd%\release\wealth-agent-1.0.0-portable.exe
echo     (Run directly, no registry writes)
echo ============================================================
echo.
pause

endlocal
