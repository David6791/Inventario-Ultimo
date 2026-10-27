@echo off
rem ===========================================================================
rem Instala el agente del escaner en ESTA PC (la de recepcion, con el escaner
rem USB). Queda en %LOCALAPPDATA%\AgenteEscaner y arranca solo al iniciar
rem sesion. No necesita permisos de administrador.
rem ===========================================================================
setlocal
set "DESTINO=%LOCALAPPDATA%\AgenteEscaner"
if not exist "%DESTINO%" mkdir "%DESTINO%"
copy /y "%~dp0agente-escaner.ps1" "%DESTINO%\agente-escaner.ps1" >nul || ( echo No se pudo copiar el agente. & exit /b 1 )

rem Si ya estaba corriendo, se detiene para arrancar la version nueva.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*agente-escaner.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

schtasks /create /f /tn "Agente escaner (recepcion)" /sc onlogon /rl limited ^
  /tr "powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DESTINO%\agente-escaner.ps1\"" >nul
if errorlevel 1 ( echo No se pudo crear la tarea de inicio. & exit /b 1 )
schtasks /run /tn "Agente escaner (recepcion)" >nul

timeout /t 4 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri http://127.0.0.1:9123/estado -TimeoutSec 5; if ($r.escaneres.Count) { 'Agente funcionando. Escaneres: ' + (($r.escaneres | ForEach-Object { $_.nombre }) -join ', ') } else { 'Agente funcionando, pero no encuentra ningun escaner: conectelo y enciendalo.' } } catch { 'El agente no responde. Revise ' + $env:LOCALAPPDATA + '\AgenteEscaner\agente.log' }"
echo.
echo Listo. En el sistema, al tomar la foto del ticket aparece el boton "Escanear".
endlocal
