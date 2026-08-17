export interface DashboardTresorerie {
  nombreComptes: number;
  operationsARapprocher: number;
  rapprochementsValides: number;
  soldeTotal: number;
  encaissements: number;
  decaissements: number;
}

export interface CompteBancaire {
  id: number;
  tenantId: number;
  societeInterneId: number;
  nomCompte: string;
  banque: string;
  iban?: string | null;
  ibanMasque: string;
  bic?: string | null;
  devise: string;
  soldeInitial: number;
  dateSoldeInitial?: string | null;
  soldeActuel: number;
  actif: boolean;
  dateCreation: string;
  dateModification: string;
  displayName: string;
}

export interface CompteBancairePayload {
  nomCompte: string;
  banque: string;
  iban: string;
  bic?: string | null;
  devise: string;
  soldeInitial: number;
  dateSoldeInitial?: string | null;
  actif: boolean;
}

export interface OperationBancaire {
  id: number;
  compteBancaireId: number;
  compteBancaireLibelle: string;
  importReleveBancaireId?: number | null;
  dateOperation: string;
  dateValeur?: string | null;
  libelle: string;
  referenceBancaire?: string | null;
  debit: number;
  credit: number;
  montant: number;
  sens: 'CREDIT' | 'DEBIT';
  typeOperation: string;
  tiersReconnu?: string | null;
  typeTiersReconnu?: TypeTiersReconnu | null;
  natureOperation: NatureOperationBancaire;
  statutClassification: StatutClassificationOperation;
  statutRapprochement: 'NON_RAPPROCHEE' | 'RAPPROCHEE' | 'PARTIELLEMENT_RAPPROCHEE' | 'IGNOREE';
  rapprochee: boolean;
  numeroLigneImport?: number | null;
  hashOperation?: string | null;
  tiersId?: number | null;
  factureId?: number | null;
  typeFacture?: TypeFactureRapprochement | null;
  salaireId?: number | null;
  periodeSalaire?: string | null;
  matriculeSalarie?: string | null;
  pieceRapprochementId?: number | null;
  typePiece?: TypePieceRapprochement | null;
  documentAssocieNumero?: string | null;
  documentAssocieLibelle?: string | null;
  factureRapprochementId?: number | null;
  pieceRapprochementAutorisee?: boolean | null;
  libelleRapprochement?: string | null;
  dateRapprochement?: string | null;
}

export type SensOperationBancaire = OperationBancaire['sens'];
export type StatutRapprochementOperation = OperationBancaire['statutRapprochement'];
export type TypeFactureRapprochement = 'VENTE' | 'ACHAT' | 'SALAIRE';
export type TypeOperationBancaire =
  | 'PAIEMENT_CB'
  | 'PRELEVEMENT'
  | 'VIREMENT_RECU'
  | 'VIREMENT_EMIS'
  | 'CHEQUE'
  | 'REMISE_CHEQUE'
  | 'FRAIS_BANCAIRES'
  | 'COTISATION'
  | 'COMMISSION'
  | 'RETRAIT_DAB'
  | 'ESPECES'
  | 'AUTRE';

