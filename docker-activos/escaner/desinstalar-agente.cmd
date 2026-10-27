@echo off
rem Quita el agente del escaner de esta PC.
schtasks /delete /f /tn "Agente escaner (recepcion)" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*agente-escaner.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
rmdir /s /q "%LOCALAPPDATA%\AgenteEscaner" 2>nul
echo Agente del escaner quitado.
