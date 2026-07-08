@echo off
chcp 65001 >nul
echo ================================================
echo      财富管理智能体 - 启动脚本
echo ================================================
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到 npm，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

echo 正在检查依赖...
if not exist node_modules (
    echo 未找到 node_modules，正在安装依赖...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

echo.
echo 正在启动财富管理智能体...
echo.
npm run electron:dev
