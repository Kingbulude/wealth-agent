@echo off
setlocal EnableDelayedExpansion

echo ==============================================
echo   Wealth Agent - Installer (v11)
echo ==============================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js: %%i
for /f "tokens=*" %%i in ('npm -v') do echo [OK] npm: %%i
echo.

:: Read exact electron version from package-lock.json
set "ELECTRON_VER="
if exist "package-lock.json" (
    for /f "tokens=1,* delims=:" %%a in ('findstr /n "electron" package-lock.json') do (
        set "LINE=%%b"
        if not defined ELECTRON_VER (
            echo !LINE! | findstr /i "version" >nul 2>nul
            if !errorlevel! equ 0 (
                for /f "tokens=2 delims=:, " %%v in ("!LINE!") do set "ELECTRON_VER=%%v"
            )
        )
    )
)

:: Fallback: use npm view
if not defined ELECTRON_VER (
    echo [INFO] Detecting electron version via npm...
    for /f "tokens=*" %%v in ('npm view electron version') do set "ELECTRON_VER=%%v"
)

if not defined ELECTRON_VER (
    echo [ERROR] Cannot determine Electron version.
    pause
    exit /b 1
)

:: Strip quotes from version string
set "ELECTRON_VER=!ELECTRON_VER:"=!"

echo [INFO] Target Electron version: !ELECTRON_VER!
echo.

:: Check if dist folder exists
if exist "dist\index.html" (
    echo [OK] dist folder found.
) else (
    echo [INFO] dist folder missing - will build from source.
)
echo.

:: Check if electron binary already exists
if exist "node_modules\electron\dist\electron.exe" (
    echo [OK] Electron binary already installed.
    echo.
    goto :build_check
)

:: Step 1: npm install for all dependencies
echo [Step 1/5] Installing npm dependencies...
call npm config set registry https://registry.npmmirror.com
call npm install --no-audit --no-fund --ignore-scripts
if errorlevel 1 (
    echo [WARN] npm install failed, retrying with default registry...
    call npm install --no-audit --no-fund --ignore-scripts
    if errorlevel 1 (
        echo [FATAL] npm install failed.
        pause
        exit /b 1
    )
)
echo [OK] npm dependencies ready.
echo.

:: Step 2: Download Electron binary from Chinese mirror
:build_check
echo [Step 2/5] Checking/building dist folder...

if exist "dist\index.html" (
    echo [OK] dist folder already built.
) else (
    echo [INFO] Building frontend (first time only)...
    call npm run build
    if errorlevel 1 (
        echo [FATAL] Frontend build failed.
        pause
        exit /b 1
    )
    echo [OK] Frontend built.
)
echo.

:: Skip to electron binary check
goto :electron_check

:electron_skip_download
echo [OK] Electron binary already installed.
echo.
goto :start_app

:electron_check
if exist "node_modules\electron\dist\electron.exe" (
    echo [OK] Electron binary already installed.
    echo.
    goto :start_app
)

:: Step 3: Download Electron binary from Chinese mirror
echo [Step 3/5] Downloading Electron v!ELECTRON_VER! binary...
echo This takes 1-3 minutes on first run. Please wait...
echo.

set "ZIP_URL=https://npmmirror.com/mirrors/electron/electron-v!ELECTRON_VER!-win32-x64.zip"
set "ZIP_FILE=%TEMP%\electron-v!ELECTRON_VER!-win32-x64.zip"
set "EXTRACT_DIR=%TEMP%\electron-unpack"

echo [INFO] URL: !ZIP_URL!

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; " ^
    "$ProgressPreference='SilentlyContinue'; " ^
    "$url='!ZIP_URL!'; " ^
    "$out='!ZIP_FILE!'; " ^
    "Write-Host '[PS] Downloading Electron binary...'; " ^
    "try { " ^
    "    $wc = New-Object System.Net.WebClient; " ^
    "    $wc.DownloadFile($url, $out); " ^
    "    $sz = [math]::Round((Get-Item $out).Length / 1MB, 1); " ^
    "    Write-Host ('[PS] Downloaded: ' + $sz + ' MB'); " ^
    "} catch { " ^
    "    Write-Host '[ERROR] Download failed:' $_.Exception.Message; " ^
    "    exit 1; " ^
    "}"

if errorlevel 1 (
    echo.
    echo [ERROR] Download failed from npmmirror.
    echo Try running this script again - mirror sometimes is slow.
    pause
    exit /b 1
)
echo.

:: Step 4: Extract and install binary
echo [Step 4/5] Installing Electron binary...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; " ^
    "$zip='!ZIP_FILE!'; " ^
    "$extract='!EXTRACT_DIR!'; " ^
    "$dest=Join-Path $PWD 'node_modules\electron'; " ^
    "Write-Host '[PS] Extracting...'; " ^
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; " ^
    "if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }; " ^
    "[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $extract); " ^
    "$inner = (Get-ChildItem $extract -Directory)[0]; " ^
    "Write-Host '[PS] Installing to node_modules\electron...'; " ^
    "if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }; " ^
    "New-Item -ItemType Directory -Path $dest -Force | Out-Null; " ^
    "Copy-Item -Path ($inner.FullName + '\*') -Destination $dest -Recurse -Force; " ^
    "Write-Host '[PS] Cleaning temp files...'; " ^
    "Remove-Item $zip -Force -EA SilentlyContinue; " ^
    "Remove-Item $extract -Recurse -Force -EA SilentlyContinue; " ^
    "Write-Host '[PS] Done!'; "

if errorlevel 1 (
    echo [ERROR] Extraction failed.
    pause
    exit /b 1
)
echo.

:: Verify
if exist "node_modules\electron\dist\electron.exe" (
    for %%A in ("node_modules\electron\dist\electron.exe") do (
        echo [OK] electron.exe installed - %%~zA bytes
    )
) else (
    echo [ERROR] electron.exe not found after installation!
    pause
    exit /b 1
)
echo.

:: Step 5: Start the app
:start_app
echo [Step 5/5] Starting Wealth Agent...
echo.

npx electron .

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo ==============================================
if %EXIT_CODE% equ 0 (
    echo App closed normally.
) else (
    echo App exited with code %EXIT_CODE%
)
echo ==============================================
pause
endlocal
