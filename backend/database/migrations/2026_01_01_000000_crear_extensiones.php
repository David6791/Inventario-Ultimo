<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Extensiones de PostgreSQL que el esquema necesita.
     *
     * Va primero que todo: la migración de productos define
     * `inmutable_unaccent()`, que envuelve a `unaccent()`. Sin la extensión
     * creada, esa migración falla y la instalación se corta a la mitad.
     *
     * En desarrollo esto pasaba desapercibido porque la extensión se había
     * creado a mano alguna vez. En una base nueva no existe, y por eso el
     * despliegue no arrancaba.
     */
    public function up(): void
    {
        /*
        | unaccent: búsquedas que ignoran tildes.
        |
        | Sin ella, buscar "articulo" no encuentra "artículo" — y en un catálogo
        | en español la mitad de las búsquedas fallarían.
        |
        | Viene en postgresql-contrib, incluido en la imagen oficial. Crearla
        | requiere permisos de superusuario, que el dueño de la base tiene.
        */
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');

        /*
        | pg_trgm: similitud entre cadenas.
        |
        | Habilita los índices GIN para búsqueda parcial rápida. Sin esto, un
        | `LIKE '%texto%'` recorre la tabla entera.
        */
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    }

    public function down(): void
    {
        /*
        | No se eliminan.
        |
        | Otros objetos del esquema dependen de ellas —funciones e índices— y
        | quitarlas rompería más de lo que limpia. Una extensión que sobra no
        | molesta a nadie.
        */
    }
};
