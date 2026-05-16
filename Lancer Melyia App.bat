@echo off
setlocal
:: CRITICAL: clear any ELECTRON_RUN_AS_NODE that would force Electron to behave as Node
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0\app"
title Melyia App

:: 1. Generate icons if missing (PowerShell .NET Drawing)
if not exist "icon.png" (
  echo Generating app icon...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Drawing; $sizes = @(16,32,64,128,256); foreach ($s in $sizes) { $bmp = New-Object System.Drawing.Bitmap $s,$s; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(10,132,255)); $rect = New-Object System.Drawing.RectangleF(0,0,$s,$s); $path = New-Object System.Drawing.Drawing2D.GraphicsPath; $r = $s/5; $path.AddArc(0,0,$r*2,$r*2,180,90); $path.AddArc($s-$r*2,0,$r*2,$r*2,270,90); $path.AddArc($s-$r*2,$s-$r*2,$r*2,$r*2,0,90); $path.AddArc(0,$s-$r*2,$r*2,$r*2,90,90); $path.CloseFigure(); $g.FillPath($brush, $path); $fontSize = [int]($s * 0.62); $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'; $g.DrawString('M', $font, [System.Drawing.Brushes]::White, $rect, $sf); if ($s -eq 256) { $bmp.Save('icon.png', [System.Drawing.Imaging.ImageFormat]::Png) } } $iconBmp = New-Object System.Drawing.Bitmap('icon.png'); $hIcon = $iconBmp.GetHicon(); $icon = [System.Drawing.Icon]::FromHandle($hIcon); $fs = [System.IO.File]::Open('icon.ico', 'Create'); $icon.Save($fs); $fs.Close();"
  if errorlevel 1 (
    echo Failed to generate icon. Continuing anyway.
  )
)

:: 2. Install Electron deps if not present
if not exist "node_modules" (
  echo.
  echo Installing Electron and dependencies (1-3 minutes the first time)...
  echo.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo Installation failed. Check that Node.js is installed: node --version
    pause
    exit /b 1
  )
)

:: 3. Launch the Electron app via PowerShell (to truly unset ELECTRON_RUN_AS_NODE which forces Electron into Node mode)
cd /d "%~dp0"
echo.
echo Launching Melyia...
echo Window will open. Close button hides to tray. Tray icon = quit.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process'); $env:ELECTRON_RUN_AS_NODE = $null; & 'node_modules\electron\dist\electron.exe' ."

endlocal