export interface OperationBancairePayload {
  compteBancaireId: number;
  importReleveBancaireId?: number | null;
  dateOperation: string;
  dateValeur?: string | null;
  libelle: string;
  referenceBancaire?: string | null;
  debit?: number | null;
  credit?: number | null;
  montant: number;
  sens: SensOperationBancaire;
  typeOperation?: TypeOperationBancaire | null;
  tiersReconnu?: string | null;
  typeTiersReconnu?: TypeTiersReconnu | null;
  natureOperation?: NatureOperationBancaire | null;
  statutClassification?: StatutClassificationOperation | null;
  statutRapprochement?: StatutRapprochementOperation | null;
  tiersId?: number | null;
  factureId?: number | null;
  typeFacture?: TypeFactureRapprochement | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type SortDirection = 'ASC' | 'DESC';

export type OperationBancaireSortBy =
  | 'dateOperation'
  | 'libelle'
  | 'compte'
  | 'debit'
  | 'credit'
  | 'montant'
  | 'sens'
  | 'typeOperation'
  | 'tiersReconnu'
  | 'typeTiersReconnu'
  | 'natureOperation'
  | 'statutClassification'
  | 'statutRapprochement'
  | 'libelleRapprochement';

export type NatureOperationBancaire =
  | 'FACTURE_FOURNISSEUR'
  | 'FACTURE_CLIENT'
  | 'SALAIRE'
  | 'NOTE_DE_FRAIS'
  | 'TVA'
  | 'URSSAF'
  | 'IMPOT'
  | 'FRAIS_BANCAIRES'
  | 'COTISATION'
  | 'VIREMENT_INTERNE'
  | 'APPORT_CAPITAL'
  | 'COMPTE_COURANT'
  | 'EMPRUNT'
  | 'REMBOURSEMENT'
  | 'AUTRE';

export type StatutClassificationOperation = 'NON_CLASSEE' | 'CLASSEE_AUTO' | 'CLASSEE_MANUELLE' | 'A_VERIFIER';

export type TypeTiersReconnu = 'FOURNISSEUR' | 'FOURNISSEUR_SERVICE' | 'CLIENT' | 'SALARIE' | 'ADMINISTRATION' | 'AUTRE';

export interface FiltresOperations {
  tiersReconnu?: string;
  typeTiersReconnu?: TypeTiersReconnu | '';
  natureOperation?: NatureOperationBancaire | '';
  statutClassification?: StatutClassificationOperation | '';
  statutRapprochement?: OperationBancaire['statutRapprochement'] | '';
}

export interface ParametresListeOperations {
  page: number;
  size: number;
  sortBy: OperationBancaireSortBy;
  sortDirection: SortDirection;
}

export interface ImportReleve {
  id: number;
  compteBancaireId: number;
  compteBancaireLibelle: string;
  nomFichier: string;
  typeFichier: string;
  statutImport: string;
  nombreLignes: number;
  nombreLignesImportees: number;
  nombreLignesRejetees: number;
  totalDebit: number;
  totalCredit: number;
  dateImport: string;
  messageErreur?: string | null;
}

export interface ImportReleveResultat {
  importId: number;
  nomFichier: string;
  nombreLignes: number;
  nombreLignesImportees: number;
  nombreLignesRejetees: number;
  totalDebit: number;
  totalCredit: number;
  statutImport: string;
  erreurs: string[];
}

export interface RapprochementBancaire {
  id: number;
  operationBancaireId: number;
  operationLibelle: string;
  tiersReconnu?: string | null;
  factureId?: number | null;
  typeFacture?: TypeFactureRapprochement | null;
  salaireId?: number | null;
  periodeSalaire?: string | null;
  matriculeSalarie?: string | null;
  pieceRapprochementId?: number | null;
  typePiece?: TypePieceRapprochement | null;
  documentAssocieNumero?: string | null;
  documentAssocieLibelle?: string | null;
  montantOperation?: number | null;
  montantRapproche: number;
  ecart: number;
  statut: 'PROPOSE' | 'VALIDE' | 'ANNULE';
  commentaire?: string | null;
  dateRapprochement: string;
  utilisateurId?: number | null;
  modeRapprochement?: string | null;
  libelleRapprochement?: string | null;
  scoreMatching?: number | null;
  dateProposition?: string | null;
  dateValidation?: string | null;
  utilisateurValidationId?: number | null;
  dateAnnulation?: string | null;
  utilisateurAnnulationId?: number | null;
  motifAnnulation?: string | null;
}

export interface RapprochementFacturesResultat {
  operationsTraitees: number;
  rapprochementsCrees: number;
  propositionsCreees: number;
  operationsSansMatch: number;
  messages: string[];
}

export type TypePieceRapprochement = 'FACTURE_ACHAT' | 'FACTURE_VENTE' | 'PIECE_TRESORERIE' | 'SALAIRE'
  | 'NOTE_DE_FRAIS' | 'IMPOT_TAXE' | 'APPORT_CAPITAL' | 'COMPTE_COURANT_ASSOCIE' | 'EMPRUNT'
  | 'VIREMENT_INTERNE' | 'REMBOURSEMENT' | 'AUTRE';

export interface PieceRapprochement {
  id: number; numero: string; type: TypePieceRapprochement; tiersId: number; tiers: string;
  date: string; libelle: string; montant: number; statut: string;
  operationBancaireId: number; libelleRapprochement: string;
}

export interface FactureCandidateRapprochement {
  id: number;
  typeFacture: TypeFactureRapprochement;
  tiersId: number;
  numeroFacture: string;
  dateFacture: string;
  dateEcheance?: string | null;
  resteAPayer: number;
  libelle?: string | null;
  nomTiers?: string | null;
}

export interface LigneRapprochementManuelPayload {
  factureId: number;
  typeFacture: TypeFactureRapprochement;
  montantRapproche: number;
}

export interface RapprochementManuelResultat {
  operationId: number;
  montantOperation: number;
  montantRapproche: number;
  resteARapprocher: number;
  statutRapprochement: OperationBancaire['statutRapprochement'];
}

export interface RapprochementPropositionsResultat {
  propositionsTraitees: number;
  validees: number;
  annulees: number;
  erreurs: number;
  messages: string[];
}

export interface RegleRapprochement {
  id: number;
  libelle: string;
  motif?: string | null;
  sens?: 'CREDIT' | 'DEBIT' | null;
  tiersId?: number | null;
  priorite: number;
  active: boolean;
}

export interface FactureEcheance {
  factureId: number;
  numeroFacture: string;
  typeFacture: 'VENTE' | 'ACHAT';
  sensTresorerie: 'A_ENCAISSER' | 'A_PAYER';
  tiersId: number;
  tiersRaisonSociale: string;
  contratId?: number | null;
  familleActivite?: string | null;
  dateFacture: string;
  dateEcheance: string;
  montantTtc: number;
  montantDejaPaye: number;
  resteAPayer: number;
  joursRetard: number;
  statutEcheance: 'A_ECHOIR' | 'ECHEANCE_AUJOURD_HUI' | 'EN_RETARD' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';
}

export interface KpiEcheances {
  aEncaisser: number; aPayer: number; retardClients: number; retardFournisseurs: number;
  nombreFacturesEnRetard: number; echeancesA7Jours: number; echeancesA30Jours: number;
}

export interface FiltresEcheances {
  dateDebut?: string; dateFin?: string; typeFacture?: string; tiersId?: number; statut?: string;
  enRetard?: boolean; partiellementPayees?: boolean; familleActivite?: string; contratId?: number;
  montantMinimum?: number; montantMaximum?: number; page: number; size: number; sort: string;
}

export interface BalanceAgee {
  nonEchu: number;
  retard0A30: number;
  retard31A60: number;
  retard61A90: number;
  retardPlus90: number;
}
