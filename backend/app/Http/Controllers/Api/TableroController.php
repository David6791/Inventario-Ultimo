<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoDocumento;
use App\Enums\EstadoSolicitud;
use App\Enums\EstadoTransferencia;
use App\Http\Controllers\Controller;
use App\Models\CapaExistencia;
use App\Models\Ingreso;
use App\Models\MovimientoKardex;
use App\Models\Salida;
use App\Models\SolicitudCompra;
use App\Models\Transferencia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * El tablero.
 *
 * No es un panel de métricas: es la lista de pendientes del día. Lo primero que
 * alguien necesita al abrir el sistema no es cuántos productos hay, sino qué
 * quedó a medias ayer.
 *
 * Cada bloque se calcula SOLO si el usuario tiene el permiso correspondiente.
 * Mostrar un pendiente que no puede resolver es ruido, y además filtra
 * información que quizá no debería ver.
 */
class TableroController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('dashboard.ver'), 403);

        $usuario   = $request->user();
        $almacenId = (int) app('almacen_actual');

        return response()->json([
            'almacen_id' => $almacenId,
            'pendientes' => $this->pendientes($usuario, $almacenId),
            'alertas'    => $this->alertas($usuario, $almacenId),
            'cifras'     => $this->cifras($usuario, $almacenId),
            'reciente'   => $this->movimientoReciente($usuario, $almacenId),
            'generado_en'=> now()->toIso8601String(),
        ]);
    }

    /**
     * Lo que requiere acción. Cada entrada lleva su ruta para que el tablero
     * sea navegable: ver un pendiente y no poder ir directo a resolverlo es
     * una frustración pequeña que se repite todos los días.
     */
    private function pendientes($usuario, int $almacenId): array
    {
        $pendientes = [];

        // --- Compras aprobadas esperando que llegue el material ---
        if ($usuario->can('ingresos.registrar')) {
            $conSaldo = SolicitudCompra::query()
                ->where('almacen_id', $almacenId)
                ->pendientes()
                ->with('detalles')
                ->get()
                ->filter(fn ($s) => $s->detalles->contains(fn ($d) => $d->saldo() > 0))
                ->count();

            if ($conSaldo > 0) {
                $pendientes[] = [
                    'clave'       => 'compras-por-recibir',
                    'titulo'      => 'Compras por recibir',
                    'cantidad'    => $conSaldo,
                    'descripcion' => $conSaldo === 1
                        ? 'Una solicitud aprobada espera que llegue el material.'
                        : "{$conSaldo} solicitudes aprobadas esperan que llegue el material.",
                    'accion'      => 'Registrar ingreso',
                    'ruta'        => '/ingresos/nuevo',
                    'urgencia'    => 'normal',
                    'icono'       => 'pi pi-inbox',
                ];
            }
        }

        // --- Material en camino hacia mis almacenes ---
        if ($usuario->can('transferencias.confirmar')) {
            $enCamino = Transferencia::query()
                ->withoutGlobalScopes()
                ->enTransito()
                ->whereIn('almacen_destino_id', $usuario->almacenesIds())
                ->count();

            if ($enCamino > 0) {
                $pendientes[] = [
                    'clave'       => 'transferencias-por-recibir',
                    'titulo'      => 'Transferencias en camino',
                    'cantidad'    => $enCamino,
                    'descripcion' => $enCamino === 1
                        ? 'Otro almacén le despachó material y espera que confirme la recepción.'
                        : "Otros almacenes le despacharon {$enCamino} envíos que esperan su recepción.",
                    'accion'      => 'Ver transferencias',
                    'ruta'        => '/transferencias',
                    'urgencia'    => 'alta',
                    'icono'       => 'pi pi-truck',
                ];
            }
        }

        // --- Documentos firmados que faltan digitalizar ---
        // Es la revisión de cierre del día: el material ya se movió, falta el
        // papel. Sin este recordatorio los respaldos se pierden.
        if ($usuario->can('salidas.confirmar')) {
            $sinRespaldo = Salida::query()
                ->where('almacen_id', $almacenId)
                ->sinRespaldo()
                ->count();

            if ($sinRespaldo > 0) {
                $pendientes[] = [
                    'clave'       => 'salidas-sin-respaldo',
                    'titulo'      => 'Notas firmadas sin adjuntar',
                    'cantidad'    => $sinRespaldo,
                    'descripcion' => 'El material ya salió; falta subir el escaneo de la nota firmada.',
                    'accion'      => 'Ver salidas',
                    'ruta'        => '/salidas',
                    'urgencia'    => 'normal',
                    'icono'       => 'pi pi-paperclip',
                ];
            }
        }

        if ($usuario->can('ingresos.confirmar')) {
            $sinFactura = Ingreso::query()
                ->where('almacen_id', $almacenId)
                ->sinRespaldo()
                ->count();

            if ($sinFactura > 0) {
                $pendientes[] = [
                    'clave'       => 'ingresos-sin-respaldo',
                    'titulo'      => 'Facturas sin adjuntar',
                    'cantidad'    => $sinFactura,
                    'descripcion' => 'Ingresos confirmados a los que falta el documento del proveedor.',
                    'accion'      => 'Ver ingresos',
                    'ruta'        => '/ingresos',
                    'urgencia'    => 'normal',
                    'icono'       => 'pi pi-file-pdf',
                ];
            }
        }

        // --- Borradores olvidados ---
        // Un borrador no reserva stock ni prueba nada: si quedó ahí, o se
        // confirma o se elimina.
        $borradores = $this->contarBorradores($usuario, $almacenId);

        if ($borradores > 0) {
            $pendientes[] = [
                'clave'       => 'borradores',
                'titulo'      => 'Documentos en borrador',
                'cantidad'    => $borradores,
                'descripcion' => 'No movieron existencias todavía. Conviene confirmarlos o eliminarlos.',
                'accion'      => null,
                'ruta'        => null,
                'urgencia'    => 'baja',
                'icono'       => 'pi pi-file-edit',
            ];
        }

        return $pendientes;
    }

    private function contarBorradores($usuario, int $almacenId): int
    {
        $total = 0;
        $borrador = EstadoDocumento::Borrador->value;

        if ($usuario->can('salidas.ver')) {
            $total += Salida::where('almacen_id', $almacenId)->where('estado', $borrador)->count();
        }

        if ($usuario->can('ingresos.ver')) {
            $total += Ingreso::where('almacen_id', $almacenId)->where('estado', $borrador)->count();
        }

        if ($usuario->can('transferencias.ver')) {
            $total += Transferencia::withoutGlobalScopes()
                ->where('almacen_origen_id', $almacenId)
                ->where('estado', EstadoTransferencia::Borrador->value)
                ->count();
        }

        return $total;
    }

    /** Alertas de inventario: lo que puede dejar sin material a alguien. */
    private function alertas($usuario, int $almacenId): array
    {
        if (! $usuario->can('stock.ver')) {
            return [];
        }

        $alertas = [];

        $stock = DB::table('existencias as e')
            ->join('productos as p', 'p.id', '=', 'e.producto_id')
            ->where('e.almacen_id', $almacenId)
            ->where('p.activo', true)
            ->selectRaw('
                count(*) filter (where e.cantidad <= 0) as agotados,
                count(*) filter (where p.stock_minimo > 0 and e.cantidad > 0 and e.cantidad <= p.stock_minimo) as bajo_minimo
            ')
            ->first();

        if ($stock->agotados > 0) {
            $alertas[] = [
                'clave'       => 'agotados',
                'titulo'      => 'Productos agotados',
                'cantidad'    => (int) $stock->agotados,
                'descripcion' => 'Sin saldo en este almacén. Si alguien los pide hoy, no hay.',
                'ruta'        => '/existencias?estado=agotado',
                'urgencia'    => 'alta',
                'icono'       => 'pi pi-times-circle',
            ];
        }

        if ($stock->bajo_minimo > 0) {
            $alertas[] = [
                'clave'       => 'bajo-minimo',
                'titulo'      => 'Bajo el mínimo',
                'cantidad'    => (int) $stock->bajo_minimo,
                'descripcion' => 'Conviene iniciar la compra antes de que se agoten.',
                'ruta'        => '/existencias?estado=bajo',
                'urgencia'    => 'media',
                'icono'       => 'pi pi-exclamation-triangle',
            ];
        }

        // --- Vencimientos ---
        $vencidos = CapaExistencia::query()
            ->where('almacen_id', $almacenId)
            ->where('cantidad_restante', '>', 0)
            ->whereNotNull('fecha_vencimiento')
            ->whereDate('fecha_vencimiento', '<', now())
            ->count();

        if ($vencidos > 0) {
            $alertas[] = [
                'clave'       => 'vencidos',
                'titulo'      => 'Material vencido',
                'cantidad'    => $vencidos,
                'descripcion' => 'Sigue en el estante y ya no debería entregarse.',
                'ruta'        => '/reportes/vencimientos',
                'urgencia'    => 'alta',
                'icono'       => 'pi pi-ban',
            ];
        }

        $porVencer = CapaExistencia::query()
            ->where('almacen_id', $almacenId)
            ->where('cantidad_restante', '>', 0)
            ->whereNotNull('fecha_vencimiento')
            ->whereDate('fecha_vencimiento', '>=', now())
            ->whereDate('fecha_vencimiento', '<=', now()->addDays(30))
            ->count();

        if ($porVencer > 0) {
            $alertas[] = [
                'clave'       => 'por-vencer',
                'titulo'      => 'Vencen este mes',
                'cantidad'    => $porVencer,
                'descripcion' => 'Conviene entregarlos primero, antes que los lotes más nuevos.',
                'ruta'        => '/reportes/vencimientos',
                'urgencia'    => 'media',
                'icono'       => 'pi pi-clock',
            ];
        }

        return $alertas;
    }

    /** Las cifras del almacén. Contexto, no urgencia. */
    private function cifras($usuario, int $almacenId): array
    {
        if (! $usuario->can('stock.ver')) {
            return [];
        }

        $resumen = DB::table('existencias as e')
            ->join('productos as p', 'p.id', '=', 'e.producto_id')
            ->where('e.almacen_id', $almacenId)
            ->selectRaw('
                count(*) filter (where e.cantidad > 0) as con_saldo,
                coalesce(sum(e.cantidad * e.costo_promedio), 0) as valor
            ')
            ->first();

        $cifras = [
            [
                'clave'  => 'productos',
                'rotulo' => 'productos con saldo',
                'valor'  => (int) $resumen->con_saldo,
                'tipo'   => 'entero',
            ],
        ];

        // El valor del inventario no lo ve cualquiera.
        if ($usuario->can('stock.ver-costos')) {
            $cifras[] = [
                'clave'  => 'valor',
                'rotulo' => 'valor del inventario',
                'valor'  => round((float) $resumen->valor, 2),
                'tipo'   => 'moneda',
            ];
        }

        // Movimiento del mes, para dar sentido de actividad.
        $delMes = MovimientoKardex::query()
            ->withoutGlobalScopes()
            ->where('almacen_id', $almacenId)
            ->whereDate('fecha', '>=', now()->startOfMonth())
            ->selectRaw("
                count(*) filter (where tipo = 'ingreso') as ingresos,
                count(*) filter (where tipo = 'salida') as salidas
            ")
            ->first();

        $cifras[] = [
            'clave'  => 'movimientos-mes',
            'rotulo' => 'movimientos este mes',
            'valor'  => (int) ($delMes->ingresos + $delMes->salidas),
            'tipo'   => 'entero',
        ];

        return $cifras;
    }

    /** Los últimos documentos que movieron existencias. */
    private function movimientoReciente($usuario, int $almacenId): array
    {
        if (! $usuario->can('kardex.ver')) {
            return [];
        }

        return MovimientoKardex::query()
            ->withoutGlobalScopes()
            ->where('almacen_id', $almacenId)
            ->with(['producto:id,codigo,nombre', 'registradoPor:id,name'])
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn ($m) => [
                'id'        => $m->id,
                'fecha'     => $m->fecha?->toIso8601String(),
                'documento' => $m->documento_numero,
                'tipo'      => $m->tipo,
                'es_anulacion' => str_contains($m->documento_tipo, 'anulacion'),
                'producto'  => $m->producto?->nombre,
                'codigo'    => $m->producto?->codigo,
                'entrada'   => (float) $m->entrada,
                'salida'    => (float) $m->salida,
                'usuario'   => $m->registradoPor?->name,
            ])
            ->all();
    }
}
