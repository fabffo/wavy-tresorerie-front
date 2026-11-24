import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PropositionsCarteResultat, TiersIdentification, CreationTiersIdentification, RegleBancaireIdentification,
  EtapeAssistant, PerimetreAssistant, ApercuAssistant, ConfirmationAssistant, BilanAssistant, TiersAssistant,
  ConfirmationCartePayload,
  ConfirmationCartesPayload,
  ConfirmationCartesResultat,
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
  FiltresOperations, CompteursOperations, DetailOperation,
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

  private parametresFiltres(filtres: FiltresOperations = {}, params = new HttpParams()): HttpParams {
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (Array.isArray(valeur)) {
        for (const element of valeur) params = params.append(cle, String(element));
      } else if (valeur !== undefined && valeur !== '') {
        params = params.set(cle, String(valeur));
      }
    }
    return params;
  }

  operations(filtres?: FiltresOperations, parametres?: ParametresListeOperations) {
    let params = this.parametresFiltres(filtres);
    if (parametres) {
      params = params
        .set('page', String(parametres.page))
        .set('size', String(parametres.size))
        .set('sortBy', parametres.sortBy)
        .set('sortDirection', parametres.sortDirection);
    }
    return this.http.get<PageResponse<OperationBancaire>>(`${this.baseUrl}/operations-bancaires`, { params });
  }

  compteursOperations(filtres: FiltresOperations) {
    const params = this.parametresFiltres(filtres);
    return this.http.get<CompteursOperations>(`${this.baseUrl}/operations-bancaires/compteurs`, { params });
  }

  consulterOperation(id: number) {
    return this.http.get<DetailOperation>(`${this.baseUrl}/operations-bancaires/${id}/detail`);
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

  obtenirTiersAssistant(id: number) {
    return this.http.get<{id:number;roles:string[];raisonSociale?:string;nom?:string;prenom?:string;nomNormalise?:string;actif?:boolean}>(`${environment.apiBaseUrl}/api/tiers/${id}`).pipe(map(t => ({
      id:t.id,roles:t.roles ?? [],libelle:t.raisonSociale || [t.prenom,t.nom].filter(Boolean).join(' ') || t.nomNormalise || `Tiers ${t.id}`,score:1,actif:t.actif,
    } as TiersAssistant)));
  }

  previsualiserAssistant(etape: EtapeAssistant, categorie: string, perimetre: PerimetreAssistant) {
    const params = this.parametresFiltres(perimetre, new HttpParams().set('etape', etape).set('categorie', categorie));
    return this.http.get<ApercuAssistant>(`${this.baseUrl}/operations-bancaires/assistant`, { params });
  }

  confirmerAssistant(demande: ConfirmationAssistant) {
    return this.http.post<BilanAssistant>(`${this.baseUrl}/operations-bancaires/assistant/confirmer`, demande);
  }

  rechercherTiersAssistant(query: string) {
    return this.http.get<TiersAssistant[]>(`${environment.apiBaseUrl}/api/tiers/search`, {
      params: new HttpParams().set('query', query).set('actif', 'true'),
    });
  }

  lireTiersIdentification(id:number) {
    return this.http.get<TiersIdentification>(`${environment.apiBaseUrl}/api/tiers/${id}`);
  }
  listerTiersIdentification(recherche:string) {
    return this.http.get<TiersIdentification[]>(`${environment.apiBaseUrl}/api/tiers`,{params:new HttpParams().set('recherche',recherche)});
  }
  creerTiersIdentification(demande:CreationTiersIdentification) {
    return this.http.post<TiersIdentification>(`${environment.apiBaseUrl}/api/tiers`,demande);
  }
  naturesIdentification(type: 'organisation' | 'personne') {
    return this.http.get<string[]>(`${environment.apiBaseUrl}/api/tiers/referentiels/natures-${type}`);
  }

  rolesIdentification() {return this.http.get<string[]>(`${environment.apiBaseUrl}/api/tiers/referentiels/roles`);}
  reglesIdentification() {
    return this.http.get<RegleBancaireIdentification[]>(`${environment.apiBaseUrl}/api/factures/achats/rapprochement-fournisseurs/regles`,{params:new HttpParams().set('typeRegle','OPERATION_BANCAIRE')});
  }
  enregistrerRegleIdentification(tiersId:number,motif:string) {
    return this.http.post<RegleBancaireIdentification>(`${environment.apiBaseUrl}/api/factures/achats/rapprochement-fournisseurs/regles`,{
      tiersId,libelle:motif,motif,typeRegle:'OPERATION_BANCAIRE',typeMotif:'CONTIENT',scorePriorite:100,actif:true,
    });
  }

  proposerCartes() {
    return this.http.get<PropositionsCarteResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-cartes`);
  }

  confirmerCartes(demande: ConfirmationCartesPayload) {
    return this.http.post<ConfirmationCartesResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-cartes/confirmer`, demande);
  }

  confirmerCarte(operationId: number, demande: ConfirmationCartePayload) {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/${operationId}/rapprochement-carte`, demande);
  }

  rapprocherNotesFrais() {
    return this.http.post<RapprochementFacturesResultat>(`${this.baseUrl}/operations-bancaires/rapprochement-notes-frais`, {});
  }

  creerPieceRapprochement(operationId: number) {
    return this.http.post<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${operationId}/piece-rapprochement`, {});
  }

  rapprocherExerciceAnterieur(operationId: number, demande: {
    tiersId: number; montantDisponible: number; exerciceReference: number; motif: string; confirmation: boolean;
  }) {
    return this.http.post<RapprochementBancaire>(`${this.baseUrl}/operations-bancaires/${operationId}/rapprochement-exercice-anterieur`, demande);
  }

  rapprocherParDefaut(operationId: number, demande: {
    tiersId: number; montantDisponible: number; libelle: string; confirmation: boolean; motifAbsenceJustificatif?: string;
  }) {
    return this.http.post<OperationBancaire>(`${this.baseUrl}/operations-bancaires/${operationId}/rapprochement-par-defaut`, demande);
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

  annulerRapprochementValide(id: number) {
    return this.http.post<RapprochementBancaire>(`${this.baseUrl}/rapprochements-bancaires/${id}/annuler-valide`, {});
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
