@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Wealth Agent - Launcher
echo ==============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装：
    echo         https://nodejs.org/  (建议下载 LTS 版本)
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\electron" (
    echo [1/2] 首次运行，正在安装 Electron 运行时（约 1-3 分钟）...
    call npm install --no-audit --no-fund 2>nul
    if %errorlevel% neq 0 (
        echo   - 主源失败，尝试国内镜像...
        set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
        call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com 2>nul
    )
)

echo [2/2] 启动应用...
echo.

npx electron .

if %errorlevel% neq 0 (
    echo.
    echo [提示] 如果启动失败，请尝试删除 node_modules 文件夹后再次运行本脚本。
    echo.
    pause
)

endlocal
