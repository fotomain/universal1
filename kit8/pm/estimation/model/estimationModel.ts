// Estimation dashboard - the model (no React, no Supabase). Design: documentation/ESTIMATION/dashboard/claude/ESTIMATION_DASHBOARD_WBS.html (+ google/). SQL: PART 58.
// Every table has the generic shape rowGUID / rowOwnerGUID / rowParentGUID / orderInList / rowJSON and is registered as ONE redux entity in kit8/redux/SystemMetaData.ts
// (kit8/pm/estimation/estimationMetaData.ts), so ReusableTable edits it inline with realtime and optimistic CRUD.
import type { ProductTableDef } from '../../../catalog/product/productModel';

export const ESTIMATION_ROUTE = '/pm/project/estimation/dashboard' as const;

/** the catalogs (shared) */
export const ESTIMATION_CATALOG_OWNER = 'estimationCatalog';

const def = (table: string, entity: string, itemLabel: string, catalogOwner: string | null, purpose: string, emptyRowJSON: () => Record<string, any>): ProductTableDef =>
  ({ table, entity, itemLabel, catalogOwner, purpose, emptyRowJSON });

export const ESTIMATION_TABLES = {
  normBook: def('estimation_norm_book_catalog', 'estimationNormBookReusable', 'Norm book node', ESTIMATION_CATALOG_OWNER,
    'The tree of norm books: World Norms (v2) -> continent -> country -> book.', () => ({ nodeKind: 'country', code: null, title: null })),
  norm: def('estimation_norm_catalog', 'estimationNormReusable', 'Norm', null,
    'The norms (work items with their resource composition) and the sections of one norm book.', () => ({ nodeKind: 'norm', code: null, title: null, unit: null, resources: [] })),
  resource: def('estimation_resource_catalog', 'estimationResourceReusable', 'Resource', null,
    'The priced resources of one norm book: labour, machines, materials, equipment.', () => ({ nodeKind: 'resource', code: null, title: null, unit: null, price: null })),
  coefficient: def('estimation_coefficient_catalog', 'estimationCoefficientReusable', 'Coefficient', ESTIMATION_CATALOG_OWNER,
    'Coefficients for the conditions of work (cramped site, winter ...), each with its justification.', () => ({ code: null, title: null, value: 1, justification: null })),
  exportTemplate: def('estimation_export_template_catalog', 'estimationExportTemplateReusable', 'Export template', ESTIMATION_CATALOG_OWNER,
    'Layout of the exported documents and of the input examples.', () => ({ templateKey: null, title: null, format: 'xlsx' })),
  indexHistory: def('estimation_index_history', 'estimationIndexReusable', 'Index', ESTIMATION_CATALOG_OWNER,
    'Index to the current price level per book / zone / cost element / price date.', () => ({ priceDate: null, costElement: 'construction', value: 1 })),
  overheadProfit: def('estimation_overhead_profit_table', 'estimationOverheadProfitReusable', 'Overhead and profit norm', ESTIMATION_CATALOG_OWNER,
    'Overhead and profit norms (percent of payroll) per type of work.', () => ({ code: null, title: null, overheadPct: 0, profitPct: 0 })),
  document: def('estimation_document_table', 'estimationDocumentReusable', 'Estimate document', null,
    'The header of an estimate document of a project.', () => ({ docKind: 'local', cipher: null, title: null })),
  line: def('estimation_line_table', 'estimationLineReusable', 'Estimate line', null,
    'Sections, positions and resource lines of an estimate document.', () => ({ lineKind: 'position', title: null, qty: 1 })),
  quote: def('estimation_market_quote_table', 'estimationQuoteReusable', 'Supplier quote', null,
    'The supplier quotes behind a position.', () => ({ supplier: null, price: null })),
} as const;

export type EstimationTableKey = keyof typeof ESTIMATION_TABLES;

// ---- the three currencies of a project (Q3: every sum is stored in all three) ------------------------------------------------------------------------------------------------
/** the sums are kept in the budget, accounting and consolidation currency of the project */
export const ESTIMATION_SUM_KEYS = ['sumForBudget', 'sumForAccounting', 'sumForConsolidation'] as const;
export type EstimationSumKey = (typeof ESTIMATION_SUM_KEYS)[number];
export type EstimationSums = Record<EstimationSumKey, number>;
/** the currency shown on the board: the user switches it, nothing is recalculated (all three are stored) */
export type EstimationCurrencyBasis = 'budget' | 'accounting' | 'consolidation';
export const BASIS_TO_SUM_KEY: Record<EstimationCurrencyBasis, EstimationSumKey> = { budget: 'sumForBudget', accounting: 'sumForAccounting', consolidation: 'sumForConsolidation' };
/** the hover tip of a currency button = the NAME first (+ the currency code), the description after it (both pass through pmT) */
export const BASIS_TIPS: Record<EstimationCurrencyBasis, { name: string; description: string }> = {
  budget: { name: 'Budget currency', description: 'the sums in the budget currency of the project, the one its budget and Monitor01 use.' },
  accounting: { name: 'Accounting currency', description: 'the sums in the accounting currency of the project, the one of the books and the documents.' },
  consolidation: { name: 'Consolidation currency', description: 'the sums in the one currency of the organization, so that the money of several projects can be added.' },
};

