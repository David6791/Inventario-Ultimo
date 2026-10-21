import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { mensajeDeError } from '../../cargas/core/errores';
import { aNumero, numeroInvalido } from '../../cargas/core/numeros';
import { Moneda, OpcionesSolicitud, PersonaCorta, SolicitudConUsuarios } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';
import { ESTILOS_SOLICITUD, detalleEstado, etiquetaEstado, nombreUsuario } from './estado-solicitud';

/**
 * Solicitudes de dinero de las cajas con aprobación. El solicitante pide a su
 * nombre; el cajero de la caja también puede registrar a nombre de otra
 * persona. Aquí se sigue el estado hasta que la cajera paga.
 */
@Component({
  selector: 'app-solicitudes-caja',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AutoCompleteModule, ButtonModule, DialogModule, DropdownModule, InputTextModule,
    InputTextareaModule, SelectButtonModule, TableModule, ToastModule, TooltipModule, DineroPipe,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Solicitudes de dinero</h2>
        <p class="subtitulo">
          Pida dinero de una caja que trabaja con aprobación. Un aprobador la revisa y, si la aprueba, la cajera le
          entrega el dinero con su comprobante.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nueva solicitud" icon="pi pi-plus" (onClick)="nueva()" [disabled]="!opciones()?.cajas?.length" />
      </div>
    </header>

    <div class="nota nota-neutra nota-encabezado" *ngIf="opciones() && !opciones()!.cajas.length">
      <i class="pi pi-info-circle"></i>
      <span>Todavía no hay cajas que trabajen con aprobación{{ opciones()!.puede_solicitar ? '' : ' donde usted sea cajero' }}.
            El administrador lo activa en Caja → Cajas.</span>
    </div>

    <p-table [value]="solicitudes()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla"
             [paginator]="solicitudes().length > 20" [rows]="20">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 10rem">Solicitud</th>
          <th style="width: 7rem">Caja</th>
          <th>Para qué</th>
          <th style="width: 14rem">A nombre de</th>
          <th style="width: 9rem" class="derecha">Monto</th>
          <th style="width: 13rem">Estado</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-s>
        <tr [class.inactiva]="s.estado === 'ANULADA' || s.estado === 'RECHAZADA'">
          <td>
            <div class="codigo">{{ s.numero }}</div>
            <div class="secundario">{{ s.registrado_en | date: 'dd/MM/yyyy HH:mm' }}</div>
          </td>
          <td><span class="codigo">{{ s.caja?.codigo }}</span></td>
          <td>
            <div>{{ s.concepto?.nombre }}</div>
            <div class="secundario">{{ s.glosa }}</div>
          </td>
          <td>
            <div>{{ s.persona_nombre }}</div>
            <div class="secundario" *ngIf="s.persona_ci">CI {{ s.persona_ci }}</div>
          </td>
          <td class="derecha monto">{{ s.monto | dinero: s.moneda }}</td>
          <td>
            <span class="pastilla" [ngClass]="'estado-' + s.estado">{{ etiqueta(s.estado) }}</span>
            <div class="secundario detalle-estado" *ngIf="detalle(s) as d">{{ d }}</div>
          </td>
          <td class="centro">
            <p-button *ngIf="s.estado === 'PENDIENTE' || s.estado === 'APROBADA'" icon="pi pi-ban" [text]="true"
                      [rounded]="true" size="small" severity="danger" pTooltip="Anular la solicitud" (onClick)="pedirAnulacion(s)" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-send"></i>
            <div class="titulo-vacio">Todavía no registró solicitudes</div>
            <span>Con «Nueva solicitud» pide dinero de una caja; aquí verá cuándo la aprueban y cuándo se la pagan.</span>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <!-- ====================== Nueva solicitud ====================== -->
    <p-dialog [(visible)]="editorVisible" header="Nueva solicitud de dinero" [modal]="true" [style]="{ width: '38rem' }"
              [draggable]="false">
      <div class="campos" *ngIf="opciones() as o">
        <div class="campo span-6">
          <label for="caja">Caja</label>
          <p-dropdown inputId="caja" [options]="o.cajas" [(ngModel)]="f.caja_id" optionValue="id" placeholder="Elija la caja"
                      appendTo="body" (onChange)="cambioCaja()">
            <ng-template let-c pTemplate="item"><span class="codigo">{{ c.codigo }}</span> · {{ c.nombre }}
              <span class="secundario">{{ c.sede }}</span></ng-template>
            <ng-template let-c pTemplate="selectedItem"><span class="codigo">{{ c.codigo }}</span> · {{ c.nombre }}</ng-template>
          </p-dropdown>
        </div>

        <div class="campo span-6" *ngIf="puedeANombreDe() && o.puede_solicitar">
          <label>A nombre de</label>
          <p-selectButton [options]="destinos" [(ngModel)]="aOtro" optionLabel="etiqueta" optionValue="valor" />
        </div>

        <ng-container *ngIf="aOtro">
          <div class="campo span-4">
            <label for="persona">Persona que recibe el dinero</label>
            <p-autoComplete inputId="persona" [(ngModel)]="personaTexto" [suggestions]="sugerencias()"
                            (completeMethod)="buscarPersona($event.query)" (ngModelChange)="escribirPersona($event)"
                            field="nombre" [minLength]="2" [delay]="250" appendTo="body" placeholder="Nombre o CI"
                            styleClass="w-full" [inputStyle]="{ width: '100%' }">
              <ng-template let-p pTemplate="item">
                <div class="sugerencia"><span>{{ p.nombre }}</span><span class="secundario">{{ p.ci ? 'CI ' + p.ci : 'sin CI' }}</span></div>
              </ng-template>
            </p-autoComplete>
            <small *ngIf="f.persona_id">Del registro de personas.</small>
            <small *ngIf="!f.persona_id && f.persona_nombre">Persona nueva: se agrega al registro.</small>
          </div>
          <div class="campo span-2">
            <label for="ci">CI <span class="opcional">(opcional)</span></label>
            <input id="ci" pInputText [(ngModel)]="f.persona_ci" maxlength="15" [disabled]="!!f.persona_id" />
          </div>
        </ng-container>

        <div class="campo span-6">
          <label for="concepto">Concepto</label>
          <p-dropdown inputId="concepto" [options]="o.conceptos" [(ngModel)]="f.concepto_id" optionLabel="nombre" optionValue="id"
                      placeholder="Elija el concepto" [filter]="true" filterBy="nombre" appendTo="body"
                      emptyMessage="No hay conceptos de egreso" />
        </div>

        <div class="campo span-3">
          <label for="monto">Monto</label>
          <input id="monto" pInputText inputmode="decimal" [(ngModel)]="f.monto" placeholder="0,00"
                 [class.ng-invalid]="montoInvalido()" [class.ng-dirty]="montoInvalido()" />
          <small *ngIf="montoInvalido()" class="alerta">Escriba el monto con hasta dos decimales.</small>
        </div>
        <div class="campo span-3" *ngIf="monedas().length > 1">
          <label>Moneda</label>
          <p-selectButton [options]="opcionesMoneda" [(ngModel)]="f.moneda" optionLabel="etiqueta" optionValue="valor" />
        </div>

        <div class="campo span-6">
          <label for="glosa">Para qué es el dinero</label>
          <textarea id="glosa" pInputTextarea [(ngModel)]="f.glosa" rows="3" maxlength="200"
                    placeholder="Por ejemplo: combustible para la camioneta del muestreo a Porco"></textarea>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Enviar solicitud" icon="pi pi-send" [loading]="guardando()" [disabled]="!valido() || guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>

    <!-- ====================== Anular ====================== -->
    <p-dialog [(visible)]="anularVisible" header="Anular solicitud" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <p class="explicacion" *ngIf="aAnular() as s">
        Se anula la solicitud <strong class="codigo">{{ s.numero }}</strong> por {{ s.monto | dinero: s.moneda }}.
        No se borra: queda en la lista como anulada.
      </p>
      <div class="campos">
        <div class="campo span-6">
          <label for="motivo">Motivo</label>
          <textarea id="motivo" pInputTextarea [(ngModel)]="motivo" rows="3" maxlength="250"></textarea>
          <small>Al menos 10 caracteres.</small>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular" icon="pi pi-ban" severity="danger" [loading]="anulando()"
                  [disabled]="motivo.trim().length < 10 || anulando()" (onClick)="anular()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [...ESTILOS_CAJA, ESTILOS_SOLICITUD, `
    .sugerencia { display: flex; justify-content: space-between; gap: 1rem; width: 100%; }
    :host ::ng-deep .w-full, :host ::ng-deep .w-full input { width: 100%; }
    .alerta { color: #b91c1c !important; font-weight: 600; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
  `],
})
export class SolicitudesCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);
  private readonly ruta = inject(ActivatedRoute);

  readonly solicitudes = signal<SolicitudConUsuarios[]>([]);
  readonly opciones = signal<OpcionesSolicitud | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly anulando = signal(false);
  readonly sugerencias = signal<PersonaCorta[]>([]);
  readonly aAnular = signal<SolicitudConUsuarios | null>(null);
  private readonly cajaElegida = signal<number | null>(null);

  editorVisible = false;
  anularVisible = false;
  motivo = '';
  aOtro = false;
  personaTexto: string | PersonaCorta | null = null;
  f = this.vacio();

  readonly destinos = [{ valor: false, etiqueta: 'A mi nombre' }, { valor: true, etiqueta: 'De otra persona' }];
  readonly opcionesMoneda = [{ valor: 'BOB', etiqueta: 'Bolivianos' }, { valor: 'USD', etiqueta: 'Dólares' }];

  readonly monedas = computed<Moneda[]>(() =>
    this.opciones()?.cajas.find((c) => c.id === this.cajaElegida())?.monedas ?? ['BOB']);

  readonly etiqueta = etiquetaEstado;
  readonly detalle = detalleEstado;
  readonly usuario = nombreUsuario;

  ngOnInit(): void {
    this.cargar();
    this.servicio.opcionesSolicitud().subscribe({
      next: (o) => {
        this.opciones.set(o);
        // Desde la caja: «Registrar solicitud» llega con ?caja=id.
        const caja = Number(this.ruta.snapshot.queryParamMap.get('caja'));
        if (caja && o.cajas.some((c) => c.id === caja)) this.nueva(caja);
      },
      error: (e) => this.error('No se pudieron cargar las cajas', e),
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.misSolicitudes().subscribe({
      next: (s) => { this.solicitudes.set(s); this.cargando.set(false); },
      error: (e) => { this.cargando.set(false); this.error('No se pudo cargar la lista', e); },
    });
  }

  private vacio() {
    return {
      caja_id: null as number | null, concepto_id: null as number | null, monto: '', moneda: 'BOB' as Moneda, glosa: '',
      persona_id: null as number | null, persona_nombre: null as string | null, persona_ci: null as string | null,
    };
  }

  /** El cajero de la caja elegida puede registrar a nombre de otra persona. */
  puedeANombreDe(): boolean {
    return !!this.opciones()?.cajas.find((c) => c.id === this.f.caja_id)?.soy_cajero;
  }

  nueva(caja: number | null = null): void {
    const o = this.opciones();
    this.f = this.vacio();
    this.f.caja_id = caja ?? (o?.cajas.length === 1 ? o.cajas[0].id : null);
    this.personaTexto = null;
    this.cambioCaja();
    this.editorVisible = true;
  }

  cambioCaja(): void {
    this.cajaElegida.set(this.f.caja_id);
    if (!this.monedas().includes(this.f.moneda)) this.f.moneda = 'BOB';
    // Sin permiso para pedir a su nombre, el cajero siempre registra a nombre de otro.
    this.aOtro = this.puedeANombreDe() && !this.opciones()?.puede_solicitar;
    if (!this.puedeANombreDe()) this.aOtro = false;
  }

  montoInvalido(): boolean {
    return numeroInvalido(this.f.monto, 2) || (aNumero(this.f.monto, 2) === 0);
  }

  valido(): boolean {
    const monto = aNumero(this.f.monto, 2);
    return !!this.f.caja_id && !!this.f.concepto_id && monto !== null && monto > 0 && this.f.glosa.trim().length >= 5
      && (!this.aOtro || !!this.f.persona_id || !!this.f.persona_nombre?.trim());
  }

  buscarPersona(texto: string): void {
    this.servicio.buscarPersonas(texto).subscribe({ next: (p) => this.sugerencias.set(p), error: () => this.sugerencias.set([]) });
  }

  escribirPersona(valor: string | PersonaCorta | null): void {
    if (valor && typeof valor === 'object') {
      this.f.persona_id = valor.id; this.f.persona_nombre = valor.nombre; this.f.persona_ci = valor.ci;
    } else {
      if (this.f.persona_id) this.f.persona_ci = null;
      this.f.persona_id = null; this.f.persona_nombre = (valor ?? '').toString();
    }
  }

  guardar(): void {
    this.guardando.set(true);
    const f = this.f;
    this.servicio.solicitar({
      caja_id: f.caja_id!, concepto_id: f.concepto_id!, monto: aNumero(f.monto, 2)!, moneda: f.moneda, glosa: f.glosa.trim(),
      ...(this.aOtro ? { persona_id: f.persona_id, persona_nombre: f.persona_nombre, persona_ci: f.persona_ci } : {}),
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Solicitud registrada', life: 7000 });
        this.cargar();
      },
      error: (e) => { this.guardando.set(false); this.error('No se registró la solicitud', e); },
    });
  }

  pedirAnulacion(s: SolicitudConUsuarios): void {
    this.aAnular.set(s);
    this.motivo = '';
    this.anularVisible = true;
  }

  anular(): void {
    const s = this.aAnular();
    if (!s) return;
    this.anulando.set(true);
    this.servicio.anularSolicitud(s.id, this.motivo.trim()).subscribe({
      next: (r) => {
        this.anulando.set(false);
        this.anularVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Solicitud anulada' });
        this.cargar();
      },
      error: (e) => { this.anulando.set(false); this.error('No se anuló', e); },
    });
  }

  private error(titulo: string, e: unknown): void {
    this.toast.add({ severity: 'error', summary: titulo, detail: mensajeDeError(e), life: 9000 });
  }
}
