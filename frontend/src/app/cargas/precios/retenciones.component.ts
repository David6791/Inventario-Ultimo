import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { hoy } from '../../caja/core/archivos';
import { PermisosService } from '../../core/services/permisos.service';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { ConceptoRetencion, Cooperativa } from '../core/models/cargas.model';
import { aNumero, formatoLey, numeroInvalido } from '../core/numeros';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { PreciosService } from '../core/services/precios.service';

/** Retenciones con su historial de tasas: la CNS general y los aportes por cooperativa. */
@Component({
  selector: 'app-retenciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputTextModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Retenciones</h2>
        <p class="subtitulo">Lo que la liquidación descuenta al productor. Una tasa nueva rige desde una fecha y cierra la anterior;
          no se cambian tasas de días pasados.</p>
      </div>
    </header>

    <section class="concepto" *ngFor="let c of conceptos()">
      <div class="cabeza">
        <div>
          <h3>{{ c.nombre }}</h3>
          <div class="secundario">{{ c.codigo }} · sobre el {{ c.base_calculo === 'VALOR_NETO' ? 'valor neto' : 'valor bruto' }}
            · {{ c.por_cooperativa ? 'tasa por cooperativa' : 'tasa general' }}{{ c.norma ? ' · ' + c.norma : '' }}</div>
        </div>
        <p-button *ngIf="puede()" label="Nueva tasa" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="nueva(c)" />
      </div>
      <table class="tasas" *ngIf="c.tasas.length; else sinTasas">
        <thead><tr><th *ngIf="c.por_cooperativa">Cooperativa</th><th class="derecha">Tasa</th><th>Vigencia</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let t of c.tasas" [class.inactiva]="!t.vigente && !t.proxima">
            <td *ngIf="c.por_cooperativa">{{ t.cooperativa?.nombre }}</td>
            <td class="derecha monto">{{ ley(t.porcentaje) }} %</td>
            <td>{{ t.vigente_desde | date: 'dd/MM/yyyy' }} → {{ t.vigente_hasta ? (t.vigente_hasta | date: 'dd/MM/yyyy') : 'sin cierre' }}</td>
            <td><span class="pastilla" [class.pastilla-ok]="t.vigente" [class.pastilla-acento]="t.proxima">
              {{ t.vigente ? 'Vigente' : t.proxima ? 'Próxima' : 'Anterior' }}</span></td>
          </tr>
        </tbody>
      </table>
      <ng-template #sinTasas><p class="secundario">Sin tasas registradas.</p></ng-template>
    </section>

    <p-dialog [(visible)]="visible" [header]="'Nueva tasa · ' + (concepto?.nombre ?? '')" [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <div class="campos">
        <div class="campo span-6" *ngIf="concepto?.por_cooperativa"><label>Cooperativa</label>
          <p-dropdown [options]="cooperativas()" [(ngModel)]="f.cooperativa_id" optionLabel="nombre" optionValue="id" [filter]="true"
                      filterBy="nombre" appendTo="body" placeholder="Elija la cooperativa" /></div>
        <div class="campo span-3"><label>Tasa (%)</label>
          <input pInputText inputmode="decimal" [(ngModel)]="f.porcentaje" [class.ng-invalid]="mal()" [class.ng-dirty]="mal()" /></div>
        <div class="campo span-3"><label>Rige desde</label><input pInputText type="date" [(ngModel)]="f.vigente_desde" /></div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="visible = false" />
        <p-button label="Registrar" icon="pi pi-check" [loading]="guardando()" [disabled]="!valido()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .concepto { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 1rem;
                background: var(--surface-card, #fff); }
    .cabeza { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 0.5rem; }
    .cabeza h3 { margin: 0; font-size: 0.98rem; }
    .tasas { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .tasas th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.3rem 0.4rem; }
    .tasas td { padding: 0.35rem 0.4rem; border-top: 1px solid var(--surface-border, #f1f5f9); }
    .derecha { text-align: right; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .pastilla-ok { background: #dcfce7; color: #166534; }
    tr.inactiva td { color: var(--text-color-secondary, #9ca3af); }
  `],
})
export class RetencionesComponent implements OnInit {
  private readonly servicio = inject(PreciosService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly permisos = inject(PermisosService);
  private readonly toast = inject(MessageService);

  readonly conceptos = signal<ConceptoRetencion[]>([]);
  readonly cooperativas = signal<Cooperativa[]>([]);
  readonly guardando = signal(false);
  visible = false;
  concepto: ConceptoRetencion | null = null;
  f = { cooperativa_id: null as number | null, porcentaje: '', vigente_desde: hoy() };

  ngOnInit(): void {
    this.catalogos.listarCooperativas(true).subscribe((c) => this.cooperativas.set(c));
    this.cargar();
  }

  cargar(): void {
    this.servicio.retenciones().subscribe({ next: (c) => this.conceptos.set(c), error: (e) => this.error('No se pudo cargar', e) });
  }

  puede(): boolean { return this.permisos.can('cargas.retenciones'); }
  ley(v: string): string { return formatoLey(v); }
  mal(): boolean { return numeroInvalido(this.f.porcentaje); }
  nueva(c: ConceptoRetencion): void { this.concepto = c; this.f = { cooperativa_id: null, porcentaje: '', vigente_desde: hoy() }; this.visible = true; }
  valido(): boolean {
    return aNumero(this.f.porcentaje) !== null && !!this.f.vigente_desde && (!this.concepto?.por_cooperativa || !!this.f.cooperativa_id);
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.publicarTasa({ concepto_id: this.concepto!.id, cooperativa_id: this.concepto!.por_cooperativa ? this.f.cooperativa_id : null,
                                 porcentaje: aNumero(this.f.porcentaje)!, vigente_desde: this.f.vigente_desde }).subscribe({
      next: (r) => { this.guardando.set(false); this.visible = false; this.toast.add({ severity: 'success', summary: r.mensaje }); this.cargar(); },
      error: (e) => { this.guardando.set(false); this.error('No se registró', e); },
    });
  }

  private error(t: string, e: unknown): void { this.toast.add({ severity: 'error', summary: t, detail: mensajeDeError(e), life: 10000 }); }
}
