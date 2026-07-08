@echo off
setlocal EnableDelayedExpansion
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

REM Set mirror for electron download
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

if not exist "node_modules\electron\dist\electron.exe" (
    echo Installing dependencies (first time may take 2-5 minutes)...
    echo Using Chinese mirror for faster download...
    echo.
    
    call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    
    if %errorlevel% neq 0 (
        echo.
        echo npm install failed, retrying with clean install...
        if exist "node_modules" rmdir /s /q node_modules
        if exist "package-lock.json" del package-lock.json
        call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    )
)

REM Check if electron binary exists
if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo Electron binary not found after npm install.
    echo Trying manual download...
    echo.
    
    REM Get electron version
    for /f "tokens=*" %%v in ('node -e "console.log(require('./package.json').devDependencies.electron.replace(/[\^~]/g, ''))"') do set "ELECTRON_VER=%%v"
    echo Electron version: !ELECTRON_VER!
    
    set "ELECTRON_ZIP=%TEMP%\electron-v!ELECTRON_VER!-win32-x64.zip"
    set "ELECTRON_URL=https://npmmirror.com/mirrors/electron/v!ELECTRON_VER!/electron-v!ELECTRON_VER!-win32-x64.zip"
    
    echo.
    echo Downloading from: !ELECTRON_URL!
    echo This may take a few minutes, please wait...
    echo.
    
    REM Download with PowerShell
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ProgressPreference='SilentlyContinue'; " ^
        "$url = '%ELECTRON_URL%'; " ^
        "$out = '%ELECTRON_ZIP%'; " ^
        "Write-Host 'Downloading Electron binary...'; " ^
        "try { " ^
        "  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing; " ^
        "  $size = [math]::Round((Get-Item $out).Length / 1MB, 1); " ^
        "  Write-Host ('Downloaded: ' + $size + ' MB'); " ^
        "} catch { " ^
        "  Write-Host 'Download failed:' $_.Exception.Message; " ^
        "  exit 1; " ^
        "}"
    
    if exist "%ELECTRON_ZIP%" (
        echo.
        echo Extracting...
        
        if not exist "node_modules\electron\dist" mkdir "node_modules\electron\dist"
        
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
            "Expand-Archive -Path '%ELECTRON_ZIP%' -DestinationPath 'node_modules\electron\dist' -Force"
        
        if exist "node_modules\electron\dist\electron.exe" (
            echo Electron binary installed successfully!
            del "%ELECTRON_ZIP%" >nul 2>&1
        ) else (
            echo.
            echo ERROR: Failed to extract electron.
        )
    )
)

if exist "node_modules\electron\dist\electron.exe" (
    REM Check if path.txt exists, if not create it
    if not exist "node_modules\electron\path.txt" (
        echo electron.exe > "node_modules\electron\path.txt"
        echo Created path.txt for electron.
    )
    echo Dependencies ready.
) else (
    echo.
    echo ================================================
    echo   ERROR: Cannot install Electron automatically
    echo ================================================
    echo.
    echo Please try these solutions:
    echo.
    echo 1. Check your internet connection
    echo.
    echo 2. Download manually:
    echo    Go to: https://npmmirror.com/mirrors/electron/
    echo    Find your version, download electron-vX.X.X-win32-x64.zip
    echo    Extract it to: node_modules\electron\dist\
    echo.
    echo 3. Or try using a VPN/proxy
    echo.
    pause
    exit /b 1
)
echo.

echo [Step 2] Starting Wealth Agent...
echo.
echo Press Ctrl+C to stop the application.
echo ================================================
echo.

call npm run electron:dev

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
endlocal