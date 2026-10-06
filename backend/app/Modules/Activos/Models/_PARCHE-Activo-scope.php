<?php

/*
 * ════════════════════════════════════════════════════════════════════════
 * PARCHE PARA app/Modules/Activos/Models/Activo.php
 * ════════════════════════════════════════════════════════════════════════
 *
 * 1. Reemplazar el método scopeDelAmbitoDe() por esta versión.
 * 2. Agregar las dos relaciones del final.
 *
 * No es un archivo para copiar entero.
 */

    /**
     * Filtra los activos por los centros de costo que el usuario alcanza.
     *
     * LA CADENA
     *
     *   usuario → sus almacenes → centros de esos almacenes → activos
     *
     * Reutiliza la asignación usuario-almacén que ya existe en el sistema de
     * almacenes en vez de inventar un pivote nuevo. Cada centro de costo tiene
     * su almacén, así que la relación ya está dada por el modelo del negocio.
     *
     * Un bien sin centro asignado queda fuera de todo ámbito. Es deliberado:
     * conviene que se note y se corrija, no que aparezca para cualquiera.
     */
    public function scopeDelAmbitoDe($query, $usuario)
    {
        if ($usuario?->can('activos.ver-todos-centros')) {
            return $query;
        }

        $almacenes = $usuario?->almacenes->pluck('id')->all() ?? [];

        // Sin almacenes asignados no ve nada. Es más seguro que mostrar todo
        // por omisión: un usuario mal configurado ve una lista vacía, no el
        // inventario completo de la empresa.
        if (empty($almacenes)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereExists(function ($sub) use ($almacenes) {
            $sub->selectRaw('1')
                ->from('activos.centro_costo as cc')
                ->whereColumn('cc.id', 'activos.activo.centro_costo_id')
                ->whereIn('cc.almacen_id', $almacenes);
        });
    }

    /* ─────────────────────────── Relaciones a agregar ─────────────────── */

    public function centro(): BelongsTo
    {
        return $this->belongsTo(CentroCosto::class, 'centro_costo_id');
    }

    /** El custodio es un empleado, no un usuario del sistema. */
    public function custodio(): BelongsTo
    {
        return $this->belongsTo(Empleado::class, 'custodio_id');
    }
