import { restaurerFiltresEcheances, memoriserFiltresEcheances } from './echeances-filters';

describe('Recherche des échéances', () => {
  beforeEach(() => sessionStorage.clear());
  it('initialise le 1er janvier local et aucune fin, y compris au changement d’année', () => {
    expect(restaurerFiltresEcheances(sessionStorage, new Date(2026, 11, 31, 23, 59)).dateDebut).toBe('2026-01-01');
    const f = restaurerFiltresEcheances(sessionStorage, new Date(2027, 0, 1, 0, 1));
    expect(f.dateDebut).toBe('2027-01-01');
    expect(f.dateFin).toBeUndefined();
  });
  it('conserve les dates volontairement vides et les autres filtres au retour', () => {
    memoriserFiltresEcheances(sessionStorage, { dateDebut: undefined, dateFin: undefined, tiersId: 42, page: 0, size: 25, sort: 'dateEcheance,asc' });
    expect(restaurerFiltresEcheances(sessionStorage)).toMatchObject({ dateDebut: '', dateFin: '', tiersId: 42 });
  });
  it('conserve une fin explicitement choisie dans une année future', () => {
    memoriserFiltresEcheances(sessionStorage, { dateDebut: '2025-01-01', dateFin: '2030-05-05', page: 0, size: 25, sort: 'dateEcheance,asc' });
    expect(restaurerFiltresEcheances(sessionStorage, new Date(2027, 0, 1))).toMatchObject({ dateDebut: '2025-01-01', dateFin: '2030-05-05' });
  });
});
