import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { getHttpErrorMessage } from '../../../shared/http/http-error-message';
import {
  BalanceAgee,
  CompteBancaire,
  CompteBancairePayload,
  DashboardTresorerie,
  FactureEcheance,
  FiltresEcheances,
  KpiEcheances,
  FactureCandidateRapprochement,
  ImportReleve,
  ImportReleveResultat,
  FiltresOperations,
  NatureOperationBancaire,
  OperationBancaire,
  OperationBancairePayload,
  OperationBancaireSortBy,
  PieceRapprochement,
  RapprochementBancaire,
  RegleRapprochement,
  SortDirection,
  StatutClassificationOperation,
  TypeFactureRapprochement,
  TypeOperationBancaire,
  TypeTiersReconnu,
} from '../models/tresorerie.model';

type OngletTresorerie =
  | 'dashboard'
  | 'comptes'
  | 'imports'
  | 'operations'
  | 'rapprochements'
  | 'pieces-rapprochement'
  | 'factures-echeances'
  | 'balance-agee'
  | 'previsionnel';

type ModeCompte = 'liste' | 'creation' | 'modification' | 'detail';
type ModeOperation = 'liste' | 'creation' | 'modification';
type ChampCompte = 'nomCompte' | 'banque' | 'iban' | 'bic' | 'devise' | 'soldeInitial' | 'dateSoldeInitial' | 'actif';
type ChampOperation =
  | 'compteBancaireId'
  | 'dateOperation'
  | 'libelle'
  | 'sens'
  | 'montant'
  | 'typeOperation'
  | 'natureOperation'
  | 'statutClassification'
  | 'statutRapprochement';

