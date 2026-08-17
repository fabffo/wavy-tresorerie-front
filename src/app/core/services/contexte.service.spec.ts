import { ContexteService } from './contexte.service';

describe('ContexteService', () => {
  let service: ContexteService;

  beforeEach(() => {
    localStorage.clear();
    service = new ContexteService();
    service.definirDepuisProfil({
      email: 'user@example.test',
      nom: 'Martin',
      prenom: 'Claire',
      roles: ['USER'],
      societeCouranteId: 4,
      societeCouranteNom: 'Démo Services SAS',
      societesAutorisees: [
        { id: 4, nom: 'Démo Services SAS' },
        { id: 5, nom: 'Démo Immobilier SAS' },
      ],
      tenantId: 3,
      tenantNom: 'Démo',
      utilisateurId: 6,
    });
  });

  it('met a jour la societe courante et son nom', () => {
    service.changerSocieteCourante(5);

    expect(service.societeCouranteId()).toBe(5);
    expect(service.societeCouranteNom()).toBe('Démo Immobilier SAS');
  });

  it('retourne le contexte courant pour les requetes apres changement', () => {
    service.changerSocieteCourante(5);

    expect(service.contextePourRequete()?.societeCouranteId).toBe(5);
  });

  it('sauvegarde le contexte complet avec la nouvelle societe', () => {
    service.changerSocieteCourante(5);

    const stored = JSON.parse(localStorage.getItem('wavy-tresorerie-contexte') ?? '{}') as { societeCouranteId?: number };
    expect(stored.societeCouranteId).toBe(5);
  });

  it('applique et signale un changement de société reçu du Shell', () => {
    service.definirDepuisShell({ ...service.contexteCourant()!, societeCouranteId: 5, societeCouranteNom: 'Démo Immobilier SAS' });
    expect(service.societeCouranteId()).toBe(5);
    expect(service.changementSociete()).toBe(1);
    expect(localStorage.getItem('wavy-tresorerie-societe-courante-id')).toBe('5');
  });
});
