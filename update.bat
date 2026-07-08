@echo off
chcp 65001 >nul
echo ================================================
echo      Wealth Agent - Update Script
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

echo [Step 1] Check for Git...
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo Git found, pulling latest code...
    git pull origin main
    if %errorlevel% neq 0 (
        echo Warning: git pull failed, continuing with current files...
    ) else (
        echo Code updated successfully.
    )
) else (
    echo Git not installed. Skipping git pull.
    echo Using current files in this folder.
)
echo.

echo [Step 2] Installing dependencies...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund

if %errorlevel% neq 0 (
    echo.
    echo First install failed, retrying with clean install...
    rmdir /s /q node_modules >nul 2>&1
    del package-lock.json >nul 2>&1
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
)

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies.
    echo Please check your network connection.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Update completed!
echo ================================================
echo.
echo To start the app, run: start.bat
echo Or run directly: npm run electron:dev
echo.
pause