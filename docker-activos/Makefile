.DEFAULT_GOAL := help
COMPOSE := docker compose

help:
	@echo "Módulo de Activos Fijos — stack de demostración"
	@echo ""
	@echo "  make check     verificar prerrequisitos"
	@echo "  make init      primera vez: verificar, build, frontend, levantar"
	@echo "  make up        levantar"
	@echo "  make down      detener (conserva la base)"
	@echo "  make destroy   detener y borrar la base de la demo"
	@echo "  make front     recompilar el frontend"
	@echo "  make logs      seguir los logs"
	@echo "  make sh        shell en el contenedor de PHP"
	@echo "  make psql      consola de PostgreSQL"
	@echo "  make fresh     rehacer la base desde cero (migrate:fresh + seed)"
	@echo "  make url       direcciones para compartir en la red local"

check:
	@sh scripts/preflight.sh

init: check build front up url

build:
	$(COMPOSE) build

front:
	@echo "==> Compilando el frontend"
	$(COMPOSE) --profile build run --rm node

up:
	$(COMPOSE) up -d
	@echo "==> Esperando al backend"
	@sleep 6
	@$(MAKE) --no-print-directory url

down:
	$(COMPOSE) down

destroy:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f app web

sh:
	$(COMPOSE) exec app bash

psql:
	$(COMPOSE) exec db psql -U $${DB_USERNAME:-activos} -d $${DB_DATABASE:-activos_demo}

fresh:
	$(COMPOSE) exec app php artisan migrate:fresh --force
	$(COMPOSE) exec app php artisan db:seed --class=PermisoSeeder --force
	$(COMPOSE) exec app php artisan db:seed --class=ActivosRolesSeeder --force
	$(COMPOSE) exec app php artisan db:seed --class=CajaCargasRolesSeeder --force
	$(COMPOSE) exec app php artisan db:seed --class=CargasCatalogoSeeder --force
	$(COMPOSE) exec app php artisan db:seed --class=ActivosSeeder --force

url:
	@sh scripts/url.sh
