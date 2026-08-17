import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { ContexteService } from './contexte.service';
import { SocleApiService } from './socle-api.service';

describe('AuthService', () => {
  let service: AuthService;
  let socleApiService: Pick<SocleApiService, 'creerSession' | 'lireSession' | 'chargerProfil' | 'supprimerSession'>;

  const profil = {
    email: 'user@example.test',
    nom: 'Martin',
    prenom: 'Claire',
    roles: ['USER'],
    societeCouranteId: 4,
    societeCouranteNom: 'Demo Services SAS',
    societesAutorisees: [{ id: 4, nom: 'Demo Services SAS' }],
    tenantId: 3,
    tenantNom: 'Demo',
    utilisateurId: 6,
  };

  beforeEach(() => {
    localStorage.clear();
    socleApiService = {
      creerSession: vi.fn().mockReturnValue(of({ authentifie: true })),
      lireSession: vi.fn().mockReturnValue(of({ authentifie: true })),
      chargerProfil: vi.fn().mockReturnValue(of(profil)),
      supprimerSession: vi.fn().mockReturnValue(of(undefined)),
    };
    service = new AuthService(socleApiService as SocleApiService, new ContexteService());
  });

  it('cree une session puis charge le profil', () => {
    service.testerConnexion('user@example.test', 'secret').subscribe((session) => {
      expect(session.profil.email).toBe('user@example.test');
    });
    expect(socleApiService.creerSession).toHaveBeenCalledWith('user@example.test', 'secret');
    expect(socleApiService.chargerProfil).toHaveBeenCalled();
  });

  it('restaure une session existante', () => {
    service.restaurerSession().subscribe((session) => {
      expect(session?.profil.email).toBe('user@example.test');
    });
    expect(socleApiService.lireSession).toHaveBeenCalled();
  });

  it('detruit la session sans stocker le mot de passe', () => {
    service.testerConnexion('user@example.test', 'secret').subscribe();
    service.deconnecter().subscribe();
    expect(socleApiService.supprimerSession).toHaveBeenCalled();
    expect(localStorage.getItem('wavy-contrats-auth')).toBeNull();
  });
});
