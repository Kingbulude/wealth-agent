@echo off
chcp 65001 >nul
echo ================================================
echo      财富管理智能体 - 一键更新脚本
echo ================================================
echo.

where git >nul 2>&1
if %errorlevel% equ 0 (
    echo [1/3] 正在从 GitHub 更新代码...
    git pull origin main
    if %errorlevel% neq 0 (
        echo 警告：git pull 失败，尝试重新克隆...
        cd ..
        rmdir /s /q wealth-agent-main >nul 2>&1
        git clone https://github.com/Kingbulude/wealth-agent.git wealth-agent-main
        cd wealth-agent-main
    )
) else (
    echo 未安装 Git，正在使用下载方式更新...
    echo 请手动下载最新版本：https://github.com/Kingbulude/wealth-agent/archive/refs/heads/main.zip
    pause
    exit /b 1
)

echo.
echo [2/3] 正在安装依赖（使用国内镜像）...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --registry=https://registry.npmmirror.com

if %errorlevel% neq 0 (
    echo 依赖安装失败，尝试删除 node_modules 后重试...
    rmdir /s /q node_modules >nul 2>&1
    del package-lock.json >nul 2>&1
    npm install --registry=https://registry.npmmirror.com
)

echo.
echo [3/3] 更新完成！
echo.
echo 启动命令：npm run electron:dev
echo 打包命令：npm run electron:build
echo.
pause
