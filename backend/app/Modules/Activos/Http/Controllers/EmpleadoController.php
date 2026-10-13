<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Empleado;
use App\Modules\Activos\Services\ImportacionEmpleadosService;
use App\Modules\Activos\Services\PlantillaPersonalService;
    use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class EmpleadoController extends Controller
{
    public function __construct(private readonly ImportacionEmpleadosService $importacion, private readonly PlantillaPersonalService $plantillas,)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $empleados = Empleado::query()
            ->with(['centro:id,codigo,nombre,area_id', 'centro.area:id,codigo'])
            ->when(! $request->boolean('incluir_bajas'), fn ($q) => $q->activos())
            ->when($request->filled('centro_costo_id'),
                fn ($q) => $q->delCentro($request->integer('centro_costo_id')))
            ->when($request->boolean('solo_con_acceso'), fn ($q) => $q->conAcceso())
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $t = '%' . $request->string('buscar') . '%';
                $q->where(fn ($s) => $s
                    ->where('nombres', 'ilike', $t)
                    ->orWhere('apellido_paterno', 'ilike', $t)
                    ->orWhere('apellido_materno', 'ilike', $t)
                    ->orWhere('ci', 'ilike', $t)
                    ->orWhere('codigo', 'ilike', $t));
            })
            ->orderBy('apellido_paterno')->orderBy('nombres')
            ->get()
            ->map(fn ($e) => $this->serializar($e));

        return response()->json(['data' => $empleados]);
    }

    public function show(Empleado $empleado): JsonResponse
    {
        return response()->json([
            'data' => array_merge($this->serializar($empleado), [
                'bienes_a_cargo' => $empleado->cantidadBienesACargo(),
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validarDatos($request);

        $empleado = Empleado::create($datos);

        return response()->json(['data' => $this->serializar($empleado)], 201);
    }

    public function update(Request $request, Empleado $empleado): JsonResponse
    {
        $datos = $this->validarDatos($request, $empleado->id);

        $empleado->update($datos);

        return response()->json(['data' => $this->serializar($empleado->fresh())]);
    }

    /**
     * Baja del empleado.
     *
     * No se puede dar de baja a alguien con bienes a su cargo: primero hay que
     * emitir la devolución. Es la regla que sostiene el descargo laboral.
     */
    public function darDeBaja(Request $request, Empleado $empleado): JsonResponse
    {
        $request->validate(['fecha_baja' => ['required', 'date', 'before_or_equal:today']]);

        $pendientes = $empleado->cantidadBienesACargo();

        if ($pendientes > 0) {
            return response()->json([
                'mensaje' => "Tiene {$pendientes} bien(es) a su cargo. Emita la devolución "
                    .'antes de darlo de baja: sin descargo no se procesa el finiquito.',
            ], 422);
        }

        $empleado->update([
            'activo'     => false,
            'fecha_baja' => $request->date('fecha_baja'),
        ]);

        return response()->json([
            'data'    => $this->serializar($empleado->fresh()),
            'mensaje' => 'Empleado dado de baja. Puede emitirse la constancia de descargo.',
        ]);
    }

    // ───────────────────────────────────────────────────────── Importación

        public function validarImportacion(Request $request): JsonResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        $archivo = $request->file('archivo');

        try {
            $resultado = $this->importacion->validar(
                $archivo->getRealPath(),
                $archivo->getClientOriginalExtension()
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json($resultado);
    }

        public function importar(Request $request): JsonResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        $archivo = $request->file('archivo');

        try {
            $resultado = $this->importacion->importar(
                $archivo->getRealPath(),
                $request->user()->id,
                $archivo->getClientOriginalExtension()
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => $resultado,
            'mensaje' => sprintf(
                '%d empleado(s) nuevo(s), %d actualizado(s). Asigne el almacén a los '
                .'centros de costo creados para habilitar la visibilidad.',
                $resultado['creados'], $resultado['actualizados']
            ),
        ], 201);
    }

    private function validarDatos(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'codigo' => ['required', 'string', 'max:30',
                         Rule::unique(Empleado::class, 'codigo')->ignore($id)],
            'nombres'          => ['required', 'string', 'max:120'],
            'apellido_paterno' => ['nullable', 'string', 'max:80'],
            'apellido_materno' => ['nullable', 'string', 'max:80'],
            'ci'               => ['required', 'string', 'max:25',
                                   Rule::unique(Empleado::class, 'ci')->ignore($id)],
            'expedido'         => ['nullable', 'string', 'max:10'],
            'cargo'            => ['nullable', 'string', 'max:120'],
            'profesion'        => ['nullable', 'string', 'max:120'],
            'centro_costo_id'  => ['required', 'integer',
                                   Rule::exists(\App\Modules\Activos\Models\CentroCosto::class, 'id')],
            'fecha_ingreso'    => ['nullable', 'date'],
            'telefono'         => ['nullable', 'string', 'max:30'],
            'movil'            => ['nullable', 'string', 'max:30'],
            'email'            => ['nullable', 'email', 'max:150'],
            'direccion'        => ['nullable', 'string', 'max:250'],
            // Vincular con una cuenta es opcional: la mayoría del personal
            // recibe bienes sin acceder al sistema.
            'user_id'          => ['nullable', 'integer',
                                   Rule::unique(Empleado::class, 'user_id')->ignore($id)],
            'observaciones'    => ['nullable', 'string'],
        ]);
    }

    private function serializar(Empleado $e): array
    {
        return [
            'id'               => $e->id,
            'codigo'           => $e->codigo,
            'nombres'          => $e->nombres,
            'apellido_paterno' => $e->apellido_paterno,
            'apellido_materno' => $e->apellido_materno,
            'nombre_completo'  => $e->nombre_completo,
            'ci'               => $e->ci,
            'expedido'         => $e->expedido,
            'cargo'            => $e->cargo,
            'profesion'        => $e->profesion,
            'centro_costo_id'  => $e->centro_costo_id,
            'centro'           => $e->centro?->nombre,
            'centro_codigo'    => $e->centro?->codigo,
            'area'             => $e->centro?->area?->codigo,
            'fecha_ingreso'    => $e->fecha_ingreso?->toDateString(),
            'fecha_baja'       => $e->fecha_baja?->toDateString(),
            'telefono'         => $e->telefono,
            'movil'            => $e->movil,
            'email'            => $e->email,
            'user_id'          => $e->user_id,
            'tiene_acceso'     => $e->tieneAcceso(),
            'activo'           => $e->activo,
        ];
    }
    public function plantilla(): BinaryFileResponse
    {
        return response()
            ->download($this->plantillas->generar(), 'plantilla-personal.xlsx')
            ->deleteFileAfterSend();
    }
}
