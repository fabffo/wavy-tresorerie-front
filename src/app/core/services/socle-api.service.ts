import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ProfilSocieteAutorisee {
  id: number;
  nom: string;
}

export interface ProfilUtilisateur {
  email: string;
  nom: string;
  prenom: string;
  roles: string[];
  societeCouranteId: number;
  societeCouranteNom: string;
  societesAutorisees: ProfilSocieteAutorisee[];
  tenantId: number;
  tenantNom: string;
  utilisateurId: number;
  [key: string]: unknown;
}

export interface SessionUtilisateur {
  email?: string;
  authentifie?: boolean;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class SocleApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api`;

  constructor(private readonly http: HttpClient) {}

  creerSession(email: string, motDePasse: string): Observable<SessionUtilisateur> {
    return this.http.post<SessionUtilisateur>(
      `${this.baseUrl}/auth/session`,
      { email, motDePasse },
      { withCredentials: true },
    );
  }

  lireSession(): Observable<SessionUtilisateur> {
    return this.http.get<SessionUtilisateur>(`${this.baseUrl}/auth/session`, { withCredentials: true });
  }

  supprimerSession(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/auth/session`, { withCredentials: true });
  }

  chargerProfil(): Observable<ProfilUtilisateur> {
    return this.http.get<ProfilUtilisateur>(`${this.baseUrl}/profil`, { withCredentials: true });
  }
}
