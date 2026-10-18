import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Banco } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/** Bancos para cheques y transferencias. Catálogo común: también lo usa caja. */
@Component({
  selector: 'app-bancos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
            TagModule, ToastModule, TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Bancos</h2>
        <p class="subtitulo">Para registrar pagos con cheque o transferencia, en caja y en anticipos.</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nuevo banco" icon="pi pi-plus" (onClick)="abrir(null)" />
      </div>
    </header>

    <p-table [value]="bancos()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr><th>Banco</th><th style="width: 7rem" class="centro">Estado</th><th style="width: 6rem"></th></tr>
      </ng-template>
      <ng-template pTemplate="body" let-b>
        <tr [class.inactiva]="!b.activo">
          <td>{{ b.nombre }}</td>
          <td class="centro"><p-tag [value]="b.activo ? 'Activo' : 'Inactivo'" [severity]="b.activo ? 'success' : 'secondary'" /></td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrir(b)" />
              <p-button [icon]="b.activo ? 'pi pi-ban' : 'pi pi-check'" [text]="true" [rounded]="true" size="small"
                        [severity]="b.activo ? 'danger' : 'success'" (onClick)="alternar(b)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="3"><div class="vacio"><i class="pi pi-building-columns"></i>
          <p class="titulo-vacio">Sin bancos registrados</p></div></td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar banco' : 'Nuevo banco'"
              [modal]="true" [style]="{ width: '26rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="60" placeholder="Banco Unión" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS],
})
export class BancosComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly bancos = signal<Banco[]>([]);
  readonly cargando = signal(false);
  readonly editando = signal<Banco | null>(null);
  dialogVisible = false;

  readonly form = this.fb.group({ nombre: ['', [Validators.required, Validators.maxLength(60)]] });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarBancos().subscribe({
      next: (b) => { this.bancos.set(b); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  abrir(b: Banco | null): void {
    this.editando.set(b);
    this.form.reset({ nombre: b?.nombre ?? '' });
    this.dialogVisible = true;
  }

  guardar(): void {
    const actual = this.editando();
    this.servicio.guardarBanco({ nombre: this.form.value.nombre!, activo: actual?.activo ?? true }, actual?.id).subscribe({
      next: () => { this.dialogVisible = false; this.toast.add({ severity: 'success', summary: 'Banco guardado' }); this.cargar(); },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 }),
    });
  }

  alternar(b: Banco): void {
    this.servicio.guardarBanco({ nombre: b.nombre, activo: !b.activo }, b.id).subscribe({
      next: () => this.cargar(),
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se guardó', detail: mensajeDeError(e) }),
    });
  }
}
