@echo off
chcp 65001 >nul
title 财富管理智能体 - 一键打包工具

echo ============================================================
echo   财富管理智能体 一键打包工具
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/5] 检查 Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)
echo   ✅ Node.js 已安装
node --version
echo.

echo [2/5] 检查 npm 依赖...
if not exist "node_modules\vite" (
    echo   正在安装依赖（首次运行较慢，请耐心等待）...
    set ELECTRON_SKIP_BINARY_DOWNLOAD=1
    call npm config set registry https://registry.npmjs.org
    call npm install
    if %errorlevel% neq 0 (
        echo   ⚠️  官方源下载失败，尝试使用淘宝镜像...
        call npm config set registry https://registry.npmmirror.com
        call npm install
    )
) else (
    echo   ✅ 依赖已安装
)
echo.

echo [3/5] 清理旧的打包产物...
if exist "release" (
    rmdir /s /q "release"
    echo   ✅ 已清理 release 目录
)
echo.

echo [4/5] 构建前端页面...
call npm run build
if %errorlevel% neq 0 (
    echo   ❌ 前端构建失败！
    pause
    exit /b 1
)
echo   ✅ 前端构建完成
echo.

echo [5/5] 打包 Electron 应用...
call npx electron-builder --win --x64
if %errorlevel% neq 0 (
    echo.
    echo   ❌ Electron 打包失败！
    echo.
    echo   可能原因及解决方案：
    echo.
    echo   【原因 1】杀毒软件拦截 app-builder.exe
    echo   解决：临时关闭杀毒软件/Windows Defender 实时保护
    echo.
    echo   【原因 2】Electron 二进制文件未下载完成
    echo   解决：运行以下命令重新下载 electron：
    echo         set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    echo         cd /d "%~dp0"
    echo         call node node_modules\electron\install.js
    echo.
    echo   【原因 3】旧的 release 目录被占用
    echo   解决：关闭所有已打开的 exe，然后重新运行本脚本
    echo.
    pause
    exit /b 1
)
echo   ✅ 打包完成
echo.

echo ============================================================
echo   🎉 打包成功！可执行文件位置：
echo.
echo   - 绿色版目录：%cd%\release\win-unpacked\
echo     （直接双击里面的 exe 运行，不需要安装）
echo.
echo   - 安装版：%cd%\release\财富管理智能体-1.0.0-x64.exe
echo     （双击安装到电脑）
echo.
echo   - 免安装版：%cd%\release\财富管理智能体-1.0.0-portable.exe
echo     （双击直接运行，不写入注册表）
echo ============================================================
echo.
echo 提示：如果需要重新打包，请再次运行本脚本
pause