@Component({
  selector: 'app-tresorerie-page',
  imports: [ReactiveFormsModule],
  templateUrl: './tresorerie.page.html',
  styleUrl: './tresorerie.page.css',
})
export class TresoreriePage implements OnInit {
  private readonly api = inject(TresorerieApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contexteService = inject(ContexteService);
  private readonly shellBridge = inject(WavyShellBridgeService);

  constructor() {
    effect(() => { if (this.contexteService.changementSociete() > 0) this.charger(); });
  }

  readonly onglet = signal<OngletTresorerie>('dashboard');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly dashboard = signal<DashboardTresorerie | null>(null);
  readonly comptes = signal<CompteBancaire[]>([]);
  readonly compteSelectionne = signal<CompteBancaire | null>(null);
  readonly modeCompte = signal<ModeCompte>('liste');
  readonly operations = signal<OperationBancaire[]>([]);
  readonly operationSelectionnee = signal<OperationBancaire | null>(null);
  readonly modeOperation = signal<ModeOperation>('liste');
  readonly filtresOperations = signal<FiltresOperations>({});
  readonly pageOperations = signal(1);
  readonly taillePageOperations = signal(10);
  readonly totalOperations = signal(0);
  readonly totalPagesOperations = signal(1);
  readonly triOperations = signal<{ sortBy: OperationBancaireSortBy; sortDirection: SortDirection }>({
    sortBy: 'dateOperation',
    sortDirection: 'DESC',
  });
  readonly imports = signal<ImportReleve[]>([]);
  readonly fichierImport = signal<File | null>(null);
  readonly resultatImport = signal<ImportReleveResultat | null>(null);
  readonly compteImportId = signal<number | null>(null);
  readonly rapprochements = signal<RapprochementBancaire[]>([]);
  readonly piecesRapprochement = signal<PieceRapprochement[]>([]);
  readonly regles = signal<RegleRapprochement[]>([]);
  readonly factures = signal<FactureEcheance[]>([]);
  readonly kpisEcheances = signal<KpiEcheances | null>(null);
  readonly filtresEcheances = signal<FiltresEcheances>({ page: 0, size: 25, sort: 'dateEcheance,asc' });
  readonly totalFactures = signal(0);
  readonly vuesEcheances = ['TOUTES', 'A_ENCAISSER', 'A_PAYER', 'EN_RETARD', 'PARTIELLEMENT_PAYEE'] as const;
  readonly vueEcheances = signal<(typeof this.vuesEcheances)[number]>('TOUTES');
  readonly balance = signal<BalanceAgee | null>(null);
  readonly operationRapprochementManuel = signal<OperationBancaire | null>(null);
  readonly candidatesRapprochement = signal<Array<FactureCandidateRapprochement & { selectionnee: boolean; montantRapproche: number }>>([]);

  readonly onglets: Array<{ id: OngletTresorerie; label: string }> = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'comptes', label: 'Comptes bancaires' },
    { id: 'imports', label: 'Import relevés' },
    { id: 'operations', label: 'Opérations bancaires' },
    { id: 'rapprochements', label: 'Rapprochement bancaire' },
    { id: 'pieces-rapprochement', label: 'Pièces de rapprochement' },
    { id: 'factures-echeances', label: 'Factures échéances' },
    { id: 'balance-agee', label: 'Balance âgée' },
    { id: 'previsionnel', label: 'Prévisionnel' },
  ];
  readonly naturesOperation: NatureOperationBancaire[] = [
    'FACTURE_FOURNISSEUR',
    'FACTURE_CLIENT',
    'SALAIRE',
    'NOTE_DE_FRAIS',
    'TVA',
    'URSSAF',
    'IMPOT',
    'FRAIS_BANCAIRES',
    'COTISATION',
    'VIREMENT_INTERNE',
    'APPORT_CAPITAL',
    'COMPTE_COURANT',
    'EMPRUNT',
    'REMBOURSEMENT',
    'AUTRE',
  ];
  readonly statutsClassification: StatutClassificationOperation[] = ['NON_CLASSEE', 'CLASSEE_AUTO', 'CLASSEE_MANUELLE', 'A_VERIFIER'];
  readonly typesTiers: TypeTiersReconnu[] = ['FOURNISSEUR', 'FOURNISSEUR_SERVICE', 'CLIENT', 'SALARIE', 'ADMINISTRATION', 'AUTRE'];
  readonly statutsRapprochement: OperationBancaire['statutRapprochement'][] = ['NON_RAPPROCHEE', 'PARTIELLEMENT_RAPPROCHEE', 'RAPPROCHEE', 'IGNOREE'];
  readonly typesOperation: TypeOperationBancaire[] = ['PAIEMENT_CB', 'PRELEVEMENT', 'VIREMENT_RECU', 'VIREMENT_EMIS', 'CHEQUE', 'REMISE_CHEQUE', 'FRAIS_BANCAIRES', 'COTISATION', 'COMMISSION', 'RETRAIT_DAB', 'ESPECES', 'AUTRE'];
  readonly sensOperations: OperationBancaire['sens'][] = ['DEBIT', 'CREDIT'];
  readonly typesFacture: TypeFactureRapprochement[] = ['VENTE', 'ACHAT', 'SALAIRE'];

  readonly titre = computed(() => this.onglets.find((item) => item.id === this.onglet())?.label ?? 'Trésorerie');
  readonly operationsPage = computed(() => this.operations());
  readonly rapprochementsProposes = computed(() => this.rapprochements().filter((rapprochement) => rapprochement.statut === 'PROPOSE'));
  readonly totalRapprochementManuel = computed(() => this.candidatesRapprochement()
    .filter((facture) => facture.selectionnee)
    .reduce((total, facture) => total + Number(facture.montantRapproche || 0), 0));
  readonly montantOperationManuel = computed(() => Math.abs(this.operationRapprochementManuel()?.montant ?? 0));
  readonly resteRapprochementManuel = computed(() => Math.max(0, this.montantOperationManuel() - this.totalRapprochementManuel()));
  readonly debutOperations = computed(() => this.totalOperations() === 0 ? 0 : (Math.min(this.pageOperations(), this.totalPagesOperations()) - 1) * this.taillePageOperations() + 1);
  readonly finOperations = computed(() => Math.min(this.debutOperations() + this.operationsPage().length - 1, this.totalOperations()));
  readonly formulaireCompte = this.fb.nonNullable.group({
    nomCompte: ['', Validators.required],
    banque: ['', Validators.required],
    iban: ['', Validators.required],
    bic: [''],
    devise: ['EUR', Validators.required],
    soldeInitial: [0, Validators.required],
    dateSoldeInitial: [''],
    actif: [true],
  });
  readonly formulaireOperation = this.fb.group({
    compteBancaireId: [null as number | null, Validators.required],
    dateOperation: ['', Validators.required],
    dateValeur: [''],
    libelle: ['', Validators.required],
    referenceBancaire: [''],
    sens: ['DEBIT' as OperationBancaire['sens'], Validators.required],
    montant: [0, Validators.required],
    typeOperation: ['AUTRE' as TypeOperationBancaire, Validators.required],
    tiersReconnu: [''],
    typeTiersReconnu: ['' as TypeTiersReconnu | ''],
    natureOperation: ['AUTRE' as NatureOperationBancaire, Validators.required],
    statutClassification: ['CLASSEE_MANUELLE' as StatutClassificationOperation, Validators.required],
    statutRapprochement: ['NON_RAPPROCHEE' as OperationBancaire['statutRapprochement'], Validators.required],
    tiersId: [null as number | null],
    factureId: [null as number | null],
    typeFacture: ['' as TypeFactureRapprochement | ''],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.onglet.set(this.normaliserOnglet(params.get('vue')));
      if (this.onglet() === 'factures-echeances') {
        const vue = params.get('vueEcheances');
        if (this.vuesEcheances.includes(vue as (typeof this.vuesEcheances)[number])) this.vueEcheances.set(vue as (typeof this.vuesEcheances)[number]);
        this.filtresEcheances.set({
          dateDebut: params.get('dateDebut') || undefined, dateFin: params.get('dateFin') || undefined,
          typeFacture: params.get('typeFacture') || undefined, tiersId: this.nombreParam(params.get('tiersId')),
          statut: params.get('statut') || undefined, enRetard: params.get('enRetard') === 'true' || undefined,
          partiellementPayees: params.get('partiellementPayees') === 'true' || undefined,
          familleActivite: params.get('familleActivite') || undefined, contratId: this.nombreParam(params.get('contratId')),
          montantMinimum: this.nombreParam(params.get('montantMinimum')), montantMaximum: this.nombreParam(params.get('montantMaximum')),
          page: this.nombreParam(params.get('page')) ?? 0, size: this.nombreParam(params.get('size')) ?? 25,
          sort: params.get('sort') || 'dateEcheance,asc',
        });
      }
      this.charger();
    });
  }

  ouvrirRapprochementManuel(operation: OperationBancaire): void {
    this.operationRapprochementManuel.set(operation);
    this.candidatesRapprochement.set([]);
    this.loading.set(true);
    this.api.facturesCandidates(operation.id).subscribe({
      next: (factures) => {
        this.candidatesRapprochement.set(factures.map((facture) => ({ ...facture, selectionnee: false, montantRapproche: 0 })));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(getHttpErrorMessage(error));
        this.operationRapprochementManuel.set(null);
        this.loading.set(false);
      },
    });
  }

  ouvrirTiers(id: number, label?: string | null): void {
    this.shellBridge.navigate('tiers', `/tiers/${id}`, label || `Tiers ${id}`);
  }

  ouvrirFacture(id: number | null | undefined, type: TypeFactureRapprochement | null | undefined, numero?: string | null): void {
    if (!id || !type) return;
    const path = type === 'ACHAT' ? `/factures/achats/${id}` : type === 'SALAIRE' ? `/salaires/${id}` : `/factures/ventes/${id}`;
    this.shellBridge.navigate('factures', path, numero || `Facture ${id}`);
  }

  selectionnerCandidate(id: number, selectionnee: boolean): void {
    let resteOperation = this.resteRapprochementManuel();
    this.candidatesRapprochement.update((items) => items.map((facture) => {
      if (facture.id !== id) return facture;
      const montant = selectionnee ? Math.min(facture.resteAPayer, resteOperation) : 0;
      return { ...facture, selectionnee, montantRapproche: montant };
    }));
  }

  modifierMontantCandidate(id: number, valeur: string): void {
    this.candidatesRapprochement.update((items) => items.map((facture) => facture.id === id
      ? { ...facture, montantRapproche: Number(valeur) || 0 }
      : facture));
  }

  validerRapprochementManuel(): void {
    const operation = this.operationRapprochementManuel();
    if (!operation || this.totalRapprochementManuel() <= 0 || this.totalRapprochementManuel() > this.montantOperationManuel() + 0.01) return;
    const lignes = this.candidatesRapprochement().filter((facture) => facture.selectionnee).map((facture) => ({
      factureId: facture.id,
      typeFacture: facture.typeFacture,
      montantRapproche: facture.montantRapproche,
    }));
    this.loading.set(true);
    this.api.rapprocherManuellement(operation.id, lignes).subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement ${resultat.statutRapprochement.toLowerCase()} : ${this.montant(resultat.montantRapproche)}.`);
        this.operationRapprochementManuel.set(null);
        this.loading.set(false);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (error) => {
        this.error.set(getHttpErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  fermerRapprochementManuel(): void {
    this.operationRapprochementManuel.set(null);
  }

  rapprochementManuelPossible(operation: OperationBancaire): boolean {
    return operation.statutRapprochement !== 'RAPPROCHEE' && !!operation.tiersId
      && ((operation.sens === 'DEBIT' && ['FOURNISSEUR', 'FOURNISSEUR_SERVICE'].includes(operation.typeTiersReconnu ?? ''))
        || (operation.sens === 'CREDIT' && operation.typeTiersReconnu === 'CLIENT'));
  }

  changerOnglet(onglet: OngletTresorerie): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vue: onglet === 'dashboard' ? null : onglet },
      queryParamsHandling: 'merge',
    });
  }

  charger(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard().subscribe({
      next: (dashboard) => this.dashboard.set(dashboard),
      error: (error) => this.error.set(getHttpErrorMessage(error)),
    });

    const fin = () => this.loading.set(false);
    switch (this.onglet()) {
      case 'comptes':
        this.chargerComptes(fin);
        break;
      case 'imports':
        this.api.comptes().subscribe({ next: (data) => {
          this.comptes.set(data);
          this.compteImportId.set(this.compteImportId() ?? data[0]?.id ?? null);
        }, error: () => this.comptes.set([]) });
        this.api.imports().subscribe({ next: (data) => this.imports.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      case 'operations':
      case 'previsionnel':
        this.chargerOperations(fin);
        break;
      case 'rapprochements':
        this.chargerRapprochements(fin);
        this.api.regles().subscribe({ next: (data) => this.regles.set(data), error: () => this.regles.set([]) });
        break;
      case 'pieces-rapprochement':
        this.api.piecesRapprochement().subscribe({ next: (data) => this.piecesRapprochement.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      case 'factures-echeances':
        this.chargerEcheances(fin);
        break;
      case 'balance-agee':
        this.api.balanceAgee().subscribe({ next: (data) => this.balance.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      default:
        this.api.operations(undefined, this.parametresOperations()).subscribe({ next: (data) => this.appliquerPageOperations(data), error: () => this.operations.set([]), complete: fin });
    }
  }

  montant(value: number | null | undefined): string {
    return `${(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  chargerEcheances(fin?: () => void): void {
    this.api.kpisFacturesEcheances().subscribe({ next: (data) => this.kpisEcheances.set(data) });
    this.api.facturesEcheances(this.filtresEcheances()).subscribe({
      next: (data) => { this.factures.set(data.content); this.totalFactures.set(data.totalElements); },
      error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin,
    });
  }

  changerVueEcheances(vue: (typeof this.vuesEcheances)[number]): void {
    this.vueEcheances.set(vue);
    const f: FiltresEcheances = { ...this.filtresEcheances(), page: 0, typeFacture: undefined, statut: undefined, enRetard: undefined, partiellementPayees: undefined };
    if (vue === 'A_ENCAISSER') f.typeFacture = 'VENTE';
    if (vue === 'A_PAYER') f.typeFacture = 'ACHAT';
    if (vue === 'EN_RETARD') { f.enRetard = true; f.sort = 'joursRetard,desc'; }
    if (vue === 'PARTIELLEMENT_PAYEE') f.partiellementPayees = true;
    this.appliquerFiltresEcheances(f);
  }

  filtreEcheance(cle: keyof FiltresEcheances, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.appliquerFiltresEcheances({ ...this.filtresEcheances(), page: 0, [cle]: value || undefined });
  }

  pageEcheances(delta: number): void {
    this.appliquerFiltresEcheances({ ...this.filtresEcheances(), page: Math.max(0, this.filtresEcheances().page + delta) });
  }

  private appliquerFiltresEcheances(filtres: FiltresEcheances): void {
    this.filtresEcheances.set(filtres);
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...filtres, vueEcheances: this.vueEcheances() }, queryParamsHandling: 'merge', replaceUrl: true });
    this.chargerEcheances();
  }

  dateFr(value: string | null | undefined): string {
    if (!value) return '-'; const [a, m, j] = value.split('-'); return `${j}/${m}/${a}`;
  }

  private nombreParam(value: string | null): number | undefined {
    if (value === null || value === '') return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined;
  }

  libelleStatutEcheance(statut: string): string {
    return ({ A_ECHOIR: 'À échoir', ECHEANCE_AUJOURD_HUI: "Échéance aujourd’hui", EN_RETARD: 'En retard',
      PARTIELLEMENT_PAYEE: 'Partiellement payée', PAYEE: 'Payée' } as Record<string, string>)[statut] ?? statut;
  }

  private chargerRapprochements(fin?: () => void): void {
    this.api.rapprochements().subscribe({
      next: (data) => this.rapprochements.set(data),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: fin,
    });
  }

  choisirCompteImport(value: string): void {
    this.compteImportId.set(value ? Number(value) : null);
  }

  choisirFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fichierImport.set(input.files?.[0] ?? null);
    this.resultatImport.set(null);
  }

  deposerFichier(event: DragEvent): void {
    event.preventDefault();
    this.fichierImport.set(event.dataTransfer?.files?.[0] ?? null);
    this.resultatImport.set(null);
  }

  importerReleve(): void {
    const compteId = this.compteImportId();
    const fichier = this.fichierImport();
    if (!compteId || !fichier) {
      this.error.set('Selectionnez un compte bancaire et un fichier.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.importerReleve(compteId, fichier).subscribe({
      next: (resultat) => {
        this.resultatImport.set(resultat);
        this.api.imports().subscribe({ next: (imports) => this.imports.set(imports) });
        this.pageOperations.set(1);
        this.api.operations(this.filtresOperations(), this.parametresOperations()).subscribe({ next: (operations) => this.appliquerPageOperations(operations) });
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  voirOperationsImportees(): void {
    this.changerOnglet('operations');
  }

  chargerOperations(fin?: () => void): void {
    this.api.operations(this.filtresOperations(), this.parametresOperations()).subscribe({
      next: (data) => {
        this.appliquerPageOperations(data);
        if (this.pageOperations() > this.totalPagesOperations()) {
          this.pageOperations.set(this.totalPagesOperations());
          this.chargerOperations();
        }
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: fin,
    });
  }

  private appliquerPageOperations(data: { content: OperationBancaire[]; totalElements: number; totalPages: number }): void {
    this.operations.set(data.content);
    this.totalOperations.set(data.totalElements);
    this.totalPagesOperations.set(Math.max(1, data.totalPages));
  }

  private parametresOperations() {
    return {
      page: Math.max(0, this.pageOperations() - 1),
      size: this.taillePageOperations(),
      ...this.triOperations(),
    };
  }

  trierOperations(sortBy: OperationBancaireSortBy): void {
    const triCourant = this.triOperations();
    this.triOperations.set({
      sortBy,
      sortDirection: triCourant.sortBy === sortBy && triCourant.sortDirection === 'DESC' ? 'ASC' : 'DESC',
    });
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  indicateurTriOperations(sortBy: OperationBancaireSortBy): string {
    const tri = this.triOperations();
    if (tri.sortBy !== sortBy) {
      return '';
    }
    return tri.sortDirection === 'ASC' ? '▲' : '▼';
  }

  filtrerOperations(cle: keyof FiltresOperations, valeur: string): void {
    const filtres = { ...this.filtresOperations(), [cle]: valeur || undefined };
    this.filtresOperations.set(filtres);
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  reinitialiserFiltresOperations(): void {
    this.filtresOperations.set({});
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  changerTaillePageOperations(valeur: string): void {
    this.taillePageOperations.set(Number(valeur) || 10);
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  pagePrecedenteOperations(): void {
    this.pageOperations.update((page) => Math.max(1, page - 1));
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  pageSuivanteOperations(): void {
    this.pageOperations.update((page) => Math.min(this.totalPagesOperations(), page + 1));
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  modifierNatureOperation(operation: OperationBancaire, natureOperation: string): void {
    this.loading.set(true);
    this.api.modifierClassificationOperation(operation.id, natureOperation as NatureOperationBancaire).subscribe({
      next: (operationModifiee) => this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item)),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  retraiterOperation(operation: OperationBancaire): void {
    this.loading.set(true);
    this.api.retraiterOperation(operation.id).subscribe({
      next: (operationModifiee) => this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item)),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  retraiterOperationsNonRapprochees(): void {
    this.loading.set(true);
    this.api.retraiterOperationsNonRapprochees().subscribe({
      next: () => this.chargerOperations(),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  calculerNomTiersOperationsNonRapprochees(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Calcul du tiers reconnu sur les opérations bancaires non rapprochées');
    this.api.calculerNomTiersOperationsNonRapprochees().subscribe({
      next: () => this.chargerOperations(),
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherFactures(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des opérations avec les factures ouvertes');
    this.api.rapprocherFactures().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement factures : ${resultat.rapprochementsCrees} validé(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherSalaires(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des virements avec les salaires');
    this.api.rapprocherSalaires().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement salaires : ${resultat.rapprochementsCrees} validé(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherSalaire(operation: OperationBancaire): void {
    if (!this.salaireRapprochementPossible(operation)) return;
    this.loading.set(true);
    this.api.rapprocherFacture(operation.id).subscribe({
      next: (resultat) => {
        this.message.set(`Salaire : ${resultat.rapprochementsCrees} validé(s), ${resultat.propositionsCreees} proposition(s).`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  rapprocherNotesFrais(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des remboursements de notes de frais');
    this.api.rapprocherNotesFrais().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement notes de frais : ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherNoteFrais(operation: OperationBancaire): void {
    if (!this.noteFraisRapprochementPossible(operation)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement note de frais');
    this.api.rapprocherNoteFrais(operation.id).subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement note de frais : ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  creerFactureRapprochement(operation: OperationBancaire): void {
    if (!this.pieceRapprochementPossible(operation)) {
      return;
    }
    if (!confirm(`Créer une pièce de rapprochement pour l'opération "${operation.libelle}" ?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.creerPieceRapprochement(operation.id).subscribe({
      next: (operationModifiee) => {
        this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item));
        this.message.set('Pièce de rapprochement créée.');
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  creerFacturesRapprochementPossibles(): void {
    const operationsEligibles = this.operationsPieceRapprochementPossibles();
    if (operationsEligibles.length === 0) {
      return;
    }
    if (!confirm(`Créer ${operationsEligibles.length} pièce(s) de rapprochement pour les opérations éligibles affichées ?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    forkJoin(operationsEligibles.map((operation) => this.api.creerPieceRapprochement(operation.id))).subscribe({
      next: (operationsModifiees) => {
        const parId = new Map(operationsModifiees.map((operation) => [operation.id, operation]));
        this.operations.update((operations) => operations.map((operation) => parId.get(operation.id) ?? operation));
        this.message.set(`${operationsModifiees.length} pièce(s) de rapprochement créée(s).`);
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  operationsPieceRapprochementPossibles(): OperationBancaire[] {
    return this.operationsPage().filter((operation) => this.pieceRapprochementPossible(operation));
  }

  pieceRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && !!operation.tiersReconnu
      && operation.pieceRapprochementAutorisee === true
      && !operation.factureId
      && !operation.factureRapprochementId;
  }

  noteFraisRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.sens === 'DEBIT'
      && operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && !!operation.tiersReconnu
      && operation.natureOperation === 'NOTE_DE_FRAIS';
  }

  salaireRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.sens === 'DEBIT'
      && operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && operation.typeTiersReconnu === 'SALARIE'
      && operation.natureOperation === 'SALAIRE';
  }

  validerRapprochement(rapprochement: RapprochementBancaire): void {
    if (rapprochement.statut !== 'PROPOSE') {
      return;
    }
    if (!confirm('Valider cette proposition de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.validerRapprochement(rapprochement.id).subscribe({
      next: (rapprochementModifie) => {
        this.rapprochements.update((items) => items.map((item) => item.id === rapprochement.id ? rapprochementModifie : item));
        this.message.set('Proposition de rapprochement validée.');
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerRapprochement(rapprochement: RapprochementBancaire): void {
    if (rapprochement.statut !== 'PROPOSE') {
      return;
    }
    if (!confirm('Annuler cette proposition ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.annulerRapprochement(rapprochement.id).subscribe({
      next: (rapprochementModifie) => {
        this.rapprochements.update((items) => items.map((item) => item.id === rapprochement.id ? rapprochementModifie : item));
        this.message.set('Proposition de rapprochement annulée.');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  validerToutesPropositions(): void {
    const total = this.rapprochementsProposes().length;
    if (total === 0 || !confirm('Valider toutes les propositions de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.validerRapprochementsProposes().subscribe({
      next: (resultat) => {
        this.message.set(`Propositions traitées : ${resultat.propositionsTraitees}, validées : ${resultat.validees}, erreurs : ${resultat.erreurs}.`);
        if (resultat.messages?.length) {
          this.error.set(resultat.messages.join('\n'));
        }
        this.chargerRapprochements();
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerToutesPropositions(): void {
    const total = this.rapprochementsProposes().length;
    if (total === 0 || !confirm('Annuler toutes les propositions de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.annulerRapprochementsProposes().subscribe({
      next: (resultat) => {
        this.message.set(`Propositions traitées : ${resultat.propositionsTraitees}, annulées : ${resultat.annulees}, erreurs : ${resultat.erreurs}.`);
        if (resultat.messages?.length) {
          this.error.set(resultat.messages.join('\n'));
        }
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  actionRapprochementPossible(rapprochement: RapprochementBancaire): boolean {
    return rapprochement.statut === 'PROPOSE';
  }

  libelleNature(nature: string | null | undefined): string {
    const libelles: Record<string, string> = {
      FACTURE_FOURNISSEUR: 'Facture fournisseur',
      FACTURE_CLIENT: 'Facture client',
      SALAIRE: 'Salaire',
      NOTE_DE_FRAIS: 'Note de frais',
      TVA: 'TVA',
      URSSAF: 'URSSAF',
      IMPOT: 'Impôt',
      FRAIS_BANCAIRES: 'Frais bancaires',
      COTISATION: 'Cotisation',
      VIREMENT_INTERNE: 'Virement interne',
      APPORT_CAPITAL: 'Apport capital',
      COMPTE_COURANT: 'Compte courant',
      REMBOURSEMENT: 'Remboursement',
      AUTRE: 'Autre',
    };
    return nature ? (libelles[nature] ?? nature) : '-';
  }

  libelleStatutClassification(statut: string | null | undefined): string {
    const libelles: Record<string, string> = {
      NON_CLASSEE: 'Non classée',
      CLASSEE_AUTO: 'Classée auto',
      CLASSEE_MANUELLE: 'Classée manuelle',
      A_VERIFIER: 'À vérifier',
    };
    return statut ? (libelles[statut] ?? statut) : '-';
  }

  voirOperation(operation: OperationBancaire): void {
    alert(`${operation.dateOperation} - ${operation.libelle}\nDate valeur : ${operation.dateValeur || '-'}\nRéférence : ${operation.referenceBancaire || '-'}\nMontant : ${this.montant(operation.montant)}\nNature : ${this.libelleNature(operation.natureOperation)}\nStatut : ${operation.statutRapprochement}`);
  }

  nouvelleOperation(): void {
    this.error.set(null);
    this.message.set(null);
    this.operationSelectionnee.set(null);
    if (this.comptes().length === 0) {
      this.chargerComptes();
    }
    this.formulaireOperation.reset({
      compteBancaireId: this.comptes()[0]?.id ?? null,
      dateOperation: this.dateJour(),
      dateValeur: '',
      libelle: '',
      referenceBancaire: '',
      sens: 'DEBIT',
      montant: 0,
      typeOperation: 'AUTRE',
      tiersReconnu: '',
      typeTiersReconnu: '',
      natureOperation: 'AUTRE',
      statutClassification: 'CLASSEE_MANUELLE',
      statutRapprochement: 'NON_RAPPROCHEE',
      tiersId: null,
      factureId: null,
      typeFacture: '',
    });
    this.modeOperation.set('creation');
  }

  modifierOperation(operation: OperationBancaire): void {
    this.error.set(null);
    this.message.set(null);
    if (this.comptes().length === 0) {
      this.chargerComptes();
    }
    this.loading.set(true);
    this.api.operation(operation.id).subscribe({
      next: (detail) => {
        this.operationSelectionnee.set(detail);
        this.remplirFormulaireOperation(detail);
        this.modeOperation.set('modification');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  enregistrerOperation(): void {
    if (this.formulaireOperation.invalid) {
      this.formulaireOperation.markAllAsTouched();
      return;
    }
    const operation = this.operationSelectionnee();
    const payload = this.payloadOperation();
    const mode = this.modeOperation();
    const requete = this.modeOperation() === 'modification' && operation
      ? this.api.modifierOperationBancaire(operation.id, payload)
      : this.api.creerOperation(payload);
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    requete.subscribe({
      next: (operationEnregistree) => {
        this.operationSelectionnee.set(operationEnregistree);
        this.modeOperation.set('liste');
        this.message.set(mode === 'modification' ? 'Transaction modifiée.' : 'Transaction créée.');
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerOperation(): void {
    this.error.set(null);
    this.operationSelectionnee.set(null);
    this.modeOperation.set('liste');
  }

  champOperationInvalide(champ: ChampOperation): boolean {
    const controle = this.formulaireOperation.controls[champ];
    return controle.invalid && (controle.dirty || controle.touched);
  }

  supprimerOperation(operation: OperationBancaire): void {
    if (!confirm('Voulez-vous vraiment supprimer cette operation bancaire ?')) {
      return;
    }
    this.loading.set(true);
    this.api.supprimerOperation(operation.id).subscribe({
      next: () => {
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  nouveauCompte(): void {
    this.error.set(null);
    this.compteSelectionne.set(null);
    this.formulaireCompte.reset({
      nomCompte: '',
      banque: '',
      iban: '',
      bic: '',
      devise: 'EUR',
      soldeInitial: 0,
      dateSoldeInitial: '',
      actif: true,
    });
    this.modeCompte.set('creation');
  }

  voirCompte(compte: CompteBancaire): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.compte(compte.id).subscribe({
      next: (detail) => {
        this.compteSelectionne.set(detail);
        this.modeCompte.set('detail');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  modifierCompte(compte: CompteBancaire): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.compte(compte.id).subscribe({
      next: (detail) => {
        this.compteSelectionne.set(detail);
        this.remplirFormulaireCompte(detail);
        this.modeCompte.set('modification');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  enregistrerCompte(): void {
    if (this.formulaireCompte.invalid) {
      this.formulaireCompte.markAllAsTouched();
      return;
    }
    const compte = this.compteSelectionne();
    const payload = this.payloadCompte();
    this.loading.set(true);
    this.error.set(null);
    const requete = this.modeCompte() === 'modification' && compte
      ? this.api.modifierCompte(compte.id, payload)
      : this.api.creerCompte(payload);
    requete.subscribe({
      next: (enregistre) => {
        this.compteSelectionne.set(enregistre);
        this.modeCompte.set('detail');
        this.chargerComptes();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerCompte(): void {
    this.error.set(null);
    this.modeCompte.set(this.compteSelectionne() ? 'detail' : 'liste');
  }

  retourListeComptes(): void {
    this.compteSelectionne.set(null);
    this.modeCompte.set('liste');
  }

  desactiverCompte(compte: CompteBancaire): void {
    if (!confirm('Voulez-vous vraiment désactiver ce compte bancaire ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.desactiverCompte(compte.id).subscribe({
      next: () => {
        this.compteSelectionne.set(null);
        this.modeCompte.set('liste');
        this.chargerComptes();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  champCompteInvalide(champ: ChampCompte): boolean {
    const controle = this.formulaireCompte.controls[champ];
    return controle.invalid && (controle.dirty || controle.touched);
  }

  private normaliserOnglet(value: string | null): OngletTresorerie {
    return this.onglets.some((item) => item.id === value) ? (value as OngletTresorerie) : 'dashboard';
  }

  private chargerComptes(fin: () => void = () => undefined): void {
    this.api.comptes().subscribe({
      next: (data) => this.comptes.set(data),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: fin,
    });
  }

  private remplirFormulaireCompte(compte: CompteBancaire): void {
    this.formulaireCompte.reset({
      nomCompte: compte.nomCompte,
      banque: compte.banque,
      iban: compte.iban ?? '',
      bic: compte.bic ?? '',
      devise: compte.devise,
      soldeInitial: compte.soldeInitial ?? 0,
      dateSoldeInitial: compte.dateSoldeInitial ?? '',
      actif: compte.actif,
    });
  }

  private payloadCompte(): CompteBancairePayload {
    const valeur = this.formulaireCompte.getRawValue();
    return {
      nomCompte: valeur.nomCompte.trim(),
      banque: valeur.banque.trim(),
      iban: valeur.iban.trim(),
      bic: valeur.bic.trim() || null,
      devise: valeur.devise.trim().toUpperCase(),
      soldeInitial: Number(valeur.soldeInitial ?? 0),
      dateSoldeInitial: valeur.dateSoldeInitial || null,
      actif: valeur.actif,
    };
  }

  private remplirFormulaireOperation(operation: OperationBancaire): void {
    this.formulaireOperation.reset({
      compteBancaireId: operation.compteBancaireId,
      dateOperation: operation.dateOperation,
      dateValeur: operation.dateValeur ?? '',
      libelle: operation.libelle,
      referenceBancaire: operation.referenceBancaire ?? '',
      sens: operation.sens,
      montant: Math.abs(operation.montant ?? operation.debit ?? operation.credit ?? 0),
      typeOperation: operation.typeOperation as TypeOperationBancaire,
      tiersReconnu: operation.tiersReconnu ?? '',
      typeTiersReconnu: operation.typeTiersReconnu ?? '',
      natureOperation: operation.natureOperation,
      statutClassification: operation.statutClassification,
      statutRapprochement: operation.statutRapprochement,
      tiersId: operation.tiersId ?? null,
      factureId: operation.factureId ?? null,
      typeFacture: operation.typeFacture ?? '',
    });
  }

  private payloadOperation(): OperationBancairePayload {
    const valeur = this.formulaireOperation.getRawValue();
    const sens = valeur.sens ?? 'DEBIT';
    const montantAbsolu = Math.abs(Number(valeur.montant ?? 0));
    return {
      compteBancaireId: Number(valeur.compteBancaireId),
      importReleveBancaireId: null,
      dateOperation: valeur.dateOperation ?? this.dateJour(),
      dateValeur: valeur.dateValeur || null,
      libelle: (valeur.libelle ?? '').trim(),
      referenceBancaire: valeur.referenceBancaire?.trim() || null,
      debit: sens === 'DEBIT' ? montantAbsolu : 0,
      credit: sens === 'CREDIT' ? montantAbsolu : 0,
      montant: sens === 'DEBIT' ? -montantAbsolu : montantAbsolu,
      sens,
      typeOperation: valeur.typeOperation || 'AUTRE',
      tiersReconnu: valeur.tiersReconnu?.trim() || null,
      typeTiersReconnu: valeur.typeTiersReconnu || null,
      natureOperation: valeur.natureOperation || 'AUTRE',
      statutClassification: valeur.statutClassification || 'CLASSEE_MANUELLE',
      statutRapprochement: valeur.statutRapprochement || 'NON_RAPPROCHEE',
      tiersId: this.nombreOptionnel(valeur.tiersId),
      factureId: this.nombreOptionnel(valeur.factureId),
      typeFacture: valeur.typeFacture || null,
    };
  }

  private nombreOptionnel(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    return Number(value);
  }

  private dateJour(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
