@echo off
chcp 65001 >nul
echo ================================================
echo      Wealth Agent - Update Script
echo ================================================
echo.

where git >nul 2>&1
if %errorlevel% equ 0 (
    echo [1/3] Updating from GitHub...
    git pull origin main
    if %errorlevel% neq 0 (
        echo Warning: git pull failed, trying re-clone...
        cd ..
        rmdir /s /q wealth-agent-main >nul 2>&1
        git clone https://github.com/Kingbulude/wealth-agent.git wealth-agent-main
        cd wealth-agent-main
    )
) else (
    echo Git not installed. Please update manually.
    echo Download: https://github.com/Kingbulude/wealth-agent/archive/refs/heads/main.zip
    pause
    exit /b 1
)

echo.
echo [2/3] Installing dependencies...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --registry=https://registry.npmmirror.com

if %errorlevel% neq 0 (
    echo Failed to install dependencies, retrying...
    rmdir /s /q node_modules >nul 2>&1
    del package-lock.json >nul 2>&1
    npm install --registry=https://registry.npmmirror.com
)

echo.
echo [3/3] Update completed!
echo.
echo Start: npm run electron:dev
echo Build: npm run electron:build
echo.
pause