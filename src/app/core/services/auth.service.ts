import { Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';

import { ContexteService, ContexteUtilisateur } from './contexte.service';
import { ProfilUtilisateur, SocleApiService } from './socle-api.service';

export interface AuthSession {
  profil: ProfilUtilisateur;
  contexte: ContexteUtilisateur;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profilStorageKey = 'wavy-tresorerie-profil';
  private readonly legacyCredentialsStorageKey = 'wavy-tresorerie-auth';

  readonly authenticatedUser = signal<string | null>(this.readStoredProfil()?.email ?? null);
  readonly profil = signal<ProfilUtilisateur | null>(this.readStoredProfil());
  readonly sessionVerifiee = signal(false);

  constructor(
    private readonly socleApiService: SocleApiService,
    private readonly contexteService: ContexteService,
  ) {}

  testerConnexion(email: string, motDePasse: string): Observable<AuthSession> {
    this.viderLocal();

    return this.socleApiService.creerSession(email, motDePasse).pipe(
      switchMap(() => this.chargerProfilSession()),
      tap({
        error: () => this.viderLocal(),
      }),
    );
  }

  restaurerSession(): Observable<AuthSession | null> {
    return this.socleApiService.lireSession().pipe(
      switchMap(() => this.chargerProfilSession()),
      map((session) => session as AuthSession | null),
      catchError(() => {
        this.viderLocal();
        return of(null);
      }),
      tap(() => this.sessionVerifiee.set(true)),
    );
  }

  deconnecter(): Observable<void> {
    return this.socleApiService.supprimerSession().pipe(
      catchError(() => of(undefined)),
      tap(() => this.viderLocal()),
    );
  }

  clear(): void {
    this.viderLocal();
  }

  private chargerProfilSession(): Observable<AuthSession> {
    return this.socleApiService.chargerProfil().pipe(
      map((profil) => {
        const contexte = this.contexteService.definirDepuisProfil(profil);
        this.setProfil(profil);
        return { profil, contexte };
      }),
    );
  }

  private setProfil(profil: ProfilUtilisateur): void {
    this.profil.set(profil);
    this.authenticatedUser.set(profil.email);
    localStorage.setItem(this.profilStorageKey, JSON.stringify(profil));
  }

  private viderLocal(): void {
    this.authenticatedUser.set(null);
    this.profil.set(null);
    localStorage.removeItem(this.profilStorageKey);
    localStorage.removeItem(this.legacyCredentialsStorageKey);
    this.contexteService.vider();
  }

  private readStoredProfil(): ProfilUtilisateur | null {
    const raw = localStorage.getItem(this.profilStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ProfilUtilisateur;
    } catch {
      localStorage.removeItem(this.profilStorageKey);
      return null;
    }
  }
}
