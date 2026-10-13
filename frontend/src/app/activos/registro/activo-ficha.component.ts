import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { GaleriaFotosComponent } from './galeria-fotos.component';
import { ActivoService } from '../core/services/activo.service';
import { Activo, ESTADOS_ACTIVO, SeveridadTag } from '../core/models/activo.model';

@Component({
  selector: 'app-activo-ficha',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TabViewModule, CardModule, TagModule,
    TableModule, TimelineModule, ButtonModule, DividerModule, MessageModule,
    GaleriaFotosComponent,
  ],
  template: `
    <ng-container *ngIf="activo() as a">

      <div class="flex justify-content-between align-items-start mb-3">
        <div>
          <div class="flex align-items-center gap-2">
            <span class="font-mono text-xl font-bold">{{ a.codigo }}</span>
            <p-tag [value]="etiquetaEstado(a.situacion.estado)"
                   [severity]="severidadEstado(a.situacion.estado)" />
            <p-tag *ngIf="a.es_bien_control" value="Bien de control" severity="secondary" />
          </div>
          <h2 class="mt-2 mb-0">{{ a.denominacion }}</h2>
          <small class="text-color-secondary">
            {{ a.clase?.nombre }} · {{ a.subclase?.nombre }}
          </small>
        </div>
        <div class="flex gap-2">
          <p-button label="Etiqueta" icon="pi pi-qrcode" severity="secondary"
                    [routerLink]="['/activos/registro/etiquetas']"
                    [queryParams]="{ ids: a.id }" />
          <p-button label="Volver" icon="pi pi-arrow-left" [text]="true"
                    routerLink="/activos/registro" />
        </div>
      </div>

      <p-message *ngIf="!a.situacion.esta_asignado" severity="warn" styleClass="w-full mb-3"
        text="Sin custodio asignado. Un bien en uso siempre debe tener responsable identificado." />

      <p-tabView>

        <!-- ------------------------------------------------------- Datos -->
        <p-tabPanel header="Datos">
          <div class="grid">
            <div class="col-12 md:col-6">
              <h4>Identificación</h4>
              <table class="w-full text-sm">
                <tr><td class="text-color-secondary py-2" style="width:40%">Marca</td><td>{{ a.marca ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Modelo</td><td>{{ a.modelo ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Serie</td><td class="font-mono">{{ a.serie ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Placa</td><td>{{ a.placa ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Año</td><td>{{ a.anio_fabricacion ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Condición</td><td>{{ a.situacion.condicion }}</td></tr>
              </table>
            </div>

            <div class="col-12 md:col-6">
              <h4>Origen</h4>
              <table class="w-full text-sm">
                <tr><td class="text-color-secondary py-2" style="width:40%">Tipo</td><td>{{ a.origen.tipo }}</td></tr>
                <tr><td class="text-color-secondary py-2">Factura</td><td>{{ a.origen.factura_nro ?? '—' }}</td></tr>
                <tr><td class="text-color-secondary py-2">Acta de recepción</td><td>{{ a.origen.acta_recepcion ?? '—' }}</td></tr>
                <tr>
                  <td class="text-color-secondary py-2">Incorporación</td>
                  <td>{{ a.fecha_incorporacion | date: 'dd/MM/yyyy' }}</td>
                </tr>
                <tr>
                  <td class="text-color-secondary py-2">Inicio de uso</td>
                  <td>
                    {{ a.fecha_inicio_uso ? (a.fecha_inicio_uso | date: 'dd/MM/yyyy') : '—' }}
                    <small class="block text-color-secondary">Base de la depreciación</small>
                  </td>
                </tr>
                <tr>
                  <td class="text-color-secondary py-2">Ubicación</td>
                  <td>{{ a.situacion.ubicacion?.ruta ?? '—' }}</td>
                </tr>
              </table>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Fotografías">
          <app-galeria-fotos [activoId]="a.id" />
        </p-tabPanel>
        <!-- ------------------------------------------------------- Costo -->
        <p-tabPanel header="Costo de origen">
          <p-table [value]="a.costos ?? []" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr><th>Concepto</th><th>Documento</th><th>Observación</th><th class="text-right">Monto</th></tr>
            </ng-template>
            <ng-template pTemplate="body" let-c>
              <tr>
                <td>{{ c.concepto }}</td>
                <td>{{ c.documento ?? '—' }}</td>
                <td class="text-sm">{{ c.observacion ?? '—' }}</td>
                <td class="text-right">{{ c.monto | number: '1.2-2' }}</td>
              </tr>
            </ng-template>
            <ng-template pTemplate="footer">
              <tr>
                <td colspan="3" class="text-right font-bold">Valor de origen</td>
                <td class="text-right font-bold text-lg">
                  {{ a.valuacion.moneda }} {{ a.valuacion.valor_origen | number: '1.2-2' }}
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabPanel>

        <!-- --------------------------------------------------- Valuación -->
        <p-tabPanel header="Valuación">
          <p-message
            severity="info" styleClass="w-full mb-3"
            text="Las dos series se mantienen separadas porque divergen: la fiscal la fija el Anexo del Art. 22, la económica es la estimación real de uso. El cálculo de la depreciación llega con el cierre mensual." />

          <div class="grid">
            <div class="col-12 md:col-6">
              <p-card header="Serie financiera">
                <table class="w-full text-sm">
                  <tr><td class="text-color-secondary py-2">Valor de origen</td>
                      <td class="text-right">{{ a.valuacion.valor_origen | number: '1.2-2' }}</td></tr>
                  <tr><td class="text-color-secondary py-2">Valor residual</td>
                      <td class="text-right">{{ a.valuacion.valor_residual | number: '1.2-2' }}</td></tr>
                  <tr><td class="text-color-secondary py-2">Vida útil económica</td>
                      <td class="text-right">
                        {{ a.valuacion.vida_util_economica_meses
                           ? (a.valuacion.vida_util_economica_meses / 12 | number: '1.0-1') + ' años'
                           : 'No deprecia' }}
                      </td></tr>
                </table>
              </p-card>
            </div>

            <div class="col-12 md:col-6">
              <p-card header="Serie impositiva">
                <table class="w-full text-sm">
                  <tr><td class="text-color-secondary py-2">Vida útil fiscal</td>
                      <td class="text-right">
                        {{ a.valuacion.vida_util_fiscal_meses
                           ? (a.valuacion.vida_util_fiscal_meses / 12 | number: '1.0-1') + ' años'
                           : 'No deprecia' }}
                      </td></tr>
                  <tr><td class="text-color-secondary py-2">Régimen</td>
                      <td class="text-right">
                        <p-tag [value]="a.valuacion.regimen_fiscal"
                          [severity]="a.valuacion.regimen_fiscal === 'ACELERADO_DS5563' ? 'warning' : 'secondary'"/>
                      </td></tr>
                  <tr *ngIf="a.valuacion.regimen_fiscal === 'ACELERADO_DS5563'">
                      <td class="text-color-secondary py-2">DDJJ presentada</td>
                      <td class="text-right">{{ a.valuacion.ds5563_ddjj_presentada ? 'Sí' : 'Pendiente' }}</td></tr>
                </table>

                <p-message *ngIf="a.valuacion.regimen_fiscal === 'ACELERADO_DS5563'"
                  severity="warn" styleClass="w-full mt-3"
                  text="Acogido al DS 5563: mitad de vida útil. Requiere declaración jurada y revelación en notas a los estados financieros." />
              </p-card>
            </div>
          </div>
        </p-tabPanel>

        <!-- ------------------------------------------------- Movimientos -->
        <p-tabPanel header="Movimientos">
          <p-message severity="info" styleClass="w-full mb-3"
            text="Bitácora inmutable: nada se edita ni se borra. Una corrección genera un movimiento nuevo." />

          <p-timeline [value]="a.movimientos ?? []" align="left">
            <ng-template pTemplate="content" let-m>
              <div class="mb-3">
                <span class="font-bold">{{ m.tipo }}</span>
                <small class="text-color-secondary block">{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</small>
                <div *ngIf="m.estado_anterior || m.estado_nuevo" class="text-sm mt-1">
                  {{ m.estado_anterior ?? '—' }} → {{ m.estado_nuevo ?? '—' }}
                </div>
                <pre *ngIf="m.detalle" class="text-xs text-color-secondary mt-1">{{ m.detalle | json }}</pre>
              </div>
            </ng-template>
          </p-timeline>
        </p-tabPanel>

      </p-tabView>
    </ng-container>

    <div *ngIf="cargando()" class="text-center p-6">
      <i class="pi pi-spin pi-spinner text-4xl"></i>
    </div>
  `,
})
export class ActivoFichaComponent implements OnInit {
  private readonly servicio = inject(ActivoService);
  private readonly ruta = inject(ActivatedRoute);

  readonly activo = signal<Activo | null>(null);
  readonly cargando = signal(true);

  ngOnInit(): void {
    const id = Number(this.ruta.snapshot.paramMap.get('id'));

    this.servicio.ver(id).subscribe({
      next: (a) => { this.activo.set(a); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  etiquetaEstado(estado: string): string {
    return ESTADOS_ACTIVO.find((e) => e.valor === estado)?.etiqueta ?? estado;
  }

  severidadEstado(estado: string): SeveridadTag {
    return ESTADOS_ACTIVO.find((e) => e.valor === estado)?.severidad ?? 'secondary';
  }
}
