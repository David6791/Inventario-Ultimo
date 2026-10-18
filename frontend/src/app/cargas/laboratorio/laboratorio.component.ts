import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { FilaBandeja } from '../core/models/cargas.model';
import { LaboratorioService } from '../core/services/laboratorio.service';

/** Bandeja del laboratorio: lotes por muestrear y en análisis, con lo que le falta a cada uno. */
@Component({
  selector: 'app-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule, TableModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Laboratorio</h2>
        <p class="subtitulo">Lotes por muestrear y en análisis. Toque un lote para registrar la muestra, cargar los análisis o fijar la ley.</p>
      </div>
    </header>

    <div class="barra">
      <p-selectButton [options]="vistas()" [(ngModel)]="vista" optionLabel="etiqueta" optionValue="valor" />
    </div>

    <p-table [value]="visibles()" [loading]="cargando()" dataKey="lote_id" styleClass="p-datatable-sm tabla"
             selectionMode="single" (onRowSelect)="abrir($event.data)">
      <ng-template pTemplate="header">
        <tr><th style="width: 11rem">Lote</th><th style="width: 8rem">Recibido</th><th>Productor</th><th style="width: 12rem">Muestra</th>
            <th>Análisis</th><th style="width: 8rem">Leyes</th><th style="width: 13rem">Siguiente paso</th></tr>
      </ng-template>
      <ng-template pTemplate="body" let-f>
        <tr [pSelectableRow]="f" class="fila">
          <td><span class="codigo">{{ f.codigo }}</span><div class="secundario">{{ f.material }}</div></td>
          <td>{{ f.fecha_recepcion | date: 'dd/MM/yy HH:mm' }}</td>
          <td>{{ f.productor ?? 'Producción propia' }}<div class="secundario">{{ f.linea }}</div></td>
          <td><span class="codigo">{{ f.muestra ?? '—' }}</span></td>
          <td *ngIf="f.estado === 'RECIBIDO'"><span class="secundario">—</span></td>
          <td *ngIf="f.estado !== 'RECIBIDO'">
            <span class="pastilla" [class.pastilla-ok]="f.con_empresa">Empresa</span>
            <span class="pastilla" [class.pastilla-ok]="f.con_productor">Productor</span>
            <span class="pastilla" *ngIf="f.requiere_dirimencia || f.con_dirimente" [class.pastilla-ok]="f.con_dirimente"
                  [class.pastilla-aviso]="f.requiere_dirimencia">Dirimente</span>
          </td>
          <td class="contador">{{ f.leyes_fijadas }} / {{ f.leyes_requeridas }}</td>
          <td><span [class.alerta]="f.requiere_dirimencia">{{ paso(f) }}</span></td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7"><div class="vacio"><i class="pi pi-check-circle"></i><div class="titulo-vacio">Nada pendiente en laboratorio</div></div></td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [ESTILOS_CARGAS, `
    .fila { cursor: pointer; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .pastilla { margin-right: 0.25rem; }
    .pastilla-ok { background: #dcfce7; color: #166534; }
    .alerta { color: #b45309; font-weight: 600; }
  `],
})
export class LaboratorioComponent implements OnInit {
  private readonly servicio = inject(LaboratorioService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  readonly filas = signal<FilaBandeja[]>([]);
  readonly cargando = signal(true);
  vista: 'TODOS' | 'RECIBIDO' | 'MUESTREADO' = 'TODOS';

  readonly vistas = computed(() => {
    const n = (e: string) => this.filas().filter((f) => f.estado === e).length;
    return [
      { valor: 'TODOS', etiqueta: `Todos (${this.filas().length})` },
      { valor: 'RECIBIDO', etiqueta: `Por muestrear (${n('RECIBIDO')})` },
      { valor: 'MUESTREADO', etiqueta: `En análisis (${n('MUESTREADO')})` },
    ];
  });

  visibles(): FilaBandeja[] { return this.vista === 'TODOS' ? this.filas() : this.filas().filter((f) => f.estado === this.vista); }

  ngOnInit(): void {
    this.servicio.bandeja().subscribe({
      next: (f) => { this.filas.set(f); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la bandeja', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  paso(f: FilaBandeja): string {
    if (f.estado === 'RECIBIDO') return 'Registrar la muestra';
    if (!f.con_empresa || !f.con_productor) return `Cargar análisis ${!f.con_empresa ? 'de la empresa' : 'del productor'}`;
    if (f.requiere_dirimencia) return 'Va a dirimencia';
    if (f.leyes_fijadas < f.leyes_requeridas) return 'Fijar la ley final';
    return 'Cerrar el análisis';
  }

  abrir(f: FilaBandeja): void { this.router.navigate(['/cargas/lotes', f.lote_id]); }
}
