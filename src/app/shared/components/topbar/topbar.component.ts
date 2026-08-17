import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { ContexteSelectorComponent } from '../contexte-selector/contexte-selector.component';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, RouterLinkActive, ContexteSelectorComponent],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  readonly authService = inject(AuthService);
  readonly contexteService = inject(ContexteService);
  private readonly router = inject(Router);

  readonly menuTresorerie = [
    { label: 'Tableau de bord trésorerie', vue: null },
    { label: 'Comptes bancaires', vue: 'comptes' },
    { label: 'Import relevés bancaires', vue: 'imports' },
    { label: 'Rapprochement bancaire', vue: 'rapprochements' },
    { label: 'Factures échéances', vue: 'factures-echeances' },
    { label: 'Balance âgée', vue: 'balance-agee' },
    { label: 'Prévisionnel trésorerie', vue: 'previsionnel' },
  ];

  readonly rolesPrincipaux = computed(() => this.contexteService.roles().slice(0, 3).join(', ') || '-');
  readonly tenantLabel = computed(() => this.contexteService.tenantNom() || `Tenant ${this.contexteService.tenantId() ?? '-'}`);
  readonly societeCouranteLabel = computed(() => {
    return this.contexteService.societeCouranteNom() || `Societe ${this.contexteService.societeCouranteId() ?? '-'}`;
  });

  deconnexion(): void {
    this.authService.deconnecter().subscribe({
      next: () => void this.router.navigateByUrl('/connexion'),
      error: () => void this.router.navigateByUrl('/connexion'),
    });
  }
}
