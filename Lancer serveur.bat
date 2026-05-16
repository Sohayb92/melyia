@echo off
cd /d "%~dp0"
title Melyia Server
cls
echo.
echo ============================================
echo    MELYIA - Serveur local
echo ============================================
echo.
echo  Acces PC ............ http://localhost:3000/melyia.html
for /f "delims=" %%a in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} ^| Select-Object -First 1).IPAddress"') do echo  Acces telephone ..... http://%%a:3000/melyia.html
echo.
echo  Le telephone doit etre sur le MEME WIFI que ce PC.
echo  Si Windows demande d'autoriser le firewall : clique "Autoriser".
echo.
echo  Ne ferme pas cette fenetre tant que tu utilises Melyia.
echo  Ctrl+C pour arreter le serveur.
echo.
echo ============================================
echo.
npx --yes serve -p 3000 -L
