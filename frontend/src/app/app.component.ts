import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

/**
 * Raíz de la aplicación. Solo enruta.
 *
 * El toast y el diálogo de confirmación se declaran acá para que estén
 * disponibles también en las pantallas que viven fuera del shell (login,
 * cambio de contraseña, sin permiso).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <p-toast position="top-right" />
    <p-confirmDialog />
    <router-outlet />
  `,
})
export class AppComponent {}
