<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;

/**
 * Desde Laravel 11 la clase base viene vacía: ya no trae AuthorizesRequests ni
 * ValidatesRequests. Sin estos dos traits, cualquier llamada a authorize() o
 * authorizeResource() en un controlador falla con "Call to undefined method".
 *
 * Los controladores de este módulo dependen de ambos:
 *   - authorizeResource() en RolController y UsuarioController
 *   - authorize() en AlmacenController y en las acciones sueltas
 */
abstract class Controller
{
    use AuthorizesRequests, ValidatesRequests;
}
