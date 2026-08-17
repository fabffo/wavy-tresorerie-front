import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  BalanceAgee,
  CompteBancaire,
  CompteBancairePayload,
  DashboardTresorerie,
  FactureEcheance,
  FiltresEcheances,
  KpiEcheances,
  FactureCandidateRapprochement,
  LigneRapprochementManuelPayload,
  ImportReleve,
  ImportReleveResultat,
  FiltresOperations,
  NatureOperationBancaire,
  OperationBancaire,
  OperationBancairePayload,
  PageResponse,
  PieceRapprochement,
  ParametresListeOperations,
  RapprochementBancaire,
  RapprochementFacturesResultat,
  RapprochementManuelResultat,
  RapprochementPropositionsResultat,
  RegleRapprochement,
} from '../../features/tresorerie/models/tresorerie.model';

@Injectable({ providedIn: 'root' })
export class TresorerieApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/tresorerie`;

  dashboard() {
    return this.http.get<DashboardTresorerie>(`${this.baseUrl}/dashboard`);
  }

  comptes() {
    return this.http.get<CompteBancaire[]>(`${this.baseUrl}/comptes-bancaires`);
  }

  compte(id: number) {
    return this.http.get<CompteBancaire>(`${this.baseUrl}/comptes-bancaires/${id}`);
  }

  creerCompte(payload: CompteBancairePayload) {
    return this.http.post<CompteBancaire>(`${this.baseUrl}/comptes-bancaires`, payload);
  }

  modifierCompte(id: number, payload: CompteBancairePayload) {
    return this.http.put<CompteBancaire>(`${this.baseUrl}/comptes-bancaires/${id}`, payload);
  }

  desactiverCompte(id: number) {
    return this.http.delete<void>(`${this.baseUrl}/comptes-bancaires/${id}`);
  }

  operations(filtres?: FiltresOperations, parametres?: ParametresListeOperations) {
    let params = new HttpParams();
    Object.entries(filtres ?? {}).forEach(([cle, valeur]) => {
      if (valeur) {
        params = params.set(cle, String(valeur));
      }
    });
    if (parametres) {
      params = params
        .set('page', String(parametres.page))
        .set('size', String(parametres.size))
        .set('sortBy', parametres.sortBy)
        .set('sortDirection', parametres.sortDirection);
    }
    return this.http.get<PageResponse<OperationBancaire>>(`${this.baseUrl}/operations-bancaires`, { params });
  }

  operation(id: number) {
    return this.http.get<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${id}`);
  }

  creerOperation(payload: OperationBancairePayload) {
    return this.http.post<OperationBancaire>(`${this.baseUrl}/operations-bancaires`, payload);
  }

  modifierOperationBancaire(id: number, payload: OperationBancairePayload) {
    return this.http.put<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${id}`, payload);
  }

  supprimerOperation(id: number) {
    return this.http.delete<void>(`${this.baseUrl}/operations-bancaires/${id}`);
  }

  modifierClassificationOperation(id: number, natureOperation: NatureOperationBancaire) {
    return this.http.patch<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${id}/classification`, { natureOperation });
  }

  retraiterOperation(id: number) {
    return this.http.post<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${id}/retraiter`, {});
  }

  retraiterOperationsNonRapprochees() {
    return this.http.post<{ nombreOperations: number }>(`${this.baseUrl}/operations-bancaires/retraiter-non-rapprochees`, {});
  }

  calculerNomTiersOperationsNonRapprochees() {
    return this.http.post<{ nombreOperations: number }>(`${this.baseUrl}/operations-bancaires/calcul-nom-tiers`, {});
  }

  rapprocherFactures() {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-factures`, {});
  }

  rapprocherSalaires() {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-salaires`, {});
  }

  rapprocherNotesFrais() {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-notes-frais`, {});
  }

  creerPieceRapprochement(operationId: number) {
    return this.http.post<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${operationId}/piece-rapprochement`, {});
  }

  rapprocherFacture(operationId: number) {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/${operationId}/rapprochement-factures`, {});
  }

  rapprocherNoteFrais(operationId: number) {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/${operationId}/rapprochement-note-frais`, {});
  }

  facturesCandidates(operationId: number) {
    return this.http.get<FactureCandidateRapprochement[]>(`${this.baseUrl}/operations-bancaires/${operationId}/factures-candidates`);
  }

  rapprocherManuellement(operationId: number, lignes: LigneRapprochementManuelPayload[]) {
    return this.http.post<RapprochementManuelResultat>(
      `${this.baseUrl}/operations-bancaires/${operationId}/rapprochements-manuels`,
      { lignes },
    );
  }

  retraiterImport(id: number) {
    return this.http.post<{ nombreOperations: number }>(`${this.baseUrl}/import-releves/${id}/retraiter`, {});
  }

  imports() {
    return this.http.get<ImportReleve[]>(`${this.baseUrl}/import-releves`);
  }

  importerReleve(compteBancaireId: number, fichier: File) {
    const formData = new FormData();
    formData.append('compteBancaireId', String(compteBancaireId));
    formData.append('fichier', fichier);
    return this.http.post<ImportReleveResultat>(`${this.baseUrl}/import-releves`, formData);
  }

  rapprochements() {
    return this.http.get<RapprochementBancaire[]>(`${this.baseUrl}/rapprochements-bancaires`);
  }

  piecesRapprochement() {
    return this.http.get<PieceRapprochement[]>(`${this.baseUrl}/pieces-rapprochement`);
  }

  validerRapprochement(id: number) {
    return this.http.post<RapprochementBancaire>(`${this.baseUrl}/rapprochements-bancaires/${id}/valider`, {});
  }

  annulerRapprochement(id: number) {
    return this.http.post<RapprochementBancaire>(`${this.baseUrl}/rapprochements-bancaires/${id}/annuler`, {});
  }

  validerRapprochementsProposes() {
    return this.http.post<RapprochementPropositionsResultat>(`${this.baseUrl}/rapprochements-bancaires/valider-proposes`, {});
  }

  annulerRapprochementsProposes() {
    return this.http.post<RapprochementPropositionsResultat>(`${this.baseUrl}/rapprochements-bancaires/annuler-proposes`, {});
  }

  regles() {
    return this.http.get<RegleRapprochement[]>(`${this.baseUrl}/regles-rapprochement`);
  }

  facturesEcheances(filtres: FiltresEcheances) {
    let params = new HttpParams();
    Object.entries(filtres).forEach(([cle, valeur]) => {
      if (valeur !== undefined && valeur !== null && valeur !== '') params = params.set(cle, String(valeur));
    });
    return this.http.get<PageResponse<FactureEcheance>>(`${this.baseUrl}/factures-echeances`, { params });
  }

  kpisFacturesEcheances() {
    return this.http.get<KpiEcheances>(`${this.baseUrl}/factures-echeances/kpis`);
  }

  balanceAgee() {
    return this.http.get<BalanceAgee>(`${this.baseUrl}/balance-agee`);
  }
}
