@echo off
start "" "msedge.exe" "%~dp0melyia.html"
if errorlevel 1 start "" "chrome.exe" "%~dp0melyia.html"
if errorlevel 1 start "" "%~dp0melyia.html"
exit
