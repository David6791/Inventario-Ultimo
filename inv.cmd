@echo off
REM ============================================================================
REM Atajos para Windows. Equivalente a ./inv en Linux y macOS.
REM
REM   inv artisan migrate
REM   inv composer require algo
REM   inv psql
REM   inv logs api
REM
REM Se invoca SIN "./"  ->  inv artisan migrate
REM ============================================================================

setlocal

if "%~1"=="" goto ayuda

set "ACCION=%~1"
shift

if /i "%ACCION%"=="artisan"  goto artisan
if /i "%ACCION%"=="composer" goto composer
if /i "%ACCION%"=="php"      goto php
if /i "%ACCION%"=="sh"       goto sh
if /i "%ACCION%"=="npm"      goto npm
if /i "%ACCION%"=="ng"       goto ng
if /i "%ACCION%"=="psql"     goto psql
if /i "%ACCION%"=="logs"     goto logs
if /i "%ACCION%"=="up"       goto up
if /i "%ACCION%"=="down"     goto down
if /i "%ACCION%"=="ps"       goto ps
if /i "%ACCION%"=="reset"    goto reset
goto ayuda

:artisan
docker compose exec api php artisan %1 %2 %3 %4 %5 %6 %7 %8 %9
goto fin

:composer
docker compose exec api composer %1 %2 %3 %4 %5 %6 %7 %8 %9
goto fin

:php
docker compose exec api php %1 %2 %3 %4 %5 %6 %7 %8 %9
goto fin

:sh
docker compose exec api bash
goto fin

:npm
docker compose exec web npm %1 %2 %3 %4 %5 %6 %7 %8 %9
goto fin

:ng
docker compose exec web npx ng %1 %2 %3 %4 %5 %6 %7 %8 %9
goto fin

:psql
docker compose exec db psql -U inventarios -d inventarios
goto fin

:logs
docker compose logs -f %1
goto fin

:up
docker compose up -d
goto fin

:down
docker compose down
goto fin

:ps
docker compose ps
goto fin

:reset
echo.
echo   Esto BORRA la base de datos y la vuelve a sembrar.
echo.
set /p RESPUESTA="  Continuar? (s/N): "
if /i "%RESPUESTA%"=="s" docker compose exec api php artisan migrate:fresh --seed
goto fin

:ayuda
echo.
echo   Uso: inv ^{artisan^|composer^|php^|sh^|npm^|ng^|psql^|logs^|up^|down^|ps^|reset^} [argumentos]
echo.
echo   Ejemplos:
echo     inv artisan migrate
echo     inv composer require spatie/laravel-permission
echo     inv logs api
echo     inv psql
echo.

:fin
endlocal
