<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 30)->unique();
            $table->string('nombre', 200);
            $table->string('descripcion', 500)->nullable();

            $table->foreignId('categoria_id')->constrained('categorias');
            $table->foreignId('unidad_medida_id')->constrained('unidades_medida');

            // Partida presupuestaria del clasificador de gastos. La necesitan los
            // reportes que se rinden ante la instancia superior.
            $table->string('partida_presupuestaria', 20)->nullable();
            $table->string('codigo_barras', 60)->nullable();

            // Los minimos y maximos son por producto, no por almacen: es lo que
            // usan las instituciones chicas. Si mas adelante hace falta por
            // almacen, se agrega una tabla producto_almacen sin tocar esto.
            $table->decimal('stock_minimo', 14, 4)->default(0);
            $table->decimal('stock_maximo', 14, 4)->nullable();

            // Definen que campos pide el sistema al registrar un ingreso.
            $table->boolean('controla_lote')->default(false);
            $table->boolean('controla_vencimiento')->default(false);

            $table->boolean('activo')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('activo');
            $table->index('categoria_id');
        });

        /*
        | Busqueda por nombre sin acentos ni mayusculas.
        |
        | unaccent() esta declarada STABLE, y PostgreSQL no admite funciones
        | STABLE dentro de la expresion de un indice. Por eso se envuelve en una
        | funcion propia marcada IMMUTABLE. Pasar el diccionario de forma
        | explicita ('unaccent') es lo que la vuelve realmente inmutable: sin
        | ese argumento el resultado dependeria de search_path.
        */
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION inmutable_unaccent(text)
            RETURNS text
            LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
            AS $$ SELECT unaccent('unaccent', $1) $$
        SQL);

        DB::statement(<<<'SQL'
            CREATE INDEX productos_nombre_busqueda
            ON productos
            USING gin (lower(inmutable_unaccent(nombre)) gin_trgm_ops)
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');

        // La funcion queda: otras tablas podrian usarla. Si es la ultima,
        // borrarla a mano con DROP FUNCTION inmutable_unaccent(text);
    }
};
