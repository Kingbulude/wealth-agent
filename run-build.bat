@echo off
cd /d "%~dp0"
echo Step 1: Install dependencies...
if not exist "node_modules\vite" (
  call npm install
)
echo Step 2: Build frontend...
call npm run build
echo Step 3: Package Electron...
call npx electron-builder --win --x64
echo.
echo Done! Check release\ folder.
pause
