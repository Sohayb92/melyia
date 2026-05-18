@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
title Melyia (mode test DEV)

echo.
echo ========================================
echo    MELYIA - MODE TEST (isole)
echo ========================================
echo.
echo Cette version utilise un dossier de donnees SEPARE
echo de ta version installee (Melyia v2.4.0).
echo.
echo --^> Tu peux laisser la version installee ouverte en parallele.
echo --^> Les patients/devis de TEST n'apparaitront PAS dans la prod.
echo --^> Tes parametres Gemini / Google sont a saisir UNE SEULE FOIS
echo     dans le mode test (ils sont sauvegardes pour les prochaines fois).
echo.

if not exist "node_modules\electron\dist\electron.exe" (
  echo [ERREUR] node_modules\electron manquant.
  echo Solution: ouvre PowerShell ici et tape "npm install"
  pause
  exit /b 1
)

if not exist "melyia.html" (
  echo [ERREUR] melyia.html introuvable.
  pause
  exit /b 1
)

echo Lancement de Melyia TEST...
echo Si l'app se ferme tout seul, regarde les messages ci-dessous.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process'); $env:ELECTRON_RUN_AS_NODE = $null; & 'node_modules\electron\dist\electron.exe' . --user-data-dir=\"$env:LOCALAPPDATA\Melyia-DevTest\" 2>&1 | Out-Host"

echo.
echo --- Melyia TEST est fermee ---
echo Appuie sur une touche pour fermer cette fenetre.
pause >nul
endlocal
