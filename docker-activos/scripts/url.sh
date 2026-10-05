#!/bin/sh
# Muestra las direcciones para compartir el stack en la red local.

PUERTO_WEB=${PUERTO_WEB:-8080}
PUERTO_ADMINER=${PUERTO_ADMINER:-8081}
PUERTO_DB=${PUERTO_DB:-5433}

[ -f .env ] && . ./.env 2>/dev/null

IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
[ -z "$IP" ] && IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$IP" ] && IP="<ip-del-equipo>"

echo ""
echo "  Sistema     http://$IP:$PUERTO_WEB"
echo "  API         http://$IP:$PUERTO_WEB/api/activos/clases"
echo "  Adminer     http://$IP:$PUERTO_ADMINER   (servidor: db)"
echo "  PostgreSQL  $IP:$PUERTO_DB"
echo ""
echo "  En la misma máquina: http://localhost:$PUERTO_WEB"
echo ""
echo "  Si desde otro equipo no abre, revisar el firewall del host."
echo "  Windows:  netsh advfirewall firewall add rule name=\"Activos demo\" dir=in action=allow protocol=TCP localport=$PUERTO_WEB"
echo "  Linux:    sudo ufw allow $PUERTO_WEB/tcp"
echo ""
