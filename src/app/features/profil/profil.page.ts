import { Component, inject, OnInit, signal } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { ContexteService } from '../../core/services/contexte.service';
import { ProfilUtilisateur, SocleApiService } from '../../core/services/socle-api.service';
import { getHttpErrorMessage } from '../../shared/http/http-error-message';

@Component({
  selector: 'app-profil-page',
  templateUrl: './profil.page.html',
})
export class ProfilPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly contexteService = inject(ContexteService);
  private readonly socleApiService = inject(SocleApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly profil = signal<ProfilUtilisateur | null>(this.authService.profil());

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

    this.socleApiService.chargerProfil().subscribe({
      next: (profil) => {
        this.profil.set(profil);
        this.contexteService.definirDepuisProfil(profil);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(getHttpErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}
