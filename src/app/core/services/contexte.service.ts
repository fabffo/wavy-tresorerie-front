import { computed, Injectable, signal } from '@angular/core';

import { ProfilUtilisateur } from './socle-api.service';

export interface SocieteAutorisee {
  id: number;
  nom: string;
  [key: string]: unknown;
}

export interface ContexteUtilisateur {
  utilisateurId: number;
  email: string;
  nom: string;
  prenom: string;
  tenantId: number;
  tenantNom: string;
  societeCouranteId: number;
  societeCouranteNom: string;
  societesAutorisees: SocieteAutorisee[];
  roles: string[];
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ContexteService {
  private readonly storageKey = 'wavy-tresorerie-contexte';
  private readonly societeCouranteStorageKey = 'wavy-tresorerie-societe-courante-id';
  private readonly contexte = signal<ContexteUtilisateur | null>(this.readStoredContexte());

  readonly contexteCourant = this.contexte.asReadonly();
  readonly contexteCharge = computed(() => this.contexte() !== null);
  readonly utilisateurId = computed(() => this.contexte()?.utilisateurId ?? null);
  readonly email = computed(() => this.contexte()?.email ?? null);
  readonly nom = computed(() => this.contexte()?.nom ?? null);
  readonly prenom = computed(() => this.contexte()?.prenom ?? null);
  readonly tenantId = computed(() => this.contexte()?.tenantId ?? null);
  readonly tenantNom = computed(() => this.contexte()?.tenantNom ?? null);
  readonly societeCouranteId = computed(() => this.contexte()?.societeCouranteId ?? null);
  readonly societeCouranteNom = computed(() => this.contexte()?.societeCouranteNom ?? null);
  readonly societesAutorisees = computed(() => this.contexte()?.societesAutorisees ?? []);
  readonly roles = computed(() => this.contexte()?.roles ?? []);
  private readonly changementSocieteVersion = signal(0);
  readonly changementSociete = this.changementSocieteVersion.asReadonly();

  definirDepuisProfil(profil: ProfilUtilisateur): ContexteUtilisateur {
    const contexte: ContexteUtilisateur = {
      ...profil,
      utilisateurId: Number(profil.utilisateurId),
      tenantId: Number(profil.tenantId),
      societeCouranteId: Number(profil.societeCouranteId),
      societesAutorisees: profil.societesAutorisees.map((societe) => ({
        ...societe,
        id: Number(societe.id),
        nom: societe.nom,
      })),
      roles: profil.roles ?? [],
    };

    this.definirContexte(contexte);
    return this.contexte() ?? contexte;
  }

  changerSocieteCourante(societeCouranteId: number): void {
    const contexte = this.contexte();
    const societe = contexte?.societesAutorisees.find((item) => item.id === societeCouranteId);
    if (!contexte || !societe) {
      return;
    }

    const prochainContexte = {
      ...contexte,
      societeCouranteId,
      societeCouranteNom: societe.nom,
    };

    this.contexte.set(prochainContexte);
    this.sauvegarderContexte(prochainContexte);
    this.changementSocieteVersion.update((version) => version + 1);
  }

  definirDepuisShell(contexte: ContexteUtilisateur): void {
    const societePrecedente = this.societeCouranteId();
    this.contexte.set(contexte);
    this.sauvegarderContexte(contexte);
    if (societePrecedente !== null && societePrecedente !== contexte.societeCouranteId) {
      this.changementSocieteVersion.update((version) => version + 1);
    }
  }

  contextePourRequete(): ContexteUtilisateur | null {
    return this.contexte();
  }

  vider(): void {
    this.contexte.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.societeCouranteStorageKey);
  }

  libelleSociete(societe: SocieteAutorisee): string {
    return societe.nom || `Societe ${societe.id}`;
  }

  private definirContexte(contexte: ContexteUtilisateur): void {
    const societeCouranteId = this.resolveSocieteCouranteId(contexte);
    const societeCourante = contexte.societesAutorisees.find((societe) => societe.id === societeCouranteId);
    const prochainContexte = {
      ...contexte,
      societeCouranteId,
      societeCouranteNom: societeCourante?.nom ?? contexte.societeCouranteNom,
    };

    this.contexte.set(prochainContexte);
    this.sauvegarderContexte(prochainContexte);
  }

  private sauvegarderContexte(contexte: ContexteUtilisateur): void {
    localStorage.setItem(this.storageKey, JSON.stringify(contexte));
    localStorage.setItem(this.societeCouranteStorageKey, String(contexte.societeCouranteId));
  }

  private resolveSocieteCouranteId(contexte: ContexteUtilisateur): number {
    const storedSocieteId = Number(localStorage.getItem(this.societeCouranteStorageKey));
    if (storedSocieteId && contexte.societesAutorisees.some((societe) => societe.id === storedSocieteId)) {
      return storedSocieteId;
    }

    if (contexte.societesAutorisees.some((societe) => societe.id === contexte.societeCouranteId)) {
      return contexte.societeCouranteId;
    }

    return contexte.societesAutorisees[0]?.id ?? contexte.societeCouranteId;
  }

  private readStoredContexte(): ContexteUtilisateur | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ContexteUtilisateur>;
      if (parsed.tenantId && parsed.utilisateurId && parsed.societeCouranteId && parsed.email) {
        return {
          ...parsed,
          utilisateurId: Number(parsed.utilisateurId),
          email: parsed.email,
          nom: parsed.nom ?? '',
          prenom: parsed.prenom ?? '',
          tenantId: Number(parsed.tenantId),
          tenantNom: parsed.tenantNom ?? '',
          societeCouranteId: Number(parsed.societeCouranteId),
          societeCouranteNom: parsed.societeCouranteNom ?? '',
          societesAutorisees: parsed.societesAutorisees ?? [],
          roles: parsed.roles ?? [],
        };
      }
    } catch {
      localStorage.removeItem(this.storageKey);
    }

    return null;
  }
}
