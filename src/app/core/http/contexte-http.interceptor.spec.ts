import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ContexteService } from '../services/contexte.service';
import { contexteHttpInterceptor } from './contexte-http.interceptor';

describe('contexteHttpInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([contexteHttpInterceptor])), provideHttpClientTesting()],
    });

    const contexteService = TestBed.inject(ContexteService);
    contexteService.definirDepuisProfil({
      email: 'user@example.test',
      nom: 'Martin',
      prenom: 'Claire',
      roles: ['ADMIN_TENANT', 'GESTIONNAIRE'],
      societeCouranteId: 4,
      societeCouranteNom: 'Demo Services SAS',
      societesAutorisees: [
        { id: 4, nom: 'Demo Services SAS' },
        { id: 5, nom: 'Demo Immobilier SAS' },
      ],
      tenantId: 3,
      tenantNom: 'Demo',
      utilisateurId: 6,
    });
    contexteService.changerSocieteCourante(5);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ajoute les headers contexte et roles sur /api/tresorerie', () => {
    TestBed.inject(HttpClient).get('http://localhost:8088/api/tresorerie/dashboard').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:8088/api/tresorerie/dashboard');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('3');
    expect(request.request.headers.get('X-Utilisateur-Id')).toBe('6');
    expect(request.request.headers.get('X-Societe-Courante-Id')).toBe('5');
    expect(request.request.headers.get('X-Wavy-Roles')).toBe('ADMIN_TENANT,GESTIONNAIRE');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('ajoute les headers contexte sur /api/parametres', () => {
    TestBed.inject(HttpClient).get('http://localhost:8088/api/parametres/options?categorie=FONCTION_PERSONNE').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:8088/api/parametres/options?categorie=FONCTION_PERSONNE');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('3');
    expect(request.request.headers.get('X-Utilisateur-Id')).toBe('6');
    expect(request.request.headers.get('X-Societe-Courante-Id')).toBe('5');
    expect(request.request.headers.get('X-Wavy-Roles')).toBe('ADMIN_TENANT,GESTIONNAIRE');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('n ajoute pas les headers contexte sur auth session et profil', () => {
    const http = TestBed.inject(HttpClient);
    http.get('http://localhost:8088/api/auth/session').subscribe();
    http.get('http://localhost:8088/api/profil').subscribe();

    const auth = TestBed.inject(HttpTestingController).expectOne('http://localhost:8088/api/auth/session');
    const profil = TestBed.inject(HttpTestingController).expectOne('http://localhost:8088/api/profil');
    expect(auth.request.headers.has('X-Tenant-Id')).toBe(false);
    expect(profil.request.headers.has('X-Tenant-Id')).toBe(false);
    auth.flush({});
    profil.flush({});
  });
});