// ---- documents and lines -----------------------------------------------------------------------------------------------------------------------------------------------------
export type EstimationDocKind = 'local' | 'object' | 'summary' | 'separate' | 'bid';
export const ESTIMATION_DOC_KINDS: EstimationDocKind[] = ['local', 'object', 'summary', 'separate', 'bid'];
/** the pricing method: base-index (version 1), resource-index and resource later; commercial = a plain quote */
export type EstimationMethod = 'baseIndex' | 'resourceIndex' | 'resource' | 'commercial';
export type EstimationLineKind = 'section' | 'position' | 'resource';
/** which element of the cost a line is: labour, machines, operators of machines (inside machines), materials, transport / other, equipment */
export type EstimationComponent = 'labour' | 'machines' | 'operators' | 'materials' | 'other' | 'equipment';

export interface EstimationCoefficient { code?: string; title?: string; value: number; justification?: string }

/** rowJSON of a document */
export interface EstimationDocumentJSON {
  docKind: EstimationDocKind;
  title?: string | null;
  cipher?: string | null;
  method?: EstimationMethod;
  priceLevelDate?: string | null;
  normBookGUID?: string | null;
  /** the currency of the numbers typed in the lines */
  currency?: string;
  currencyForBudget?: string;
  currencyForAccounting?: string;
  currencyForConsolidation?: string;
  /** document currency -> budget / accounting / consolidation currency (typed or read from the rate book) */
  rates?: { budget: number; accounting: number; consolidation: number };
  overheadPct?: number;
  profitPct?: number;
  index?: number;
  vatPct?: number;
  contingencyPct?: number;
  objectKind?: EstimationObjectKind;
  /** building area, m2 (the trade breakdown shows the cost per m2) */
  areaM2?: number;
  /** the chapter (1 - 12) and the kind of works of the summary estimate this document goes into */
  chapter?: number;
  workKind?: 'construction' | 'installation' | 'other';
  /** the columns of the layout the user switched off */
  hiddenColumns?: string[];
  header?: { client?: string; compiledBy?: string; checkedBy?: string; approvedBy?: string; basis?: string };
  totals?: Record<string, number>;
}

/** rowJSON of a line (section / position / resource) */
export interface EstimationLineJSON {
  documentGUID: string;
  lineKind: EstimationLineKind;
  title?: string | null;
  /** the justification: code of the norm in the norm book (or a typed text) */
  normCode?: string | null;
  normGUID?: string | null;
  unit?: string | null;
  qty?: number;
  coefficients?: EstimationCoefficient[];
  /** a typed coefficient of the position (the column Coef. of the sheet): combined with the list above */
  coefficient?: number;
  /** costs per unit in the currency of the document, base prices */
  unitLabour?: number;
  unitMachines?: number;
  unitOperators?: number;
  unitMaterials?: number;
  unitOther?: number;
  unitEquipment?: number;
  overheadPct?: number | null;
  profitPct?: number | null;
  index?: number | null;
  /** quick quote layout */
  markupPct?: number;
  status?: string;
  category?: string;
  /** links to the app catalogs (the existing ones are reused) */
  budgetItemGUID?: string | null;
  productGUID?: string | null;
  businessUnitGUID?: string | null;
  managementGenusGUID?: string | null;
  takeoffRef?: string | null;
  taskGUID?: string | null;
  /** the total of the line in current prices, in the three currencies */
  sumForBudget?: number;
  sumForAccounting?: number;
  sumForConsolidation?: number;
}

export type EstimationObjectKind = 'nonProduction' | 'production' | 'linear' | 'unique';

/** rowJSON keys of the project (project_table.rowJSON) */
export const ESTIMATION_PROJECT_KEYS = {
  /** when false (the default) no country-specific / regulation text is shown in the dashboard or in the exported documents */
  useGOSTInformationInDocuments: 'useGOSTInformationInDocuments',
} as const;

/** is the regulation-specific wording (the Methodology, its forms, its country) allowed in the documents of this project? FALSE while never saved */
export const useGOSTInformationOf = (projectJSON: { useGOSTInformationInDocuments?: unknown } | null | undefined): boolean => projectJSON?.useGOSTInformationInDocuments === true;

// ---- ids ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** a deterministic 53-bit hash (cyrb53) as a base-36 string: the same norm of the same book always gets the same rowGUID, so a second import changes rows instead of doubling them */
export function stableHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** the prefix of the rowGUID of every imported catalog row: the translation host leaves such rows out (they would be read by every user for every language) */
export const NORM_GUID_PREFIX = 'estn-';

/** rowGUID of a norm book row: estn-<book>-<kind>-<hash of the code path> (code path = the parent chain + the code, because section codes repeat) */
export const normRowGUID = (bookGUID: string, kind: string, path: string): string => `${NORM_GUID_PREFIX}${stableHash(bookGUID)}-${kind}-${stableHash(path)}`;

export const isNormGUID = (guid: string | null | undefined): boolean => !!guid && guid.startsWith(NORM_GUID_PREFIX);
