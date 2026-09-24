<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        | Unidades de la institución que solicitan material.
        |
        | Tabla propia y no un campo de texto en solicitantes: el reporte de
        | consumo por unidad es de lo primero que se pide, y con texto libre
        | "Area Tecnica" y "Área Técnica" se cuentan por separado.
        */
        Schema::create('unidades_solicitantes', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 20)->unique();
            $table->string('nombre', 150);
            $table->string('responsable', 150)->nullable();
            $table->string('centro_costo', 60)->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index('activo');
        });

        /*
        | Personas que solicitan o retiran material.
        |
        | Separadas de `users` a propósito: la mayoría nunca entra al sistema.
        | Atarlas a usuarios obligaría a crear logins que nadie usa, y a dar de
        | baja personas que solo dejaron de trabajar en esa unidad.
        */
        Schema::create('solicitantes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unidad_solicitante_id')->constrained('unidades_solicitantes');

            $table->string('nombre', 150);
            $table->string('ci', 20)->nullable();
            $table->string('cargo', 120)->nullable();
            $table->string('telefono', 30)->nullable();

            // Quien puede retirar material del almacén, además de solicitarlo.
            $table->boolean('autorizado_retirar')->default(true);

            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['unidad_solicitante_id', 'activo']);
            $table->unique(['unidad_solicitante_id', 'nombre']);
        });

        /*
        | La salida guarda el identificador Y el texto.
        |
        | No es redundancia: el texto es la foto del momento en que se firmó el
        | documento. Si mañana renombran la unidad o la persona cambia de área,
        | la nota tiene que seguir diciendo lo que decía. El identificador sirve
        | para agrupar en reportes; el texto, para que el papel sea fiel.
        */
        Schema::table('salidas', function (Blueprint $table) {
            $table->foreignId('unidad_solicitante_id')->nullable()
                ->after('almacen_id')->constrained('unidades_solicitantes');
            $table->foreignId('solicitante_id')->nullable()
                ->after('unidad_solicitante_id')->constrained('solicitantes');
            $table->foreignId('recibido_por_id')->nullable()
                ->after('solicitante_id')->constrained('solicitantes');
        });
    }

    public function down(): void
    {
        Schema::table('salidas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recibido_por_id');
            $table->dropConstrainedForeignId('solicitante_id');
            $table->dropConstrainedForeignId('unidad_solicitante_id');
        });

        Schema::dropIfExists('solicitantes');
        Schema::dropIfExists('unidades_solicitantes');
    }
};
