#!/bin/sh
# Verifica los prerrequisitos antes de levantar el stack.
# Uso:  sh scripts/preflight.sh   |   make check

OK="  [ok]"; ERR="  [FALTA]"; WARN="  [aviso]"
FALLAS=0

echo ""
echo "== Entorno =="

if command -v docker >/dev/null 2>&1; then
    echo "$OK docker $(docker --version | awk '{print $3}' | tr -d ,)"
else
    echo "$ERR docker no está instalado"; FALLAS=$((FALLAS+1))
fi

if docker compose version >/dev/null 2>&1; then
    echo "$OK docker compose v2"
else
    echo "$ERR falta 'docker compose' v2 (el plugin, no docker-compose v1)"; FALLAS=$((FALLAS+1))
fi

[ -f .env ] && echo "$OK .env presente" || { echo "$ERR falta .env — cp .env.example .env"; FALLAS=$((FALLAS+1)); }

echo ""
echo "== Estructura =="

[ -d ../backend ]  && echo "$OK ../backend"  || { echo "$ERR no existe ../backend"; FALLAS=$((FALLAS+1)); }
[ -d ../frontend ] && echo "$OK ../frontend" || { echo "$ERR no existe ../frontend"; FALLAS=$((FALLAS+1)); }
[ -f ../backend/artisan ] && echo "$OK ../backend es un proyecto Laravel" \
    || { echo "$ERR ../backend/artisan no existe"; FALLAS=$((FALLAS+1)); }

echo ""
echo "== Módulo de activos =="

[ -f ../backend/database/sql/activos_schema.sql ] \
    && echo "$OK DDL en database/sql/" \
    || { echo "$ERR falta database/sql/activos_schema.sql — la migración va a fallar"; FALLAS=$((FALLAS+1)); }

ls ../backend/database/migrations/*create_activos_schema.php >/dev/null 2>&1 \
    && echo "$OK migración del schema" \
    || { echo "$ERR falta la migración create_activos_schema"; FALLAS=$((FALLAS+1)); }

[ -d ../backend/app/Modules/Activos ] \
    && echo "$OK app/Modules/Activos" \
    || { echo "$ERR falta app/Modules/Activos"; FALLAS=$((FALLAS+1)); }

if grep -rq "ActivosServiceProvider" ../backend/bootstrap/providers.php ../backend/config/app.php 2>/dev/null; then
    echo "$OK ActivosServiceProvider registrado"
else
    echo "$ERR ActivosServiceProvider NO registrado — /api devolverá 404"; FALLAS=$((FALLAS+1))
fi

echo ""
echo "== Frontend =="

if grep -rq "apiUrl:[[:space:]]*'/api'" ../frontend/src/environments/environment.prod.ts 2>/dev/null; then
    echo "$OK environment.prod.ts usa apiUrl relativo"
else
    echo "$ERR environment.prod.ts debe tener  apiUrl: '/api'"
    echo "       Con un host fijo funciona solo en tu máquina."
    FALLAS=$((FALLAS+1))
fi

SALIDA=$(grep -o '"outputPath":[^,]*' ../frontend/angular.json 2>/dev/null | head -1)
if [ -n "$SALIDA" ]; then
    echo "$OK outputPath: $SALIDA"
    echo "$WARN el compose monta ../frontend/dist/activos/browser — ajustar si no coincide"
fi

echo ""
echo "== Puertos =="

for P in "${PUERTO_WEB:-8080} web" "${PUERTO_DB:-5433} postgres" "${PUERTO_ADMINER:-8081} adminer"; do
    PUERTO=$(echo "$P" | cut -d' ' -f1); NOMBRE=$(echo "$P" | cut -d' ' -f2)
    if (command -v ss >/dev/null && ss -ltn 2>/dev/null | grep -q ":$PUERTO ") || \
       (command -v netstat >/dev/null && netstat -an 2>/dev/null | grep -q "[:.]$PUERTO .*LISTEN"); then
        echo "$ERR puerto $PUERTO ($NOMBRE) YA ESTÁ EN USO — cambiarlo en .env"; FALLAS=$((FALLAS+1))
    else
        echo "$OK puerto $PUERTO libre ($NOMBRE)"
    fi
done

echo ""
if [ "$FALLAS" -eq 0 ]; then
    echo "  Todo listo. Ejecutar:  make init"
else
    echo "  $FALLAS punto(s) a resolver antes de levantar."
fi
echo ""
exit $FALLAS
