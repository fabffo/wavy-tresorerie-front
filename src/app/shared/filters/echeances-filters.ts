import { FiltresEcheances } from '../../features/tresorerie/models/tresorerie.model';

export const CLE_FILTRES_ECHEANCES = 'wavy.tresorerie.echeances.filters';
export function restaurerFiltresEcheances(stockage: Pick<Storage, 'getItem'>, maintenant = new Date()): FiltresEcheances {
  const defaults: FiltresEcheances = { dateDebut: `${maintenant.getFullYear()}-01-01`, page: 0, size: 25, sort: 'dateEcheance,asc' };
  try {
    const saved = JSON.parse(stockage.getItem(CLE_FILTRES_ECHEANCES) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults;
    return { ...defaults, ...saved };
  } catch { return defaults; }
}
export function memoriserFiltresEcheances(stockage: Pick<Storage, 'setItem'>, filtres: FiltresEcheances): void {
  stockage.setItem(CLE_FILTRES_ECHEANCES, JSON.stringify({ ...filtres, dateDebut: filtres.dateDebut || '', dateFin: filtres.dateFin || '' }));
}
