import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { mensajeDeError } from '../../cargas/core/errores';
import { BonoLabPendiente, BonoPendiente } from '../../cargas/core/models/cargas.model';
import { RecepcionService } from '../../cargas/core/services/recepcion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import {
  AjusteMovimiento, CajaOperacion, DatosMovimiento, FormaPago, Moneda, Movimiento, OpcionesCaja, PersonaCorta, SaldoSesion, SolicitudConUsuarios,
  TipoMovimiento, UsuarioCorto,
} from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { abrirPdf } from '../core/archivos';
import { DineroPipe, formatoDinero, simbolo } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';
import { aNumero, numeroInvalido } from '../../cargas/core/numeros';

/**
 * Operación de una caja: apertura, saldo del momento por moneda, registro de
 * ingresos y egresos, anulación e impresión del comprobante.
 *
 * Las reglas (saldo que no queda negativo, saldo inicial que sale del cierre
 * anterior, numeración) las aplica la base; la pantalla las anticipa para
 * avisar antes, pero el mensaje que manda es el de la base.
 */
@Component({
  selector: 'app-caja-operacion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AutoCompleteModule, ButtonModule, CheckboxModule, DialogModule, DropdownModule,
    InputNumberModule, InputTextModule, InputTextareaModule, SelectButtonModule, TableModule, ToastModule,
    TooltipModule, DineroPipe, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <a routerLink="/caja/operar" class="volver"><i class="pi pi-arrow-left"></i> Cajas</a>

    <ng-container *ngIf="caja() as c">
      <header class="encabezado">
        <div>
          <h2>{{ c.nombre }} <span class="codigo titulo-codigo">{{ c.codigo }}</span></h2>
          <p class="subtitulo" *ngIf="c.sesion_abierta as s">
            Sesión {{ s.numero }} abierta por {{ s.abierta_por }} el {{ s.abierta_en | date: 'dd/MM/yyyy HH:mm' }} · {{ c.almacen?.nombre }}
          </p>
          <p class="subtitulo" *ngIf="!c.sesion_abierta">Caja cerrada · {{ c.almacen?.nombre }}</p>
        </div>
        <div class="acciones" *ngIf="c.sesion_abierta as s">
          <p-button label="Reporte del día" icon="pi pi-file-pdf" [text]="true" (onClick)="reporte(s.id)" />
          <ng-container *ngIf="c.soy_cajero">
            <p-button *appTienePermiso="'caja.cerrar'" label="Cerrar caja" icon="pi pi-lock" severity="secondary"
                      [outlined]="true" [routerLink]="['/caja/operar', c.id, 'cierre']" />
          </ng-container>
          <ng-container *ngIf="c.soy_cajero && !deOtroDia()">
          <ng-container *appTienePermiso="'caja.pagar-bono'">
            <p-button label="Bonos por pagar" icon="pi pi-truck" severity="secondary" [outlined]="true" (onClick)="abrirBonos()"
                      [badge]="(bonos().length + bonosLab().length) ? '' + (bonos().length + bonosLab().length) : ''" badgeClass="p-badge-warning" />
          </ng-container>
          <ng-container *ngIf="c.requiere_aprobacion">
            <ng-container *appTienePermiso="'caja.registrar'">
              <p-button label="Solicitudes por pagar" icon="pi pi-inbox" severity="secondary" [outlined]="true"
                        (onClick)="abrirSolicitudes()"
                        [badge]="c.solicitudes_por_pagar ? '' + c.solicitudes_por_pagar : ''" badgeClass="p-badge-warning" />
            </ng-container>
          </ng-container>
          <ng-container *appTienePermiso="'caja.registrar'">
            <p-button label="Ingreso" icon="pi pi-arrow-down-left" severity="success" [outlined]="true"
                      (onClick)="nuevoMovimiento('INGRESO')" />
            <p-button label="Egreso" icon="pi pi-arrow-up-right" severity="danger" [outlined]="true"
                      (onClick)="nuevoMovimiento('EGRESO')" />
          </ng-container>
          </ng-container>
        </div>
      </header>

      <div class="nota nota-aviso nota-encabezado" *ngIf="deOtroDia()">
        <i class="pi pi-exclamation-triangle"></i>
        <span>Esta sesión se abrió el {{ c.sesion_abierta?.abierta_en | date: 'dd/MM/yyyy' }} y la caja se cierra a diario:
              ciérrela con su arqueo y abra la de hoy para seguir registrando.</span>
      </div>

      <div class="nota nota-aviso nota-encabezado" *ngIf="provisionalesPendientes().length">
        <i class="pi pi-hourglass"></i>
        <span>{{ provisionalesPendientes().length === 1 ? 'Hay un comprobante provisional' : 'Hay ' + provisionalesPendientes().length + ' comprobantes provisionales' }}
              sin validar ({{ numerosPendientes() }}): ajústelos con el monto real y valídelos antes de cerrar la caja.</span>
      </div>

      <div class="nota nota-neutra nota-encabezado" *ngIf="c.requiere_aprobacion && c.soy_cajero">
        <i class="pi pi-shield"></i>
        <span>Esta caja trabaja con aprobación: los egresos se pagan desde <strong>Solicitudes por pagar</strong>, una vez
              aprobados. Directo solo se registran ingresos y los egresos exentos (por ejemplo, el depósito en banco).
              <a [routerLink]="['/caja/solicitudes']" [queryParams]="{ caja: c.id }">Registrar una solicitud a nombre de alguien</a>.</span>
      </div>

      <div class="nota nota-neutra nota-encabezado" *ngIf="!c.soy_cajero">
        <i class="pi pi-eye"></i>
        <span>Solo consulta: no está asignado como cajero de esta caja.
              Cajeros: {{ nombresCajeros() || 'ninguno todavía' }}.</span>
      </div>

      <!-- ===================== Caja cerrada: apertura ===================== -->
      <section class="apertura" *ngIf="!c.sesion_abierta && c.soy_cajero">
        <div class="icono"><i class="pi pi-lock"></i></div>
        <div class="contenido">
          <h3>Abrir la caja</h3>
          <p *ngIf="c.ultima_cerrada as u" class="secundario">
            Último cierre: sesión {{ u.numero }}, {{ u.cerrada_en | date: 'dd/MM/yyyy HH:mm' }} por {{ u.cerrada_por }}
            ({{ u.estado === 'VALIDADA' ? 'validado' : 'pendiente de validación' }}) ·
            <a href="" (click)="$event.preventDefault(); reporte(u.id)">ver reporte</a>.
          </p>

          <div class="monedas">
            <div class="moneda" *ngFor="let m of monedas()">
              <ng-container *ngIf="c.saldos_arranque[m] !== null && c.saldos_arranque[m] !== undefined; else digitar">
                <span class="rotulo">Arranca con</span>
                <span class="monto grande">{{ c.saldos_arranque[m] | dinero: m }}</span>
                <small class="secundario">Lo contado en el último cierre.</small>
              </ng-container>
              <ng-template #digitar>
                <label class="rotulo" [for]="'inicial-' + m">Efectivo inicial {{ m === 'USD' ? 'en dólares' : 'en bolivianos' }}</label>
                <p-inputNumber [inputId]="'inicial-' + m" [(ngModel)]="saldoInicial[m]" mode="decimal" locale="es-BO"
                               [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0" [prefix]="simbolo(m) + ' '" />
                <small class="secundario">Primera apertura{{ m === 'USD' ? ' en dólares' : '' }}: cuente lo que hay en caja.</small>
              </ng-template>
            </div>
          </div>

          <p-button *appTienePermiso="'caja.abrir'" label="Abrir caja" icon="pi pi-lock-open"
                    [loading]="abriendo()" [disabled]="!aperturaLista()" (onClick)="abrir()" />
          <p class="secundario" *ngIf="!puede('caja.abrir')">Su usuario no tiene permiso para abrir la caja.</p>
        </div>
      </section>

      <!-- ====================== Caja abierta ====================== -->
      <ng-container *ngIf="c.sesion_abierta as s">
        <section class="saldos">
          <article class="saldo" *ngFor="let saldo of s.saldos">
            <span class="rotulo">Efectivo en caja · {{ saldo.moneda === 'USD' ? 'dólares' : 'bolivianos' }}</span>
            <span class="monto principal">{{ saldo.saldo_efectivo_actual | dinero: saldo.moneda }}</span>
            <dl class="desglose">
              <div><dt>Inicial</dt><dd class="monto">{{ saldo.saldo_inicial | dinero }}</dd></div>
              <div><dt>Ingresos</dt><dd class="monto ingreso">+ {{ saldo.ingresos_efectivo | dinero }}</dd></div>
              <div><dt>Egresos</dt><dd class="monto egreso">− {{ saldo.egresos_efectivo | dinero }}</dd></div>
            </dl>
            <div class="otras" *ngIf="+saldo.ingresos_no_efectivo || +saldo.egresos_no_efectivo">
              Cheques y transferencias (no cuentan en el efectivo):
              <span class="monto ingreso">+ {{ saldo.ingresos_no_efectivo | dinero }}</span> ·
              <span class="monto egreso">− {{ saldo.egresos_no_efectivo | dinero }}</span>
            </div>
          </article>
        </section>

        <div class="nota nota-neutra nota-encabezado ultimo" *ngIf="ultimo() as u">
          <i class="pi pi-check-circle"></i>
          <span>Comprobante <strong class="codigo">{{ u.numero }}</strong> registrado:
                {{ u.concepto?.nombre }}, {{ u.monto | dinero: u.moneda }}.</span>
          <p-button label="Imprimir" icon="pi pi-print" size="small" [text]="true" (onClick)="imprimir(u)" />
        </div>

        <p-table [value]="s.movimientos ?? []" dataKey="id" styleClass="p-datatable-sm tabla"
                 [rowTrackBy]="porId">
          <ng-template pTemplate="caption">
            <div class="titulo-tabla">Movimientos de la sesión <span class="contador">({{ s.movimientos?.length ?? 0 }})</span></div>
          </ng-template>
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 11rem">Comprobante</th>
              <th>Concepto y glosa</th>
              <th style="width: 14rem">Persona</th>
              <th style="width: 9rem">Forma de pago</th>
              <th style="width: 10rem" class="derecha">Monto</th>
              <th style="width: 6rem"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-m>
            <tr [class.anulado]="m.estado === 'ANULADO'">
              <td>
                <div class="codigo">{{ m.numero }}</div>
                <div class="secundario">{{ m.fecha | date: 'HH:mm' }} · {{ nombreDe(m.registrado_por) }}</div>
                <ng-container *ngIf="m.estado === 'VIGENTE' && m.provisional">
                  <span class="pastilla pastilla-provisional" *ngIf="!m.validado_en && !ajusteEnCurso(m)">Provisional</span>
                  <span class="pastilla pastilla-aviso" *ngIf="ajusteEnCurso(m)?.estado === 'PENDIENTE'"
                        [pTooltip]="'Pide ' + (ajusteEnCurso(m)!.monto_nuevo | dinero: m.moneda) + ': ' + ajusteEnCurso(m)!.motivo">Ajuste por aprobar</span>
                  <span class="pastilla pastilla-acento" *ngIf="ajusteEnCurso(m)?.estado === 'APROBADO'">Ajuste aprobado</span>
                  <span class="pastilla pastilla-ok" *ngIf="m.validado_en" [pTooltip]="'Validado por ' + nombreDe(m.validado_por ?? null)">Validado</span>
                </ng-container>
              </td>
              <td>
                <div>
                  {{ m.concepto?.nombre }}
                  <span class="pastilla pastilla-aviso" *ngIf="m.estado === 'ANULADO'"
                        [pTooltip]="'Anulado por ' + nombreDe(m.anulado_por) + ': ' + m.motivo_anulacion">Anulado</span>
                </div>
                <div class="secundario">{{ m.glosa }}</div>
              </td>
              <td>
                <a *ngIf="m.persona_id; else sinFicha" class="persona" [routerLink]="['/caja/personas']"
                   [queryParams]="{ ver: m.persona_id }">{{ m.persona_nombre }}</a>
                <ng-template #sinFicha><div>{{ m.persona_nombre }}</div></ng-template>
                <div class="secundario" *ngIf="m.persona_ci">CI {{ m.persona_ci }}</div>
              </td>
              <td>
                <div>{{ etiquetaForma(m.forma_pago) }}</div>
                <div class="secundario" *ngIf="m.banco">{{ m.banco.nombre }} · {{ m.nro_documento }}</div>
              </td>
              <td class="derecha">
                <span class="monto" [class.ingreso]="m.tipo === 'INGRESO'" [class.egreso]="m.tipo === 'EGRESO'">
                  {{ m.tipo === 'INGRESO' ? '+' : '−' }} {{ m.monto | dinero: m.moneda }}
                </span>
                <div class="secundario" *ngIf="entregadoOriginal(m) as o">entregado {{ o | dinero }}</div>
              </td>
              <td class="centro">
                <p-button icon="pi pi-print" [text]="true" [rounded]="true" size="small" pTooltip="Imprimir comprobante"
                          (onClick)="imprimir(m)" />
                <ng-container *ngIf="m.estado === 'VIGENTE' && m.provisional && !m.validado_en && c.soy_cajero">
                  <ng-container *appTienePermiso="'caja.registrar'">
                    <p-button *ngIf="ajusteEnCurso(m)?.estado === 'APROBADO'" icon="pi pi-arrow-up-right" [text]="true" [rounded]="true"
                              size="small" severity="warning" pTooltip="Entregar la diferencia aprobada" (onClick)="aplicarAjuste(m)" />
                    <p-button *ngIf="!ajusteEnCurso(m)" icon="pi pi-sliders-h" [text]="true" [rounded]="true" size="small"
                              pTooltip="Ajustar al monto real" (onClick)="pedirAjuste(m)" />
                    <p-button *ngIf="!ajusteEnCurso(m)" icon="pi pi-check-circle" [text]="true" [rounded]="true" size="small"
                              severity="success" pTooltip="Validar con el monto final" (onClick)="validar(m)" />
                  </ng-container>
                </ng-container>
                <ng-container *ngIf="m.estado === 'VIGENTE' && m.concepto?.origen === 'MANUAL' && c.soy_cajero">
                  <p-button *appTienePermiso="'caja.anular'" icon="pi pi-ban" [text]="true" [rounded]="true" size="small"
                            severity="danger" pTooltip="Anular" (onClick)="pedirAnulacion(m)" />
                </ng-container>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6">
              <div class="vacio">
                <i class="pi pi-inbox"></i>
                <div class="titulo-vacio">Sin movimientos todavía</div>
                <span>Registre un ingreso o un egreso con los botones de arriba.</span>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </ng-container>
    </ng-container>

    <!-- ====================== Registrar movimiento ====================== -->
    <p-dialog [(visible)]="movimientoVisible" [header]="tipoNuevo() === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'"
              [modal]="true" [style]="{ width: '40rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="concepto">Concepto</label>
          <p-dropdown inputId="concepto" formControlName="concepto_id" [options]="conceptosDelTipo()" optionLabel="nombre"
                      optionValue="id" placeholder="Seleccione" [filter]="true" filterBy="nombre" appendTo="body"
                      emptyMessage="No hay conceptos" />
          <small *ngIf="caja()?.requiere_aprobacion && tipoNuevo() === 'EGRESO'">
            Solo los egresos exentos de aprobación. Los demás se pagan desde Solicitudes por pagar.
          </small>
          <small *ngIf="opciones() && !conceptosDelTipo().length" class="alerta">
            No hay conceptos de {{ tipoNuevo() === 'INGRESO' ? 'ingreso' : 'egreso' }} activos.
            Créelos en Caja → Conceptos.
          </small>
        </div>

        <div class="campo span-3">
          <label for="monto">Monto</label>
          <p-inputNumber inputId="monto" formControlName="monto" mode="decimal" locale="es-BO" [minFractionDigits]="2"
                         [maxFractionDigits]="2" [min]="0" [prefix]="simbolo(form.value.moneda ?? 'BOB') + ' '" />
          <small *ngIf="disponible() as d" [class.alerta]="excede()">
            {{ excede() ? 'Supera el efectivo en caja:' : 'Efectivo disponible:' }} {{ d }}
          </small>
        </div>
        <div class="campo span-3" *ngIf="monedas().length > 1">
          <label>Moneda</label>
          <p-selectButton formControlName="moneda" [options]="opcionesMoneda" optionLabel="etiqueta" optionValue="valor" />
        </div>

        <div class="campo span-6">
          <label>Forma de pago</label>
          <p-selectButton formControlName="forma_pago" [options]="opciones()?.formas_pago ?? []" optionLabel="etiqueta"
                          optionValue="valor" />
          <small *ngIf="form.value.forma_pago !== 'EFECTIVO'">Se registra para el libro de caja, pero no mueve el efectivo.</small>
        </div>

        <div class="campo span-6" *ngIf="tipoNuevo() === 'EGRESO' && form.value.forma_pago === 'EFECTIVO'">
          <div class="check-campo">
            <p-checkbox formControlName="provisional" [binary]="true" inputId="provisional" />
            <label for="provisional">Monto a rendir en el día (provisional)</label>
          </div>
          <small>Para compras cuyo precio final no se sabe todavía: hoy mismo se ajusta al monto de la factura (se entrega la
                 diferencia o se recibe la devolución) y se valida antes de cerrar la caja.</small>
        </div>

        <ng-container *ngIf="form.value.forma_pago !== 'EFECTIVO'">
          <div class="campo span-3">
            <label for="banco">Banco</label>
            <p-dropdown inputId="banco" formControlName="banco_id" [options]="opciones()?.bancos ?? []" optionLabel="nombre"
                        optionValue="id" placeholder="Seleccione" appendTo="body" />
          </div>
          <div class="campo span-3">
            <label for="documento">N.º de {{ form.value.forma_pago === 'CHEQUE' ? 'cheque' : 'transferencia' }}</label>
            <input id="documento" pInputText formControlName="nro_documento" maxlength="40" />
          </div>
        </ng-container>

        <div class="campo span-4">
          <label for="persona">{{ tipoNuevo() === 'INGRESO' ? 'Recibido de' : 'Pagado a' }}</label>
          <p-autoComplete inputId="persona" [(ngModel)]="personaTexto" [ngModelOptions]="{ standalone: true }"
                          [suggestions]="sugerencias()" (completeMethod)="buscarPersona($event.query)"
                          (ngModelChange)="escribirPersona($event)" field="nombre" [minLength]="2" [delay]="250"
                          [forceSelection]="false" appendTo="body" placeholder="Nombre o CI" (onBlur)="revisarPersona()" [inputStyle]="{ width: '100%' }"
                          styleClass="w-full">
            <ng-template let-p pTemplate="item">
              <div class="sugerencia"><span>{{ p.nombre }}</span><span class="secundario">{{ p.ci ? 'CI ' + p.ci : 'sin CI' }}</span></div>
            </ng-template>
          </p-autoComplete>
          <small *ngIf="form.value.persona_id">Del registro de personas.</small>
          <small *ngIf="!form.value.persona_id && form.value.persona_nombre">Persona nueva: se agrega al registro al guardar.</small>
        </div>
        <div class="campo span-2">
          <label for="ci">CI o NIT <span class="opcional">(opcional)</span></label>
          <input id="ci" pInputText formControlName="persona_ci" maxlength="15" (blur)="revisarPersona()" />
        </div>

        <div class="campo span-6" *ngIf="!form.value.persona_id && (parecidas().length || ciAjeno())">
          <div class="nota nota-aviso">
            <i class="pi pi-exclamation-triangle"></i>
            <div class="aviso-persona">
              <ng-container *ngIf="ciAjeno() as p">
                <span>El CI {{ p.ci }} ya está registrado a nombre de <strong>{{ p.nombre }}</strong>:
                      el movimiento quedará a su nombre.</span>
                <p-button label="Usar a {{ p.nombre }}" size="small" [text]="true" (onClick)="usarPersona(p)" />
              </ng-container>
              <ng-container *ngFor="let p of parecidas()">
                <span>Ya está registrado <strong>{{ p.nombre }}</strong> {{ p.ci ? 'con CI ' + p.ci : 'sin CI' }}.
                      Si es la misma persona, elíjala para no duplicarla.</span>
                <p-button label="Es la misma persona" size="small" [text]="true" (onClick)="usarPersona(p)" />
              </ng-container>
            </div>
          </div>
        </div>

        <div class="campo span-6">
          <label for="glosa">Glosa</label>
          <textarea id="glosa" pInputTextarea formControlName="glosa" rows="2" maxlength="250"
                    placeholder="Qué se pagó o por qué ingresa el dinero"></textarea>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="movimientoVisible = false" />
        <p-button [label]="tipoNuevo() === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'" icon="pi pi-check"
                  [severity]="tipoNuevo() === 'INGRESO' ? 'success' : 'danger'"
                  [loading]="guardando()" [disabled]="form.invalid || excede() || guardando()" (onClick)="registrar()" />
      </ng-template>
    </p-dialog>

    <!-- ====================== Anular ====================== -->
    <p-dialog [(visible)]="anularVisible" header="Anular comprobante" [modal]="true" [style]="{ width: '32rem' }"
              [draggable]="false">
      <ng-container *ngIf="aAnular() as m">
        <p class="explicacion">
          Se anula el comprobante <strong class="codigo">{{ m.numero }}</strong> ({{ m.concepto?.nombre }},
          {{ m.monto | dinero: m.moneda }}). No se borra: queda en la lista marcado como anulado
          {{ m.forma_pago === 'EFECTIVO' ? 'y el monto vuelve al saldo' : '' }}.
        </p>
        <div class="campos">
          <div class="campo span-6">
            <label for="motivo">Motivo</label>
            <textarea id="motivo" pInputTextarea [(ngModel)]="motivo" rows="3" maxlength="250"></textarea>
            <small>Al menos 10 caracteres. Sale impreso en el comprobante anulado.</small>
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular" icon="pi pi-ban" severity="danger" [loading]="anulando()"
                  [disabled]="motivo.trim().length < 10 || anulando()" (onClick)="anular()" />
      </ng-template>
    </p-dialog>

    <!-- ====================== Ajustar comprobante provisional ====================== -->
    <p-dialog [(visible)]="ajusteVisible" header="Ajustar al monto real" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <ng-container *ngIf="aAjustar() as m">
        <p class="explicacion">
          Comprobante <strong class="codigo">{{ m.numero }}</strong> · {{ m.concepto?.nombre }} · {{ m.persona_nombre }}.
          Hoy se entregó <strong>{{ m.monto | dinero: m.moneda }}</strong>.
        </p>
        <div class="campos">
          <div class="campo span-3">
            <label for="monto-final">Monto real</label>
            <input id="monto-final" pInputText inputmode="decimal" [(ngModel)]="ajuste.monto" placeholder="0,00"
                   [class.ng-invalid]="montoAjusteInvalido()" [class.ng-dirty]="montoAjusteInvalido()" />
          </div>
          <div class="campo span-3">
            <label for="documento-ajuste">Factura o recibo <span class="opcional">(opcional)</span></label>
            <input id="documento-ajuste" pInputText [(ngModel)]="ajuste.documento" maxlength="60" placeholder="N.º" />
          </div>
          <div class="campo span-6" *ngIf="diferenciaAjuste() as d">
            <div class="nota" [class.nota-aviso]="d > 0" [class.nota-neutra]="d < 0">
              <i class="pi" [ngClass]="d > 0 ? 'pi-arrow-up-right' : 'pi-arrow-down-left'"></i>
              <span *ngIf="d > 0 && !pideAprobacion()">Entregue <strong>{{ d | dinero: m.moneda }}</strong> más a {{ m.persona_nombre }}.</span>
              <span *ngIf="d > 0 && pideAprobacion()">El aumento de <strong>{{ d | dinero: m.moneda }}</strong> va a la bandeja del
                    aprobador. Entréguelo recién cuando lo aprueben.</span>
              <span *ngIf="d < 0">Reciba <strong>{{ -d | dinero: m.moneda }}</strong> de devolución.</span>
            </div>
          </div>
          <div class="campo span-6">
            <label for="motivo-ajuste">Motivo</label>
            <textarea id="motivo-ajuste" pInputTextarea [(ngModel)]="ajuste.motivo" rows="2" maxlength="250"
                      placeholder="Por ejemplo: el repuesto costó más que lo cotizado"></textarea>
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="ajusteVisible = false" />
        <p-button [label]="(diferenciaAjuste() ?? 0) > 0 && pideAprobacion() ? 'Enviar a aprobación' : 'Ajustar'" icon="pi pi-check"
                  [loading]="ajustando()" [disabled]="ajustando() || !ajusteValido()" (onClick)="ajustar()" />
      </ng-template>
    </p-dialog>

    <!-- ====================== Solicitudes aprobadas por pagar ====================== -->
    <p-dialog [(visible)]="solicitudesVisible" header="Solicitudes aprobadas por pagar" [modal]="true" [style]="{ width: '58rem' }"
              [draggable]="false">
      <p class="explicacion">Entregue el dinero a la persona y pídale que firme el comprobante. El monto, el concepto y la
        persona son los aprobados; no se cambian.</p>
      <p-table [value]="porPagar()" dataKey="id" styleClass="p-datatable-sm tabla" [loading]="cargandoSolicitudes()">
        <ng-template pTemplate="header">
          <tr><th style="width: 9rem">Solicitud</th><th style="width: 13rem">Para</th><th>Concepto</th>
              <th style="width: 10rem">Aprobó</th><th class="derecha" style="width: 8rem">Monto</th><th style="width: 7rem"></th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td><span class="codigo">{{ s.numero }}</span><div class="secundario">{{ s.registrado_en | date: 'dd/MM HH:mm' }}</div></td>
            <td>{{ s.persona_nombre }}<div class="secundario">{{ s.persona_ci ? 'CI ' + s.persona_ci : 'Sin CI' }}</div></td>
            <td>{{ s.concepto?.nombre }}<div class="secundario">{{ s.glosa }}</div></td>
            <td>{{ nombreDe(s.resuelto_por) }}<div class="secundario">{{ s.resuelto_en | date: 'dd/MM HH:mm' }}</div></td>
            <td class="derecha monto">{{ s.monto | dinero: s.moneda }}</td>
            <td><p-button label="Pagar" size="small" icon="pi pi-check" (onClick)="pedirPago(s)" /></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6"><div class="vacio"><i class="pi pi-check-circle"></i>
            <div class="titulo-vacio">No hay solicitudes aprobadas por pagar</div></div></td></tr>
        </ng-template>
      </p-table>
    </p-dialog>

    <p-dialog [(visible)]="pagoVisible" header="Pagar solicitud" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <ng-container *ngIf="aPagar() as s">
        <p class="explicacion">
          <strong class="codigo">{{ s.numero }}</strong> · {{ s.persona_nombre }} recibe <strong>{{ s.monto | dinero: s.moneda }}</strong>
          por {{ s.concepto?.nombre?.toLowerCase() }}.
        </p>
        <div class="campos">
          <div class="campo span-6">
            <label>Forma de pago</label>
            <p-selectButton [options]="opciones()?.formas_pago ?? []" [(ngModel)]="pago.forma_pago" optionLabel="etiqueta" optionValue="valor" />
          </div>
          <ng-container *ngIf="pago.forma_pago !== 'EFECTIVO'">
            <div class="campo span-3">
              <label for="pago-banco">Banco</label>
              <p-dropdown inputId="pago-banco" [options]="opciones()?.bancos ?? []" [(ngModel)]="pago.banco_id" optionLabel="nombre"
                          optionValue="id" placeholder="Seleccione" appendTo="body" />
            </div>
            <div class="campo span-3">
              <label for="pago-doc">N.º de {{ pago.forma_pago === 'CHEQUE' ? 'cheque' : 'transferencia' }}</label>
              <input id="pago-doc" pInputText [(ngModel)]="pago.nro_documento" maxlength="40" />
            </div>
          </ng-container>
          <div class="campo span-6" *ngIf="pago.forma_pago === 'EFECTIVO'">
            <div class="check-campo">
              <p-checkbox [(ngModel)]="pago.provisional" [binary]="true" inputId="pago-provisional" />
              <label for="pago-provisional">Monto a rendir en el día (provisional)</label>
            </div>
            <small>Si el gasto real puede ser distinto, hoy se ajusta con la factura. Un aumento lo aprueba un aprobador.</small>
          </div>
          <div class="campo span-6" *ngIf="pago.forma_pago === 'EFECTIVO' && excedePago()">
            <small class="alerta">Supera el efectivo en caja: {{ disponiblePago() }}.</small>
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="pagoVisible = false" />
        <p-button label="Pagar y emitir comprobante" icon="pi pi-check" [loading]="pagandoSolicitud()"
                  [disabled]="pagandoSolicitud() || (pago.forma_pago === 'EFECTIVO' && excedePago())
                              || (pago.forma_pago !== 'EFECTIVO' && (!pago.banco_id || !pago.nro_documento))"
                  (onClick)="pagarSolicitud()" />
      </ng-template>
    </p-dialog>

    <!-- Bonos por pagar (lotes recibidos en la sede de esta caja): transporte y laboratorio -->
    <p-dialog [(visible)]="bonosVisible" header="Bonos por pagar" [modal]="true" [style]="{ width: '56rem', maxWidth: '97vw' }"
              [draggable]="false">
      <h4 class="titulo-bonos"><i class="pi pi-truck"></i> Bono de transporte</h4>
      <p class="explicacion">Se paga en efectivo al chofer del pesaje. El comprobante sale a su nombre y el bono queda pagado en el lote.
        Es un anticipo: la liquidación lo descuenta.</p>
      <p-table [value]="bonos()" dataKey="id" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr><th style="width: 10rem">Lote</th><th>Chofer</th><th style="width: 9rem">Pesaje</th>
              <th class="derecha" style="width: 8rem">Bono</th><th style="width: 7rem"></th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-b>
          <tr>
            <td><span class="codigo">{{ b.pesaje.lote.codigo }}</span><div class="secundario">{{ b.pesaje.lote.productor?.nombre ?? 'Producción propia' }}</div></td>
            <td>{{ b.beneficiario_nombre }}<div class="secundario">{{ b.beneficiario_ci ? 'CI ' + b.beneficiario_ci : 'Sin CI' }}</div></td>
            <td><span class="codigo">{{ b.pesaje.ticket }}</span><div class="secundario">{{ b.pesaje.placa ?? 'Sin placa' }} · {{ b.pesaje.peso_neto_kg | dinero }} kg</div></td>
            <td class="derecha monto">{{ b.monto | dinero: b.moneda }}</td>
            <td><p-button label="Pagar" size="small" icon="pi pi-check" [loading]="pagando() === b.id" [disabled]="pagando() !== null"
                          (onClick)="pagarBono(b)" /></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="5"><div class="vacio"><i class="pi pi-check-circle"></i><div class="titulo-vacio">No hay bonos de transporte por pagar en esta sede</div></div></td></tr>
        </ng-template>
      </p-table>

      <h4 class="titulo-bonos"><i class="pi pi-filter-fill"></i> Bono de laboratorio</h4>
      <p class="explicacion">Para los ensayos del lote. Por lo general cobra el productor; si viene otra persona, anote su nombre y CI.
        Es un anticipo: la liquidación lo descuenta.</p>
      <p-table [value]="bonosLab()" dataKey="id" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr><th style="width: 10rem">Lote</th><th>Cobra</th><th style="width: 8rem">CI</th>
              <th class="derecha" style="width: 8rem">Bono</th><th style="width: 7rem"></th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-b>
          <tr>
            <td><span class="codigo">{{ b.lote.codigo }}</span>
              <div class="secundario">{{ b.lote.material }} · {{ b.num_elementos }} elemento{{ b.num_elementos === 1 ? '' : 's' }}</div></td>
            <td><input pInputText [(ngModel)]="cobra[b.id].nombre" maxlength="150" class="ancho" [attr.aria-label]="'Quién cobra el bono del lote ' + b.lote.codigo" />
              <div class="secundario" *ngIf="cobra[b.id].nombre.trim().toUpperCase() !== (b.lote.productor?.nombre ?? '').toUpperCase()">
                Por cuenta de {{ b.lote.productor?.nombre }} · <button type="button" class="enlace" (click)="cobraProductor(b)">es el productor</button></div>
              <div class="secundario" *ngIf="cobra[b.id].nombre.trim().toUpperCase() === (b.lote.productor?.nombre ?? '').toUpperCase()">Productor del lote</div></td>
            <td><input pInputText [(ngModel)]="cobra[b.id].ci" maxlength="15" class="ancho" [attr.aria-label]="'CI de quien cobra el bono del lote ' + b.lote.codigo" /></td>
            <td class="derecha monto">{{ b.monto | dinero: b.moneda }}</td>
            <td><p-button label="Pagar" size="small" icon="pi pi-check" [loading]="pagando() === -b.id"
                          [disabled]="pagando() !== null || cobra[b.id].nombre.trim().length < 3" (onClick)="pagarBonoLab(b)" /></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="5"><div class="vacio"><i class="pi pi-check-circle"></i><div class="titulo-vacio">No hay bonos de laboratorio por pagar en esta sede</div></div></td></tr>
        </ng-template>
      </p-table>
    </p-dialog>
  `,
  styles: [...ESTILOS_CAJA, `
    .titulo-bonos { margin: 0.6rem 0 0.2rem; font-size: 0.95rem; display: flex; gap: 0.45rem; align-items: center; }
    .titulo-bonos + .explicacion { margin-top: 0.2rem; }
    input.ancho { width: 100%; }
    .enlace { border: 0; background: none; color: #1d4ed8; font-weight: 600; cursor: pointer; padding: 0; font-size: inherit; }
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .volver:hover { color: var(--primary-color, #2563eb); }
    .titulo-codigo { font-size: 0.85rem; font-weight: 600; margin-left: 0.4rem; vertical-align: middle;
                     padding: 0.1rem 0.4rem; border-radius: 4px; background: var(--surface-ground, #f3f4f6); }

    .apertura { display: flex; gap: 1.25rem; padding: 1.5rem; border: 1px dashed var(--surface-border, #d1d5db);
                border-radius: 10px; max-width: 46rem; }
    .apertura .icono { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 50%; display: flex;
                       align-items: center; justify-content: center; background: #fef3c7; color: #92400e; }
    .apertura h3 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .apertura .contenido { flex: 1; display: flex; flex-direction: column; gap: 0.8rem; align-items: flex-start; }
    .monedas { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .moneda { display: flex; flex-direction: column; gap: 0.3rem; min-width: 14rem; }

    .rotulo { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-color-secondary, #6b7280); }
    .monto.grande { font-size: 1.4rem; font-weight: 700; }

    .saldos { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .saldo { padding: 1rem 1.2rem; border-radius: 10px; border: 1px solid var(--surface-border, #e5e7eb);
             background: var(--surface-card, #fff); display: flex; flex-direction: column; gap: 0.35rem; }
    .monto.principal { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; }
    .desglose { display: flex; gap: 1.5rem; margin: 0.2rem 0 0; }
    .desglose div { display: flex; flex-direction: column; }
    .desglose dt { font-size: 0.72rem; color: var(--text-color-secondary, #6b7280); }
    .desglose dd { margin: 0; font-size: 0.9rem; }
    .otras { font-size: 0.78rem; color: var(--text-color-secondary, #6b7280); border-top: 1px solid var(--surface-border, #e5e7eb);
             padding-top: 0.45rem; margin-top: 0.2rem; }

    .ultimo { align-items: center; }
    .titulo-tabla { font-weight: 600; font-size: 0.95rem; }
    tr.anulado td { color: var(--text-color-secondary, #9ca3af); }
    tr.anulado .monto { text-decoration: line-through; }
    .persona { color: inherit; text-decoration: none; border-bottom: 1px dotted currentColor; }
    .persona:hover { color: var(--primary-color, #2563eb); }
    .aviso-persona { display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; font-size: 0.85rem; }
    .sugerencia { display: flex; justify-content: space-between; gap: 1rem; width: 100%; }
    :host ::ng-deep .w-full, :host ::ng-deep .w-full input { width: 100%; }
    .alerta { color: #b91c1c !important; font-weight: 600; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .pastilla-provisional { background: #fef3c7; color: #92400e; margin-top: 0.2rem; }
  `],
})
export class CajaOperacionComponent implements OnInit {
  /** :id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly servicio = inject(CajaService);
  private readonly permisos = inject(PermisosService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly recepcion = inject(RecepcionService);

  readonly porPagar = signal<SolicitudConUsuarios[]>([]);
  readonly cargandoSolicitudes = signal(false);
  readonly aPagar = signal<SolicitudConUsuarios | null>(null);
  readonly pagandoSolicitud = signal(false);
  solicitudesVisible = false;
  pagoVisible = false;
  pago: { forma_pago: FormaPago; banco_id: number | null; nro_documento: string | null; provisional: boolean } =
    { forma_pago: 'EFECTIVO', banco_id: null, nro_documento: null, provisional: false };

  readonly aAjustar = signal<Movimiento | null>(null);
  readonly ajustando = signal(false);
  ajusteVisible = false;
  ajuste = { monto: '', motivo: '', documento: '' };

  readonly bonos = signal<BonoPendiente[]>([]);
  readonly bonosLab = signal<BonoLabPendiente[]>([]);
  /** Quién cobra cada bono de laboratorio (por defecto, el productor). */
  cobra: Record<number, { nombre: string; ci: string }> = {};
  readonly pagando = signal<number | null>(null);
  bonosVisible = false;

  readonly caja = signal<CajaOperacion | null>(null);
  readonly opciones = signal<OpcionesCaja | null>(null);
  readonly abriendo = signal(false);
  readonly guardando = signal(false);
  readonly anulando = signal(false);
  readonly tipoNuevo = signal<TipoMovimiento>('EGRESO');
  readonly ultimo = signal<Movimiento | null>(null);
  readonly aAnular = signal<Movimiento | null>(null);

  movimientoVisible = false;
  anularVisible = false;
  motivo = '';
  saldoInicial: Partial<Record<Moneda, number | null>> = {};

  readonly simbolo = simbolo;
  readonly sugerencias = signal<PersonaCorta[]>([]);
  /** Mismo nombre con otro CI (o sin CI): posible duplicado. */
  readonly parecidas = signal<PersonaCorta[]>([]);
  /** El CI escrito ya es de otra persona. */
  readonly ciAjeno = signal<PersonaCorta | null>(null);
  /** Lo que muestra el autocompletado: texto escrito o la persona elegida. */
  personaTexto: string | PersonaCorta | null = null;
  readonly opcionesMoneda = [
    { valor: 'BOB', etiqueta: 'Bolivianos' },
    { valor: 'USD', etiqueta: 'Dólares' },
  ];

  readonly monedas = computed<Moneda[]>(() => (this.caja()?.maneja_usd ? ['BOB', 'USD'] : ['BOB']));

  readonly form = this.fb.group({
    concepto_id: [null as number | null, Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    moneda: ['BOB' as Moneda, Validators.required],
    forma_pago: ['EFECTIVO', Validators.required],
    banco_id: [null as number | null],
    nro_documento: [null as string | null],
    persona_id: [null as number | null],
    persona_nombre: ['', [Validators.required, Validators.maxLength(150)]],
    persona_ci: [null as string | null],
    glosa: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
    provisional: [false],
  });

  /** Valor del formulario como señal, para que los avisos de saldo se recalculen al escribir. */
  private readonly valores = signal(this.form.getRawValue());

  /** En cajas con aprobación, los egresos directos son solo los exentos. */
  readonly conceptosDelTipo = computed(() =>
    (this.opciones()?.conceptos ?? []).filter((c) => c.tipo === this.tipoNuevo()
      && (this.tipoNuevo() !== 'EGRESO' || !this.caja()?.requiere_aprobacion || c.exento_aprobacion)));

  private saldoDe(moneda: string): SaldoSesion | undefined {
    return this.caja()?.sesion_abierta?.saldos.find((s) => s.moneda === moneda);
  }

  /** Efectivo disponible, solo para egresos en efectivo. */
  readonly disponible = computed(() => {
    const v = this.valores();
    if (this.tipoNuevo() !== 'EGRESO' || v.forma_pago !== 'EFECTIVO') return null;
    const saldo = this.saldoDe(v.moneda ?? 'BOB');
    return saldo ? `${simbolo(saldo.moneda)} ${formatoDinero(saldo.saldo_efectivo_actual)}` : null;
  });

  readonly excede = computed(() => {
    const v = this.valores();
    if (this.tipoNuevo() !== 'EGRESO' || v.forma_pago !== 'EFECTIVO' || !v.monto) return false;
    const saldo = this.saldoDe(v.moneda ?? 'BOB');
    return !!saldo && Number(v.monto) > Number(saldo.saldo_efectivo_actual);
  });

  ngOnInit(): void {
    this.servicio.opciones().subscribe((o) => this.opciones.set(o));
    this.form.valueChanges.subscribe(() => this.valores.set(this.form.getRawValue()));

    // Banco y número solo cuando no es efectivo.
    this.form.get('forma_pago')!.valueChanges.subscribe((f) => {
      const banco = this.form.get('banco_id')!;
      const documento = this.form.get('nro_documento')!;
      if (f === 'EFECTIVO') {
        banco.clearValidators(); documento.clearValidators();
        banco.setValue(null, { emitEvent: false }); documento.setValue(null, { emitEvent: false });
      } else {
        banco.setValidators(Validators.required); documento.setValidators(Validators.required);
      }
      banco.updateValueAndValidity({ emitEvent: false });
      documento.updateValueAndValidity({ emitEvent: false });
    });

    this.cargar();
  }

  cargar(): void {
    this.servicio.ver(Number(this.id())).subscribe({
      next: (c) => {
        this.caja.set(c);
        this.cargarBonos();
        this.saldoInicial = {};
        for (const m of (c.maneja_usd ? ['BOB', 'USD'] : ['BOB']) as Moneda[]) {
          if (c.saldos_arranque[m] === null || c.saldos_arranque[m] === undefined) this.saldoInicial[m] = null;
        }
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo cargar la caja', detail: mensajeDeError(e), life: 10000 }),
    });
  }

  // --------------------------------------------- Comprobantes provisionales

  readonly provisionalesPendientes = computed(() =>
    (this.caja()?.sesion_abierta?.movimientos ?? []).filter((m) => m.estado === 'VIGENTE' && m.provisional && !m.validado_en));

  numerosPendientes(): string {
    return this.provisionalesPendientes().map((m) => m.numero).join(', ');
  }

  ajusteEnCurso(m: Movimiento): AjusteMovimiento | undefined {
    return (m.ajustes ?? []).find((a) => a.estado === 'PENDIENTE' || a.estado === 'APROBADO');
  }

  /** Lo que se entregó al emitir, si después se ajustó. */
  entregadoOriginal(m: Movimiento): string | null {
    const aplicados = (m.ajustes ?? []).filter((a) => a.estado === 'APLICADO');
    return aplicados.length ? aplicados[0].monto_anterior : null;
  }

  pedirAjuste(m: Movimiento): void {
    this.aAjustar.set(m);
    this.ajuste = { monto: '', motivo: '', documento: '' };
    this.ajusteVisible = true;
  }

  montoAjusteInvalido(): boolean {
    return numeroInvalido(this.ajuste.monto, 2) || aNumero(this.ajuste.monto, 2) === 0;
  }

  diferenciaAjuste(): number | null {
    const m = this.aAjustar();
    const n = aNumero(this.ajuste.monto, 2);
    if (!m || n === null || n === 0) return null;
    const d = Math.round((n - Number(m.monto)) * 100) / 100;
    return d === 0 ? null : d;
  }

  /** Un aumento en caja con aprobación (concepto no exento) va al aprobador. */
  pideAprobacion(): boolean {
    const m = this.aAjustar();
    const exento = this.opciones()?.conceptos.find((k) => k.id === m?.concepto_id)?.exento_aprobacion ?? false;
    return !!this.caja()?.requiere_aprobacion && !exento;
  }

  ajusteValido(): boolean {
    return this.diferenciaAjuste() !== null && this.ajuste.motivo.trim().length >= 5;
  }

  ajustar(): void {
    const m = this.aAjustar();
    if (!m) return;
    this.ajustando.set(true);
    this.servicio.ajustarMovimiento(m.id, {
      monto: aNumero(this.ajuste.monto, 2)!, motivo: this.ajuste.motivo.trim(), documento: this.ajuste.documento.trim() || null,
    }).subscribe({
      next: (r) => {
        this.ajustando.set(false);
        this.ajusteVisible = false;
        this.toast.add({ severity: r.ajuste.estado === 'PENDIENTE' ? 'info' : 'success', summary: r.mensaje ?? 'Ajustado', life: 9000 });
        this.cargar();
      },
      error: (e) => { this.ajustando.set(false); this.toast.add({ severity: 'error', summary: 'No se ajustó', detail: mensajeDeError(e), life: 9000 }); },
    });
  }

  aplicarAjuste(m: Movimiento): void {
    const a = this.ajusteEnCurso(m);
    if (!a) return;
    this.servicio.aplicarAjuste(a.id).subscribe({
      next: (r) => { this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Aplicado', life: 9000 }); this.cargar(); },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se entregó la diferencia', detail: mensajeDeError(e), life: 9000 }),
    });
  }

  validar(m: Movimiento): void {
    this.servicio.validarMovimiento(m.id).subscribe({
      next: (r) => {
        this.ultimo.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Validado', life: 8000 });
        this.cargar();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se validó', detail: mensajeDeError(e), life: 9000 }),
    });
  }

  // ------------------------------------------------- Solicitudes por pagar

  abrirSolicitudes(): void {
    const c = this.caja();
    if (!c) return;
    this.solicitudesVisible = true;
    this.cargandoSolicitudes.set(true);
    this.servicio.solicitudesDeCaja(c.id).subscribe({
      next: (s) => { this.porPagar.set(s); this.cargandoSolicitudes.set(false); },
      error: (e) => {
        this.cargandoSolicitudes.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudieron cargar las solicitudes', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  pedirPago(s: SolicitudConUsuarios): void {
    this.aPagar.set(s);
    this.pago = { forma_pago: 'EFECTIVO', banco_id: null, nro_documento: null, provisional: false };
    this.pagoVisible = true;
  }

  disponiblePago(): string {
    const s = this.aPagar();
    const saldo = s ? this.saldoDe(s.moneda) : undefined;
    return saldo ? `${simbolo(saldo.moneda)} ${formatoDinero(saldo.saldo_efectivo_actual)}` : '';
  }

  excedePago(): boolean {
    const s = this.aPagar();
    const saldo = s ? this.saldoDe(s.moneda) : undefined;
    return !!s && !!saldo && Number(s.monto) > Number(saldo.saldo_efectivo_actual);
  }

  pagarSolicitud(): void {
    const s = this.aPagar();
    if (!s) return;
    this.pagandoSolicitud.set(true);
    this.servicio.pagarSolicitud(s.id, this.pago).subscribe({
      next: (r) => {
        this.pagandoSolicitud.set(false);
        this.pagoVisible = false;
        this.solicitudesVisible = false;
        this.ultimo.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Pagada', detail: 'Imprima el comprobante para que lo firme.', life: 8000 });
        this.cargar();
      },
      error: (e) => {
        this.pagandoSolicitud.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pagó la solicitud', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  cargarBonos(): void {
    const c = this.caja();
    if (!c?.sesion_abierta || !c.soy_cajero || !this.permisos.can('caja.pagar-bono')) { this.bonos.set([]); this.bonosLab.set([]); return; }
    this.recepcion.bonosPendientes(c.id).subscribe({ next: (b) => this.bonos.set(b), error: () => this.bonos.set([]) });
    this.recepcion.bonosLaboratorioPendientes(c.id).subscribe({
      next: (b) => {
        for (const x of b) this.cobra[x.id] ??= { nombre: x.lote.productor?.nombre ?? '', ci: x.lote.productor?.ci ?? '' };
        this.bonosLab.set(b);
      },
      error: () => this.bonosLab.set([]),
    });
  }

  cobraProductor(b: BonoLabPendiente): void {
    this.cobra[b.id] = { nombre: b.lote.productor?.nombre ?? '', ci: b.lote.productor?.ci ?? '' };
  }

  pagarBonoLab(b: BonoLabPendiente): void {
    const c = this.caja();
    if (!c) return;
    const quien = this.cobra[b.id];
    this.pagando.set(-b.id);
    this.recepcion.pagarBonoLaboratorio(b.id, c.id, quien.nombre.trim(), quien.ci.trim() || null).subscribe({
      next: (r) => {
        this.pagando.set(null);
        this.ultimo.set(r.data as unknown as Movimiento);
        this.toast.add({ severity: 'success', summary: r.mensaje, detail: 'Imprima el comprobante para que lo firme quien cobró.', life: 8000 });
        this.cargar();
      },
      error: (e) => {
        this.pagando.set(null);
        this.toast.add({ severity: 'error', summary: 'No se pagó el bono de laboratorio', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  abrirBonos(): void {
    this.cargarBonos();
    this.bonosVisible = true;
  }

  pagarBono(b: BonoPendiente): void {
    const c = this.caja();
    if (!c) return;
    this.pagando.set(b.id);
    this.recepcion.pagarBono(b.id, c.id).subscribe({
      next: (r) => {
        this.pagando.set(null);
        this.ultimo.set(r.data as unknown as Movimiento);
        this.toast.add({ severity: 'success', summary: r.mensaje, detail: 'Imprima el comprobante para que lo firme el chofer.', life: 8000 });
        this.cargar();
      },
      error: (e) => {
        this.pagando.set(null);
        this.toast.add({ severity: 'error', summary: 'No se pagó el bono', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  puede(permiso: string): boolean {
    return this.permisos.can(permiso);
  }

  porId(_: number, m: Movimiento): number {
    return m.id;
  }

  nombreDe(usuario: UsuarioCorto | number | null): string {
    return usuario && typeof usuario === 'object' ? usuario.name : '';
  }

  etiquetaForma(forma: string): string {
    return this.opciones()?.formas_pago.find((f) => f.valor === forma)?.etiqueta ?? forma;
  }

  // ------------------------------------------------------------ Apertura

  /** Lista cuando cada moneda que se digita tiene un monto (cero vale). */
  aperturaLista(): boolean {
    return Object.values(this.saldoInicial).every((v) => v !== null && v !== undefined);
  }

  abrir(): void {
    const c = this.caja();
    if (!c) return;
    this.abriendo.set(true);
    this.servicio.abrir(c.id, this.saldoInicial).subscribe({
      next: (r) => {
        this.abriendo.set(false);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Caja abierta' });
        this.cargar();
      },
      error: (e) => {
        this.abriendo.set(false);
        this.toast.add({ severity: 'error', summary: 'No se abrió la caja', detail: mensajeDeError(e), life: 8000 });
        this.cargar();
      },
    });
  }

  // --------------------------------------------------------- Movimientos

  nuevoMovimiento(tipo: TipoMovimiento): void {
    this.tipoNuevo.set(tipo);
    this.form.reset({ moneda: 'BOB', forma_pago: 'EFECTIVO', provisional: false });
    this.form.get('persona_ci')!.enable();
    this.personaTexto = null;
    this.parecidas.set([]);
    this.ciAjeno.set(null);
    this.movimientoVisible = true;

    // Se vuelven a pedir los conceptos: pudieron crearse después de abrir la pantalla.
    this.servicio.opciones().subscribe((o) => {
      this.opciones.set(o);
      const conceptos = this.conceptosDelTipo();
      if (conceptos.length === 1) this.form.patchValue({ concepto_id: conceptos[0].id });
    });
  }

  /** La sesión abierta es de un día anterior: hay que cerrarla antes de registrar. */
  deOtroDia(): boolean {
    const abierta = this.caja()?.sesion_abierta?.abierta_en;
    if (!abierta) return false;
    const d = new Date(abierta);
    const hoy = new Date();
    return d.getFullYear() !== hoy.getFullYear() || d.getMonth() !== hoy.getMonth() || d.getDate() !== hoy.getDate();
  }

  reporte(sesionId: number): void {
    this.servicio.reporteSesion(sesionId).subscribe({
      next: abrirPdf,
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el reporte' }),
    });
  }

  nombresCajeros(): string {
    return (this.caja()?.cajeros ?? []).map((u) => u.name).join(', ');
  }

  buscarPersona(texto: string): void {
    this.servicio.buscarPersonas(texto).subscribe({
      next: (p) => this.sugerencias.set(p),
      error: () => this.sugerencias.set([]),
    });
  }

  /** Elegida de la lista: queda vinculada. Escrita a mano: será una persona nueva (o la del mismo CI). */
  escribirPersona(valor: string | PersonaCorta | null): void {
    const ci = this.form.get('persona_ci')!;
    if (valor && typeof valor === 'object') {
      this.form.patchValue({ persona_id: valor.id, persona_nombre: valor.nombre, persona_ci: valor.ci });
      ci.disable();
      this.parecidas.set([]);
      this.ciAjeno.set(null);
    } else {
      if (this.form.value.persona_id) ci.setValue(null);
      this.form.patchValue({ persona_id: null, persona_nombre: (valor ?? '').toString() });
      ci.enable();
    }
  }

  /** Antes de guardar una persona nueva, mira si ya existe con otro CI o si el CI es de otra. */
  revisarPersona(): void {
    const v = this.form.getRawValue();
    if (v.persona_id || !v.persona_nombre?.trim()) {
      this.parecidas.set([]); this.ciAjeno.set(null);
      return;
    }
    this.servicio.coincidencias(v.persona_nombre, v.persona_ci).subscribe({
      next: (r) => { this.parecidas.set(r.mismo_nombre); this.ciAjeno.set(r.mismo_ci); },
      error: () => { this.parecidas.set([]); this.ciAjeno.set(null); },
    });
  }

  usarPersona(p: PersonaCorta): void {
    this.personaTexto = p;
    this.escribirPersona(p);
    this.parecidas.set([]);
    this.ciAjeno.set(null);
  }

  registrar(): void {
    const sesion = this.caja()?.sesion_abierta;
    if (!sesion) return;

    this.guardando.set(true);
    const datos = this.form.getRawValue();
    // Provisional solo vale para egresos en efectivo.
    datos.provisional = !!datos.provisional && this.tipoNuevo() === 'EGRESO' && datos.forma_pago === 'EFECTIVO';
    this.servicio.registrar(sesion.id, datos as DatosMovimiento).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.movimientoVisible = false;
        this.ultimo.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Registrado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se registró', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  pedirAnulacion(m: Movimiento): void {
    this.aAnular.set(m);
    this.motivo = '';
    this.anularVisible = true;
  }

  anular(): void {
    const m = this.aAnular();
    if (!m) return;

    this.anulando.set(true);
    this.servicio.anular(m.id, this.motivo.trim()).subscribe({
      next: (r) => {
        this.anulando.set(false);
        this.anularVisible = false;
        if (this.ultimo()?.id === m.id) this.ultimo.set(null);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Anulado' });
        this.cargar();
      },
      error: (e) => {
        this.anulando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se anuló', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  imprimir(m: Movimiento): void {
    this.servicio.comprobante(m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el comprobante' }),
    });
  }
}
