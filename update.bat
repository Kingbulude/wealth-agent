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

echo [Step 1] Looking for Git...

set "GIT_FOUND=0"
set "GIT_CMD="

REM Check 1: Standard PATH search
where git >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('where git') do (
        if exist "%%i" (
            set "GIT_CMD=%%i"
            set "GIT_FOUND=1"
            echo Git found in PATH.
            goto git_found
        )
    )
)

REM Check 2: Common install paths
if "%GIT_FOUND%"=="0" (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at Program Files.
        goto git_found
    )
)

if "%GIT_FOUND%"=="0" (
    if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files (x86)\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at Program Files (x86).
        goto git_found
    )
)

if "%GIT_FOUND%"=="0" (
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
        set "GIT_FOUND=1"
        echo Git found at LocalAppData.
        goto git_found
    )
)

REM Check 3: Look on other drives - Program Files
if "%GIT_FOUND%"=="0" (
    for %%d in (D E F G H) do (
        if exist "%%d:\Program Files\Git\cmd\git.exe" (
            set "GIT_CMD=%%d:\Program Files\Git\cmd\git.exe"
            set "GIT_FOUND=1"
            echo Git found at %%d:\Program Files\Git.
            goto git_found
        )
    )
)

REM Check 4: Look on other drives - root folder (e.g. D:\Git)
if "%GIT_FOUND%"=="0" (
    for %%d in (C D E F G H) do (
        if exist "%%d:\Git\cmd\git.exe" (
            set "GIT_CMD=%%d:\Git\cmd\git.exe"
            set "GIT_FOUND=1"
            echo Git found at %%d:\Git.
            goto git_found
        )
    )
)

:git_found
if "%GIT_FOUND%"=="1" (
    echo Pulling latest code...
    "%GIT_CMD%" pull origin main
    if %errorlevel% neq 0 (
        echo Warning: git pull failed, continuing with current files...
    ) else (
        echo Code updated successfully.
    )
) else (
    echo Git not found. Skipping code update.
    echo Using current files in this folder.
    echo.
    echo Tip: Install Git for automatic updates: https://git-scm.com/download/win
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