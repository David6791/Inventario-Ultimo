@echo off
rem ===========================================================================
rem Copia la base de produccion (ingenio-db) a la replica (ingenio-pruebas-db)
rem y aplica las migraciones nuevas del codigo de la replica.
rem
rem   cd D:\IngenioPruebas\docker-activos
rem   scripts\copiar-ingenio-a-pruebas.cmd
rem
rem Produccion solo se LEE (pg_dump). La base de la replica se REEMPLAZA entera.
rem ===========================================================================
setlocal
cd /d "%~dp0.."

if not exist .env.ingenio-pruebas (
  echo Falta .env.ingenio-pruebas: copie .env.ingenio-pruebas.example y completelo.
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env.ingenio-pruebas") do set "%%a=%%b"

if "%ORIGEN_DB_DATABASE%"=="" ( echo Complete ORIGEN_DB_DATABASE en .env.ingenio-pruebas & exit /b 1 )
if "%ORIGEN_DB_USERNAME%"=="" ( echo Complete ORIGEN_DB_USERNAME en .env.ingenio-pruebas & exit /b 1 )

echo.
echo Se reemplazara TODA la base de la replica (%DB_DATABASE%) con una copia de produccion.
set /p OK=Escriba SI para continuar:
if /i not "%OK%"=="SI" ( echo Cancelado. & exit /b 1 )

echo ==^> Revisando las bases
call :esperar ingenio-db || exit /b 1
call :esperar ingenio-pruebas-db || exit /b 1

echo ==^> Respaldo de produccion (solo lectura)
docker exec ingenio-db pg_dump -U %ORIGEN_DB_USERNAME% -d %ORIGEN_DB_DATABASE% -Fc -f /tmp/copia-pruebas.dump || exit /b 1
docker cp ingenio-db:/tmp/copia-pruebas.dump "%TEMP%\copia-pruebas.dump" || exit /b 1
docker exec ingenio-db rm -f /tmp/copia-pruebas.dump

echo ==^> Deteniendo la aplicacion de la replica
docker stop ingenio-pruebas-app >nul 2>&1

echo ==^> Base de la replica desde cero
docker exec ingenio-pruebas-db psql -U %DB_USERNAME% -d postgres -c "DROP DATABASE IF EXISTS %DB_DATABASE% WITH (FORCE);" || exit /b 1
docker exec ingenio-pruebas-db psql -U %DB_USERNAME% -d postgres -c "CREATE DATABASE %DB_DATABASE%;" || exit /b 1

echo ==^> Restaurando la copia
docker cp "%TEMP%\copia-pruebas.dump" ingenio-pruebas-db:/tmp/copia-pruebas.dump || exit /b 1
docker exec ingenio-pruebas-db pg_restore -U %DB_USERNAME% -d %DB_DATABASE% --no-owner --no-privileges /tmp/copia-pruebas.dump
docker exec ingenio-pruebas-db rm -f /tmp/copia-pruebas.dump
del "%TEMP%\copia-pruebas.dump"

echo ==^> Arrancando la aplicacion (aplica las migraciones nuevas)
docker start ingenio-pruebas-app >nul
timeout /t 8 /nobreak >nul
docker exec ingenio-pruebas-app php artisan migrate --force
docker exec ingenio-pruebas-app php artisan optimize:clear

echo.
echo Listo: la replica tiene los datos de produccion y las migraciones del codigo de pruebas.
endlocal
exit /b 0

rem Arranca el contenedor si esta detenido y espera a que PostgreSQL responda.
:esperar
docker start %1 >nul 2>&1
for /l %%i in (1,1,30) do (
  docker exec %1 pg_isready -q >nul 2>&1 && exit /b 0
  timeout /t 2 /nobreak >nul
)
echo.
echo El contenedor %1 no arranca. Ultimas lineas de su registro:
docker logs --tail 25 %1
exit /b 1
