@echo off
setlocal
cd /d "%~dp0\electron"
title Melyia - Build .exe

if not exist "node_modules" (
  echo Installing dependencies first...
  call npm install --no-fund --no-audit
)

if not exist "icon.png" (
  echo ERROR: icon.png missing. Run "Lancer Melyia App.bat" once first to generate it.
  pause
  exit /b 1
)

echo.
echo Building Melyia .exe (5-10 minutes)...
echo.
call npx electron-builder --win

if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Build OK ! Installeur dans : %~dp0dist\
echo ============================================
echo.
explorer "%~dp0dist"
endlocal
