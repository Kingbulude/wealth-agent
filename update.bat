@echo off
cd /d "%~dp0"

echo ================================================
echo      Wealth Agent - Update Script
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

echo [1/3] Looking for Git

set "GIT_FOUND=0"
set "GIT_CMD="

where git >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%i in ('where git') do (
        if exist "%%i" (
            set "GIT_CMD=%%i"
            set "GIT_FOUND=1"
            echo Git found in PATH
            goto git_found
        )
    )
)

if "%GIT_FOUND%"=="0" (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at Program Files
        goto git_found
    )
)

if "%GIT_FOUND%"=="0" (
    if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files (x86)\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at Program Files (x86)
        goto git_found
    )
)

if "%GIT_FOUND%"=="0" (
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at LocalAppData
        goto git_found
    )
)

if "%GIT_FOUND%"=="0" (
    for %%d in (D E F G H) do (
        if exist "%%d:\Program Files\Git\cmd\git.exe" (
            set "GIT_CMD=%%d:\Program Files\Git\cmd\git.exe"
            set "GIT_FOUND=1"
            echo Git found at %%d:\Program Files\Git
            goto git_found
        )
    )
)

if "%GIT_FOUND%"=="0" (
    for %%d in (C D E F G H) do (
        if exist "%%d:\Git\cmd\git.exe" (
            set "GIT_CMD=%%d:\Git\cmd\git.exe"
            set "GIT_FOUND=1"
            echo Git found at %%d:\Git
            goto git_found
        )
    )
)

:git_found
echo.

echo [2/3] Updating from GitHub

if "%GIT_FOUND%"=="1" (
    if exist ".git" (
        "%GIT_CMD%" pull origin main
        if not errorlevel 1 (
            echo Code updated successfully
            goto update_done
        ) else (
            echo Warning: git pull failed, trying alternative method
        )
    ) else (
        echo This is not a git repository
        echo Initializing git repository
        "%GIT_CMD%" init
        "%GIT_CMD%" remote add origin https://github.com/Kingbulude/wealth-agent.git
        "%GIT_CMD%" fetch origin main
        "%GIT_CMD%" checkout -f origin/main
        if not errorlevel 1 (
            echo Code updated successfully
            goto update_done
        ) else (
            echo Warning: git update failed, trying alternative method
        )
    )
) else (
    echo Git not found
)

REM Alternative: download via PowerShell
echo.
echo Using PowerShell to download latest version
echo This may take a minute
echo.

set "TEMP_DIR=%TEMP%\wealth-agent-update"
set "ZIP_FILE=%TEMP_DIR%\wealth-agent-main.zip"
set "EXTRACT_DIR=%TEMP_DIR%\wealth-agent-main"

if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $url='https://github.com/Kingbulude/wealth-agent/archive/refs/heads/main.zip'; $out='%ZIP_FILE%'; Write-Host 'Downloading latest code'; try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing; Write-Host 'Download complete' } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 }"

if exist "%ZIP_FILE%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TEMP_DIR%' -Force"
    
    if exist "%EXTRACT_DIR%" (
        echo Copying updated files
        xcopy "%EXTRACT_DIR%\*" "." /E /H /Y /R >nul 2>&1
        echo Files updated successfully
    ) else (
        echo ERROR: Failed to extract files
    )
    
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
) else (
    echo ERROR: Download failed, keeping current files
)

:update_done
echo.

echo [3/3] Installing dependencies
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund

if errorlevel 1 (
    echo.
    echo First install failed, retrying with clean install
    if exist "node_modules" rmdir /s /q node_modules
    if exist "package-lock.json" del package-lock.json
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
)

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies.
    echo Please check your network connection.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Update completed
echo ================================================
echo.
echo To start the app, run: start.bat
echo Or run directly: npm run electron:dev
echo.
pause